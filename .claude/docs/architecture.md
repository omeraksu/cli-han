# Han, Mimari Dökümanı

Bu doküman Han'ın mimarisinin canlı referansı. Karar değişikliği oldukça güncellenir, ADR'lara link verilir.

## Vizyon

Han, AI ile çalışan geliştiriciler için terminal-native ambient social layer. Yayıncı kendi tool'unu (Claude Code, Cursor, Codex CLI, Aider) çalıştırır, terminal output'u Han hub'a stream olur. İzleyiciler ham akışı veya AI özetli broadcast feed'i takip eder, kendi aralarında mini-game oynar, yayıncıya tip atar. Solana üzerinde tip, escrow, attestation.

İsim, Türk-Selçuklu kervansaray geleneğinden gelir. Yolcular durur, dinlenir, başkalarıyla buluşur, sonra yola devam eder. Han bir varış değil, mola.

## Ürün hipotezi

AI bekleme süreleri yeni bir geliştirici productivity sorunu. Build/test farklı, çünkü öngörülemez (30 saniye veya 10 dakika). Developer terminalde yaşıyor ama beklerken context-switch yapıyor (Twitter, Slack, Discord), attention residue yaşıyor. Han bu boşluğu **terminalden çıkmadan** doldurur: yayıncı işine devam eder, izleyiciler oyun oynar, sosyalleşir, paylaşır.

Niş ama derin. Hedef: AI tool kullanan geliştiriciler. Türkçe-first ama global potansiyel.

## Üç katman

### Runtime (CLI binary)

`apps/runtime/`. node-pty + ws + ink üstüne kurulu Node.js TypeScript CLI. İki mod: streamer ve viewer.

**Streamer**: yayıncı `han stream [komut]` ile bir alt-shell forklar. node-pty PTY üstünden output yakalar, privacy filter geçirir, NDJSON event olarak hub'a yollar. Yayıncının kendi terminal deneyimi etkilenmez (output ekrana da yazılır), sadece arka planda yayın akar.

**Viewer**: izleyici `han browse` ile lobby'yi görür, `han connect <kod>` ile bağlanır. Default broadcast feed (özet kartları), `/raw` ile ham terminal mode. Yan panelde chat, alt çubukta oyun ve tip butonları.

### Hub (backend)

`apps/hub/`. Fastify + ws + Redis + Postgres. Stream router, summarizer pipeline, lobby, chat, game rooms, Solana client.

Yayıncıdan gelen stream:
1. Buffer'a (Redis Streams veya in-memory ring buffer)
2. İzleyicilere fanout (raw mode için)
3. Summarizer pipeline'a (broadcast feed için)
4. Postgres'e arşiv (V2 history)

Summarizer pipeline:
1. Window manager (10s sliding)
2. Pre-filter (gürültü temizliği, ANSI parse)
3. Heuristic fast-path (komut, dosya kayıtları)
4. LLM call (Anthropic Sonnet, semantic özet)
5. Post-process (JSON parse, format)
6. Privacy refilter (regex)
7. Publish (Redis pub/sub → izleyicilere)

### Programs ve SDK (Solana)

`programs/han/` Anchor program. `sdk/` TypeScript client.

Anchor program scope:
- Game escrow (create, join, settle, cancel + claim_refund, **timeout_refund**)
- Config (admin, fee receiver)
- Game attestation **SAS üstünden**, Anchor program'da değil

Tip program-less, doğrudan SystemProgram::transfer.

Attestation tamamen SAS (Solana Attestation Service) üstünden, hub authority off-chain imzalar. Anchor program tarafında attestation kodu yok. Karar: `.claude/docs/decisions/2026-05-05-sas-vs-custom-pda.md`.

SDK helper'ları runtime ve hub her ikisi de kullanır.

## İletişim akışları

### Yayıncı → Hub (stream ingest)

WebSocket NDJSON. Her satır bir JSON event:

