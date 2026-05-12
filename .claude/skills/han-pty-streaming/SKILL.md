---
name: han-pty-streaming
description: Han'ın PTY yakalama, WebSocket transport ve raw stream protokolü detayı. runtime-engineer ve hub-engineer için ana referans.
---

# Han PTY Streaming Reference

## node-pty temelleri

`node-pty` Microsoft tarafından sürdürülen, VS Code'un da kullandığı pseudo-terminal kütüphanesi. macOS, Linux, Windows (1809+) destekliyor.

```typescript
import * as pty from 'node-pty';
import * as os from 'node:os';

const shell = process.env.SHELL || (os.platform() === 'win32' ? 'powershell.exe' : 'bash');

const ptyProcess = pty.spawn(shell, [], {
  name: 'xterm-color',
  cols: process.stdout.columns,
  rows: process.stdout.rows,
  cwd: process.cwd(),
  env: process.env,
});

ptyProcess.onData((data) => {
  process.stdout.write(data);   // yayıncının terminaline yaz
  sendToHub(data);              // hub'a forward et
});

process.stdin.setRawMode(true);
process.stdin.on('data', (data) => {
  ptyProcess.write(data.toString());
});

process.stdout.on('resize', () => {
  ptyProcess.resize(process.stdout.columns, process.stdout.rows);
});
```

## han stream komut varyasyonları

### Mevcut shell'i sarmala

```bash
han stream
```

`han stream` tek başına: yeni bir shell instance açar, o shell'in tüm output'u yayında. Yayıncı bu shell'de istediği komutu çalıştırır.

### Belirli komutu çalıştır

```bash
han stream claude
han stream cursor
han stream "npm run dev"
```

`han stream <command>`: argüman komutunu çocuk process olarak başlatır, bittiğinde yayın da biter.

## Privacy filter

Yayıncının yapılandırma dosyası (`~/.han/config.json`):

```json
{
  "privacy_filters": [
    "AKIA[A-Z0-9]{16}",
    "ghp_[A-Za-z0-9]{36}",
    "sk_[a-z]+_[A-Za-z0-9]{32,}",
    "/Users/[^/\\s]+",
    "/home/[^/\\s]+"
  ]
}
```

Stream'e gitmeden önce her chunk bu regex'lerle kontrol edilir, eşleşenler `[REDACTED]` ile değiştirilir.

```typescript
function applyFilters(data: string, filters: RegExp[]): string {
  let out = data;
  for (const f of filters) {
    out = out.replace(f, '[REDACTED]');
  }
  return out;
}
```

Hub tarafında ikinci bir filter katmanı, common pattern'ler için (default ON).

## WebSocket protokolü

Tek endpoint: `wss://<hub-url>/ws`

İlk mesajda role belirtilir:

```typescript
// Yayıncı
{ type: 'register_streamer', auth: '<jwt>', config: {...} }

// İzleyici
{ type: 'join', code: 'kz-han-7843', auth: '<jwt>' }
```

Hub `registered` veya `snapshot` ile yanıt verir.

### Stream chunk akışı

```typescript
{
  type: 'stream_chunk',
  data: '\u001b[32m✓\u001b[0m Build successful\n',
  ts: 1746542130123,
  seq: 142
}
```

`seq` reconnect sonrası "since_seq" parametresi için kullanılır.

### Reconnect mantığı

Yayıncı tarafı:
- WebSocket close → 1s, 2s, 4s, 8s exponential backoff (max 30s)
- Tekrar bağlanınca `register_streamer` ile birlikte `last_seq` gönder

İzleyici tarafı:
- WebSocket close → reconnect
- `join` mesajıyla birlikte `since_seq: last_seen_seq` gönder
- Hub ring buffer'dan kayıp segmenti yollar (eğer hala buffer'da varsa)
- Buffer'dan düşmüşse "skipped X chunks" notice ile devam

## Hub tarafı: stream router

```
Yayıncı → WebSocket → /ws
                     ↓
              StreamRouter
                     ↓
          ┌──────────┼──────────┐
          ↓          ↓          ↓
     Ring buffer  Summarizer  Persistence (V2)
       cache       worker
                     ↓
                 LLM API
                     ↓
              Broadcast feed
                     ↓
            İzleyiciler (feed mode)

Ring buffer cache → İzleyiciler (raw mode)
```

### Ring buffer

In-memory, stream başına. Son N saniyelik chunk'ları tutar (default 5 dakika). Ring buffer dolduğunda eski chunk düşer.

```typescript
class StreamCache {
  private chunks: { seq: number; ts: number; data: string }[] = [];
  private maxAgeMs = 5 * 60 * 1000;
  
  push(chunk) {
    this.chunks.push(chunk);
    const cutoff = Date.now() - this.maxAgeMs;
    while (this.chunks[0]?.ts < cutoff) this.chunks.shift();
  }
  
  since(seq: number) {
    return this.chunks.filter(c => c.seq > seq);
  }
}
```

V2'de Redis Streams'a taşırsın, multi-instance için.

## Performance: batching

PTY output yüksek hacimli olabilir. Hub'a her chunk için ayrı WebSocket frame inefficient. Batching:

```typescript
const buffer: string[] = [];
let flushTimer: NodeJS.Timeout | null = null;

ptyProcess.onData((data) => {
  buffer.push(data);
  if (!flushTimer) {
    flushTimer = setTimeout(flush, 50);  // 50ms batch
  }
});

function flush() {
  if (buffer.length === 0) return;
  ws.send(JSON.stringify({
    type: 'stream_chunk',
    data: buffer.join(''),
    ts: Date.now(),
    seq: ++seq,
  }));
  buffer.length = 0;
  flushTimer = null;
}
```

50ms batching izleyici tarafında latency olarak fark edilmez, hub yükü ciddi düşer.

## Edge case'ler

**Terminal resize.** İzleyici tarafında raw mode'da yayıncı boyutunda render, scroll mevcut. Feed mode boyut bağımsız.

**Yayıncı disconnect.** Hub son chunk'ı işliyor. 30 saniye sonra `idle`, 5 dakika sonra `closed`.

**Çok fazla izleyici.** WebSocket fan-out 1K viewer'a kadar tek node makul, üstü için Redis pub/sub (V2).

## Test

Unit:
- Privacy filter regex'leri
- Batch flush logic
- Reconnect since_seq logic

Integration:
- Local hub başlat
- Mock PTY (echo) ile yayıncı simüle et
- WebSocket client ile izleyici simüle et

E2E:
- Gerçek node-pty + bash + komut zinciri
- Hub gerçek
- İzleyici gerçek
