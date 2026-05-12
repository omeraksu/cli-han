---
name: han-summarizer
description: Han'ın broadcast feed üretim pipeline'ı, prompt template'leri, model seçimi, maliyet ve latency yönetimi. summarizer-engineer için ana referans.
---

# Han Summarizer Reference

## Felsefe

İzleyici ham terminal output'u okumak için zaman harcamamalı. Han bir AI commentator gibi davranır: yayıncının ne yaptığını izleyici-dostu cümleler halinde özetler. Sürekli, kısa, anlaşılır.

Bu kategori henüz olgunlaşmamış. Sektörde sports commentary AI ve Twitch VOD recap var. Live coding stream commentary tam olarak yok. Han ilk denemelerden biri.

## Pipeline mimarisi

```
Stream chunks → Window aggregator → Heuristic filter → LLM call → Feed item
                       ↓                   ↓               ↓
                   Last N sec        Skip if quiet    Cache + dedup
```

### Window aggregator

Her N saniyede bir (default 12s, configurable):

1. Son N saniyelik raw stream chunk'larını birleştir
2. ANSI escape sequence'leri temizle
3. Privacy filter ikinci kez uygula (extra layer)
4. Eğer hiç content yoksa → çağrı yapma

### Heuristic filter

Bazı durumları LLM'siz yakala:

```typescript
const heuristics = [
  { pattern: /tests? failed/i, summary: '⚠ Tests failing' },
  { pattern: /tests? passed|all green/i, summary: '✓ Tests passing' },
  { pattern: /build (success|complete)/i, summary: '✓ Build successful' },
  { pattern: /error:.+?$/im, capture: true, prefix: '⚠ Error: ' },
  { pattern: /^\$\s+(.+)$/m, capture: true, prefix: '$ ' },
];
```

### LLM call

Default model: Claude Sonnet 4.6 (veya en güncel Sonnet).

Düşük temperature (0.3), kısa output (max 80 token), single-shot.

#### Prompt template (Türkçe)

```
[SYSTEM]
Sen Han adlı bir terminal yayını commentator'usun.
Yayıncı: AI ile çalışan bir geliştirici (Claude Code, Cursor, Aider gibi).
İzleyici: teknik bilgili biri ama yayını yeni açtı, hızlıca anlamak istiyor.

Görev: son birkaç saniyelik terminal akışına bak, geçmiş özetlere bak,
şu an ne olduğunu 1-2 kısa cümleyle anlat.

Stil:
- Kısa cümle (8-12 kelime)
- Ham komut adlarını "yarn build" gibi yazma, "build çalıştı" de
- Anlatım odaklı
- Em dash yok, tripling yok, aktif ses
- Geçmiş özetlere bağlan ("hala", "yeni hipotez", "sonuç")
- Türkçe yaz

Asla:
- Tüm output'u kelime kelime tekrar etme
- Dosya yollarını veya hassas bilgiyi gösterme
- Boş cümle (kuru "kod yazıyor" gibi)

[USER]
Recent terminal output (son {N}s):
{raw_stream}

Recent feed history (son 3 özet):
{recent_summaries}

Şu an ne oluyor?
```

#### Prompt template (İngilizce)

Aynı template'in İngilizce versiyonu.

### Output processing

LLM cevabı:
1. Trim, max 200 char
2. Eğer son özetle benzerse skip (dedup)
3. Feed item:

```json
{
  "id": "feed_<seq>",
  "ts": 1746542130123,
  "text": "Postgres pool yapılandırması inceleniyor.",
  "type": "summary",
  "raw_window": [seq_start, seq_end]
}
```

Type alanı:
- `summary` LLM-generated
- `event` heuristic-detected
- `command` shell command detected
- `system` Han'ın kendisi

## Aggressiveness levels

| Level | Interval | Behavior |
|---|---|---|
| `low` | 30s | Sadece anlamlı değişiklik varsa |
| `medium` (default) | 12s | Heuristic'ler arada anlık |
| `high` | 5s veya event-driven | Sürekli akış |
| `manual` | yok | Sadece yayıncı `/summarize` derse |

## Maliyet kontrolü

Sonnet 4.6: ~$3/M input, ~$15/M output

Bir özet çağrısı:
- Input: ~600 token
- Output: ~60 token
- Maliyet: ~$0.003 per call

Medium aggressiveness: 5 call/dakika = ~$0.9/saat

Düşürme stratejileri:
1. Heuristic filter agresif tut
2. Idle detection: stream sessizse çağırma
3. Cache: aynı son 30 saniye için bir önceki özeti kullan
4. Haiku'ya düş (low aggressiveness için yeterli)

## Latency hedefleri

- Heuristic filter: <10ms
- LLM call: 1-2 saniye
- Total feed_item delivery: <3 saniye target

## Privacy

LLM'e giden context'te bile hassas bilgi olmasın. Üç kontrol:

1. Yayıncı tarafı regex filter (runtime)
2. Hub default filter (extra katman)
3. LLM prompt'unda "asla dosya yolu veya hassas bilgi gösterme" instruction

## Test

### Fixture-based

`fixtures/` klasöründe gerçek stream örnekleri. Her fixture için expected output range. LLM yanıtı deterministik değil ama "şu kavramı içermeli" gibi semantic check.

### Live test

Local hub + summarizer + bir terminal yayıncısı. Manuel oturup gerçek kod yaz, izleyici akışını izle. Demo'dan önce mutlaka.

## Hata case'leri

- LLM API down → heuristic-only mode'a fallback
- Rate limit → exponential backoff, queue
- Timeout (5s) → o segmenti skip et
- Output parse hatası → retry bir kez, başarısızsa skip