```json
{ "v": 1, "type": "stdout", "ts": 1714564821123, "data": "Building...\n" }
{ "v": 1, "type": "stdout", "ts": 1714564821456, "data": "compiling...\n" }
{ "v": 1, "type": "command_start", "ts": 1714564822000, "command": "cargo test" }
```

Schema versioned (v: 1). Header'da auth token (session JWT).

### Hub → Yayıncı (control)

WebSocket NDJSON. Hub yayıncıya komut gönderebilir:

```json
{ "v": 1, "type": "viewer_count", "count": 5 }
{ "v": 1, "type": "new_tip", "from": "Alice", "amount": 0.05 }
{ "v": 1, "type": "chat_unread", "count": 2 }
```

### Hub → İzleyici (broadcast)

İki kanal:
- `/stream/:id` raw event'leri (raw mode için)
- `/broadcast/:id` summarizer çıkışı (default mode için)

İzleyici hangisini istiyorsa subscribe olur. `/raw` komutu ile geçiş yapar.

### İzleyici → Hub (interactions)

WebSocket veya HTTP:
- Chat mesajı (WS)
- Tip TX kayıt (HTTP POST /tips)
- Oyun room katılım (WS /game/:id)
- Lobby güncelleme talep (WS /lobby)

## Solana entegrasyonu

### Tip flow (program-less)

İzleyici `/tip 0.05` der → UI onay → wallet.signAndSend(SystemProgram.transfer) → TX confirmation → hub'a HTTP POST /tips ile bilgi → hub Postgres'e kayıt + lobby güncelle + yayıncıya WS bildirim.

### Game escrow flow

İki oyuncu odaya gelir → host stake belirler (0.01 SOL) → oyuncu1 join_game_escrow → oyuncu2 join_game_escrow → vault'ta 0.02 SOL → oyun başlar → oyun biter → hub authority settle_game(winner) → vault'tan winner'a transfer (komisyon olabilir, V1'de yok).

### Game attestation

Oyun bitince hub `getCreateAttestationInstruction` (sas-lib) ile SAS attestation atar. Hub authority imzalar. Schema: game_result (winner, game_type, score, player_count, room_id, timestamp). Attestation PDA Solana Explorer'da SAS built-in viewer ile direkt görünür.

### Refund mechanisms

İki refund yolu:
- **Host iptali**: `cancel_game` + her oyuncu `claim_refund` (host kararı)
- **Timeout refund**: Room.created_at'tan 24 saat sonra herhangi bir oyuncu `timeout_refund` ile kendi stake'ini çeker. Hub tek nokta hatasına karşı garanti.

ADR: `.claude/docs/decisions/2026-05-05-refund-timeout.md`.

### Authority

Hub bir admin keypair'e sahip (devnet'te basit, mainnet'te KMS). Bu keypair settle_game ve SAS attestation imzalar. Yayıncı/izleyici keypair'i sadece kendi para hareketlerini imzalar.

### RPC strategy

Multi-endpoint failover. Birincil `api.devnet.solana.com`, ikincil Helius devnet (env `HELIUS_RPC_URL`). Active-passive stratejisi: birincil her zaman ilk denenir, rate limit (429) veya 5xx alırsa ikinciye düşer. Hub ve runtime aynı `FailoverConnection` helper'ını kullanır. Demo günü rate limit garantisi.

ADR: `.claude/docs/decisions/2026-05-05-rpc-fallback.md`.

## State management

### Redis (live state)

- `session:<id>` session metadata, TTL 1 saat (heartbeat ile yenilenir)
- `lobby:snapshot` aktif yayınların listesi, TTL 5 dakika
- `chat:<roomId>` son 100 mesaj, TTL 24 saat
- `game:<roomId>` oyun state, in-memory only (oyun bitince Postgres'e kaydedilir)
- `stream:buffer:<sessionId>` son 30 saniyelik raw event'ler, ring buffer

### Postgres (persistence)

```sql
CREATE TABLE sessions (
  id VARCHAR(64) PRIMARY KEY,
  streamer_wallet VARCHAR(64) NOT NULL,
  started_at TIMESTAMP NOT NULL,
  ended_at TIMESTAMP,
  total_viewers INTEGER DEFAULT 0,
  total_tips_lamports BIGINT DEFAULT 0
);

CREATE TABLE chat_messages (
  id UUID PRIMARY KEY,
  session_id VARCHAR(64) REFERENCES sessions(id),
  user_wallet VARCHAR(64) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE tips (
  id UUID PRIMARY KEY,
  session_id VARCHAR(64) REFERENCES sessions(id),
  from_wallet VARCHAR(64) NOT NULL,
  to_wallet VARCHAR(64) NOT NULL,
  amount_lamports BIGINT NOT NULL,
  tx_signature VARCHAR(128) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE game_results (
  id UUID PRIMARY KEY,
  game_type VARCHAR(32) NOT NULL,
  game_id BIGINT NOT NULL,
  players JSONB NOT NULL,
  winner VARCHAR(64) NOT NULL,
  stake_lamports BIGINT NOT NULL,
  pot_lamports BIGINT NOT NULL,
  attestation_pda VARCHAR(64),
  attestation_tx VARCHAR(128),
  settled_tx VARCHAR(128),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE attestations (
  id UUID PRIMARY KEY,
  type VARCHAR(32) NOT NULL,  -- 'game_result', 'session', vs.
  payload JSONB NOT NULL,
  pda VARCHAR(64) NOT NULL,
  tx_signature VARCHAR(128) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Privacy

### Runtime tarafı (yayıncı makinesi)

Stream'i hub'a göndermeden önce regex filtre. Default pattern'lar:
- API key prefixleri (sk-, AKIA, ghp_, xoxb-)
- Email adresleri
- IP adresleri
- $HOME path (kullanıcı adı dahil)
- /tmp/ + UUID (genelde private state)

Yayıncı kendisi pattern ekleyebilir (`.han/filters.json`).

### Hub tarafı (summarizer çıkışı)

LLM özet üretirken yanlışlıkla bir secret çıkartabilir. Çıkışta ikinci regex katman aynı pattern'larla.

### Default ON

Yeni kullanıcı default privacy filter ile başlar. Opt-out manuel.

## V1 scope

- Streamer mode (han stream)
- Viewer mode (han browse, han connect, broadcast feed, raw mode)
- Public yayın (private V2)
- 2 oyun: Pong + Type-race
- Chat
- Tip flow (program-less)
- Game escrow + settle + attestation (Anchor program)
- Devnet deployment

## V2+ roadmap

- Daha çok oyun (topluluk SDK üstünden)
- Prediction market (live betting on session events)
- Private yayın, davet
- Privy wallet entegrasyonu
- Web companion app (mobile için izleme)
- Tournament mode
- Sponsor mode (yayıncıya abonelik)
- Replay (geçmiş yayınları izle)
- Mobile native client

## Önemli kararlar

- **Tool-agnostic**: PTY üstünden, hangi AI tool kullanılırsa kullansın aynı.
- **Server-authoritative oyun**: client tahmin yok, V1 latency düşük olduğu için yeterli.
- **Summarizer V1 hub LLM**: yayıncının kendi modeli V2.
- **Solana program ince**: sadece game escrow + cancel + timeout_refund. Attestation SAS, tip program-less.
- **Attestation SAS**: Custom PDA kapsam dışı. ADR 2026-05-05-sas-vs-custom-pda.
- **Hub authority delegated keypair**: settle_game ve attestation için. Mainnet'te multisig.
- **Timeout refund 24 saat**: hub down senaryosunda oyuncular fonlarını çekebilir. ADR 2026-05-05-refund-timeout.
- **Multi-RPC failover**: api.devnet.solana.com + Helius. ADR 2026-05-05-rpc-fallback.
- **V1 scope dar**: 2 oyun (Pong, Type-race), prediction market V2.
