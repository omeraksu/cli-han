# Han — Proje Handoff Dökümanı

> Bu doküman bağımsız bir context paketidir. Başka bir Claude oturumuna yapıştırınca proje hakkında tam görüş edinir.
> Tarih: 2026-05-12. Cluster: devnet. Hedef: Solana Frontier Hackathon submission.

---

## 1. Vizyon

**Han** = Terminal-native ambient social layer for AI-assisted developers.

Yayıncı kendi AI tool'unu (Claude Code, Cursor, Codex CLI, Aider) çalıştırır. Terminal output PTY üstünden yakalanır, WebSocket ile Han hub'a stream olur. İzleyiciler:

- **Raw mode**: ham terminal output, ANSI passthrough
- **Broadcast feed**: AI özetli kart akışı (default)
- **Chat**: yayın başına bir oda
- **Mini-games**: Pong, Type-race — Solana escrow ile stake
- **Tip**: yayıncıya doğrudan SOL transferi

Kazanan **attestation** SAS (Solana Attestation Service) üstünden zincirleştirilir.

İsim: Türk-Selçuklu kervansaray geleneği — yolcular durur, dinlenir, devam eder. Han bir varış değil, mola.

### Ürün hipotezi

AI bekleme süreleri (`cargo build`, `pnpm test`, `claude` yanıtı) developer'ı context-switch'e itiyor. Twitter, Slack, Discord — attention residue. Han bu boşluğu **terminalden çıkmadan** doldurur.

Hedef: Türkçe-first niş, global potansiyel.

---

## 2. Stack

| Katman | Teknoloji |
|---|---|
| Runtime CLI | Node.js 20+ + TypeScript + `node-pty` + `ws` + `ink` |
| Hub backend | Fastify + `ws` + Redis (live state) + Postgres + Prisma |
| Summarizer | Anthropic API (Claude Sonnet) — provider abstraction, swap-friendly |
| Games | Server-authoritative state machine, 30Hz tick, WS fanout |
| UI | `ink` (React for terminal) + raw ANSI escape codes |
| Wallet | V1: local keypair (`~/.config/solana/id.json`). V2: Privy embedded |
| Programs | Anchor (Rust), `programs/han/` — sadece game escrow + refund |
| SDK | TypeScript, `sdk/` — IDL-driven + helper'lar |
| Attestation | SAS via `sas-lib`, **Anchor program dışı** |
| Tip | **Program-less**, doğrudan `SystemProgram::transfer` |
| RPC | Multi-endpoint failover: `api.devnet.solana.com` (birincil) + Helius (ikincil) |
| Dağıtım | `npx @han/cli` (V1), bağımsız binary V2 (`pkg`/`nexe`) |

---

## 3. Üç katmanlı mimari

### A. Runtime (`apps/runtime/`)

İki mod aynı binary'de.

**Streamer (`han stream [komut]`)**
1. CLI argümanları parse, default `$SHELL` veya argv komutu
2. Hub'a HTTP `POST /sessions` → session ID + WS URL
3. WebSocket bağlantısı kur
4. `node-pty.spawn` ile alt-shell aç
5. PTY `data` event → privacy filter → NDJSON event → hub WS
6. Aynı output yayıncının kendi terminaline yazılır
7. Status bar (alt çubuk): izleyici sayısı, son tip, chat indicator
8. `Ctrl+C` / exit handle

**Viewer (`han browse` / `han connect <code>`)**
1. `han browse` → HTTP `GET /sessions` → lobby kart listesi
2. `han connect <id>` → WS bağlantısı + default broadcast feed mode
3. Slash komutlar: `/raw`, `/chat`, `/play pong`, `/play type`, `/tip`, `/quit`
4. Split layout: sol stream/feed, sağ chat, alt status

### B. Hub (`apps/hub/`)

Tek monolit Fastify, içinde router.

```
apps/hub/src/
├── stream/      ingest, ring buffer, fanout
├── summarizer/  pipeline (window → filter → LLM → publish)  ← EKSİK
├── lobby/      açık yayınlar state'i (Redis)
├── chat/       chat odaları, rate limit
├── games/      Pong + Type-race state machines           ← EKSİK
├── solana/     Anchor client wrapper, tip verify         ← EKSİK
├── ws/         gateway, router, handlers
└── routes/     HTTP: /sessions, /tips
```

### C. Programs + SDK

**Anchor program (`programs/han/`)** — sadece game escrow:
- `initialize_config`, `update_config`
- `create_game_room`, `join_game`, `settle_game`
- `cancel_game`, `claim_refund`, `timeout_refund`

**SDK (`sdk/`)** — TypeScript helper'lar:
- `createGameRoom`, `joinGame`, `settleGame`
- `cancelGame`, `claimRefund`, `timeoutRefund`
- `sendTip` (program-less)
- `attestGameResult`, `fetchGameAttestation` (SAS via `sas-lib`)
- `FailoverConnection` (multi-RPC)
- Error class hierarchy: `HanError → EscrowError | TipError | AttestationError | WalletError | RpcError`

---

## 4. Mesaj akışları

### Stream ingest (yayıncı → hub)

WebSocket, NDJSON, her satır bir JSON event:

```json
{ "v": 1, "type": "stdout", "ts": 1714564821123, "data": "Building...\n" }
{ "v": 1, "type": "command_start", "ts": 1714564822000, "command": "cargo test" }
{ "v": 1, "type": "command_end", "ts": 1714564855000, "exit_code": 0 }
```

Header'da session JWT.

### Hub → yayıncı (control)

```json
{ "v": 1, "type": "viewer_count", "count": 5 }
{ "v": 1, "type": "new_tip", "from": "Alice", "amount": 0.05 }
{ "v": 1, "type": "chat_unread", "count": 2 }
```

### Hub → izleyici

İki ayrı kanal:
- `/stream/:id` raw event'ler (raw mode için)
- `/broadcast/:id` summarizer JSON çıktısı (default mode)

### Summarizer pipeline (özet üretimi)

```
window manager (10s sliding)
  → pre-filter (ANSI parse, gürültü temizliği)
  → heuristic fast-path (komut/dosya event'leri için LLM'siz)
  → LLM call (Anthropic Sonnet, max 1024 token output)
  → post-process (JSON parse, validate, fallback)
  → privacy refilter (regex 2. katman)
  → publish (Redis pub/sub → izleyiciler)
```

Çıktı formatı:

```json
{
  "ts": 1714564821000,
  "headline": "Bob is debugging a Rust async runtime issue",
  "actions": ["ran cargo test", "edited src/runtime.rs"],
  "current_focus": "investigating tokio task scheduling",
  "duration_in_state": "23 minutes",
  "mood": "stuck"
}
```

**Maliyet hedefi:** medium mode (10s window) ≈ 360 LLM call/saat → ~$1.20/saat (Sonnet). Tier sınırı aşılırsa heuristic-only fallback.

**Mode seçenekleri:** `off` / `low` (30s) / `medium` (10s, default) / `high` (5s, komut sonrası).

---

## 5. Solana ekonomisi

### Tip flow (program-less)

```
viewer /tip 0.05
  → UI onay diyaloğu (miktarı doğrula)
  → wallet.signAndSend(SystemProgram.transfer(viewer → streamer, 0.05 SOL))
  → TX confirmation
  → HTTP POST /tips { sessionId, txSignature, amount }
  → hub doğrular: RPC.getTransaction(sig), transfer amount eşleşiyor mu
  → Postgres'e kayıt + lobby güncelle + yayıncıya WS bildirim
```

### Game escrow flow

```
host create_game_room(roomId, gameType, entryFee, maxPlayers)
  → vault PDA yaratılır
player1 join_game(roomId)  → vault'a entryFee transfer
player2 join_game(roomId)  → vault'a entryFee transfer
... (max maxPlayers)
[oyun oynanır, server-authoritative state machine]
hub settle_game(roomId, winner)
  → vault'tan winner'a tüm pot transfer
  → vault PDA kapatılır
  → SAS attestation atılır (game_result schema)
```

### Refund mekanizmaları (V1 ZORUNLU)

İki yol:
1. **Host iptali**: `cancel_game` (host) → her oyuncu `claim_refund`
2. **Timeout refund** (trustless): Room.created_at + 24 saat sonra herhangi bir oyuncu `timeout_refund` ile kendi stake'ini çeker

Hub down senaryosunda oyuncular para alabilir → kullanıcı güveni. ADR: `2026-05-05-refund-timeout`.

### PDA tasarımı

```rust
seeds = [b"config"]                                          // global config
seeds = [b"room", room_id.to_le_bytes().as_ref()]           // room metadata
seeds = [b"vault", room_id.to_le_bytes().as_ref()]          // SOL holder
```

Attestation PDA'ları SAS tarafında, Han program dışı.

### Attestation (SAS)

Anchor program'da yok. `sas-lib` paketi ile:
1. Setup: `npx tsx scripts/setup-sas.ts` → Credential PDA + Schema PDA yaratılır, `.env`'e yazılır
2. Game biter → hub authority `getCreateAttestationInstruction` çağırır
3. Schema: `game_result` (winner, game_type, score, player_count, room_id, timestamp)
4. Solana Explorer SAS built-in viewer ile attestation görünür

ADR: `2026-05-05-sas-vs-custom-pda` — custom Anchor attestation kapsam dışı.

### Sabitler

```rust
pub const ROOM_TIMEOUT_SECONDS: i64 = 86400;        // 24 saat
pub const MAX_PLAYERS: u8 = 8;
pub const MIN_ENTRY_FEE: u64 = 1_000_000;           // 0.001 SOL
pub const MAX_ENTRY_FEE: u64 = 10_000_000_000;      // 10 SOL (V1 koruma)
```

### Hub authority

Hub bir admin keypair'e sahip. Devnet'te basit dosya, mainnet'te KMS / multisig. `settle_game` ve SAS attestation imzalar. Yayıncı/izleyici keypair'leri sadece kendi para hareketleri için.

### RPC failover

`FailoverConnection` helper. Birincil `api.devnet.solana.com`, ikincil Helius (`HELIUS_RPC_URL`). Active-passive: birincil her zaman ilk, 429/5xx → ikinciye geç. Hub ve runtime aynı helper'ı kullanır.

ADR: `2026-05-05-rpc-fallback`.

---

## 6. State management

### Redis (live)

| Key | İçerik | TTL |
|---|---|---|
| `session:<id>` | session metadata | 1 saat, heartbeat ile yenilenir |
| `lobby:snapshot` | açık yayın listesi | 5 dakika |
| `chat:<roomId>` | son 100 mesaj | 24 saat |
| `game:<roomId>` | oyun state | in-memory, sonra Postgres |
| `stream:buffer:<sessionId>` | son 30sn raw event | ring buffer |

### Postgres (persistence)

```sql
sessions (id, streamer_wallet, started_at, ended_at, total_viewers, total_tips_lamports)
chat_messages (id, session_id, user_wallet, content, created_at)
tips (id, session_id, from_wallet, to_wallet, amount_lamports, tx_signature, created_at)
game_results (id, game_type, game_id, players JSONB, winner, stake_lamports, pot_lamports, attestation_pda, attestation_tx, settled_tx, created_at)
attestations (id, type, payload JSONB, pda, tx_signature, created_at)
```

---

## 7. Privacy

### Runtime tarafı (yayıncı makinesi)

Stream'i hub'a göndermeden önce regex filtre. Default pattern'lar:
- API key prefix'leri (`sk-`, `AKIA`, `ghp_`, `xoxb-`)
- Email adresleri
- IP adresleri
- `$HOME` path (kullanıcı adı dahil)
- `/tmp/` + UUID

Yayıncı kendi pattern'larını `.han/filters.json`'a ekleyebilir.

### Hub tarafı (summarizer çıkışı)

LLM yanlışlıkla secret çıkarabilir. Çıkışta aynı regex katmanı tekrar uygulanır.

**Default ON.** Opt-out manuel.

---

## 8. Repo yapısı

```
han/
├── apps/
│   ├── runtime/                  CLI binary (yayıncı + izleyici)
│   │   ├── src/
│   │   │   ├── streamer/         PTY + WS ingest
│   │   │   ├── viewer/           lobby + session
│   │   │   ├── games/            oyun client'ları           ← EKSİK
│   │   │   ├── ui/               ink components
│   │   │   ├── wallet/           keypair + sign            ← EKSİK
│   │   │   └── transport/        WS client
│   │   └── package.json
│   └── hub/                      backend
│       ├── src/
│       │   ├── stream/           ingest, fanout
│       │   ├── summarizer/       AI pipeline               ← EKSİK
│       │   ├── lobby/            state
│       │   ├── chat/             broker
│       │   ├── games/            state machines            ← EKSİK
│       │   ├── solana/           Anchor + SAS client       ← EKSİK
│       │   ├── routes/           HTTP
│       │   └── ws/               gateway, router
│       └── package.json
├── programs/han/                 Anchor program
│   ├── src/
│   │   ├── instructions/         (create/join/settle/cancel/refund/timeout/config)
│   │   ├── state/                (game_room, config)
│   │   ├── errors.rs
│   │   ├── constants.rs
│   │   └── lib.rs                declare_id! burada
│   └── Cargo.toml
├── sdk/                          TypeScript SDK
│   ├── src/                      (escrow, tip, attestation, rpc-client, errors, client)
│   ├── idl/                      IDL kopyası
│   └── package.json
├── scripts/                      setup-sas.ts, test-tip.ts vs
├── .claude/                      agentic yapı (aşağıda detay)
├── Anchor.toml                   program ID + cluster
├── package.json                  pnpm workspace root
└── pnpm-workspace.yaml
```

---

## 9. AGENTIC YAPI

Han'ın iş yapma şekli. Her şey `.claude/` altında yapılandırıldı.

### 9.1 Subagent'lar (11)

`.claude/agents/<isim>.md` — her birinin klasör sahipliği net, sınırlar sıkı.

| Agent | Klasör | Sorumluluk | Scope |
|---|---|---|---|
| **architect** | (planlama) | Mimari karar, ADR, dispatcher, plan yazımı | `architect` |
| **anchor-engineer** | `programs/` | Anchor program (Rust), PDA, instruction'lar, account validation | `programs` |
| **solana-client-engineer** | `sdk/`, `apps/runtime/wallet/` | TS SDK, IDL refresh, wallet, tip, escrow client, SAS attestation | `sdk`, `wallet` |
| **hub-engineer** | `apps/hub/` (summarizer + games hariç) | Fastify HTTP/WS, stream ingest+fanout, lobby, chat, persistence | `hub` |
| **summarizer-engineer** | `apps/hub/summarizer/` | Broadcast feed AI pipeline, LLM provider, prompt template'leri, cost | `summarizer` |
| **game-engineer** | `apps/hub/games/`, `apps/runtime/games/` | Server-authoritative state machines, Pong, Type-race, SDK | `games` |
| **runtime-engineer** | `apps/runtime/` (ui+wallet+games hariç) | CLI binary, PTY capture, WS transport, streamer+viewer mod | `runtime` |
| **ui-designer** | `apps/runtime/ui/` | ink components, ANSI render, layout, renk paleti, status bar | `ui` |
| **qa-engineer** | (test) | Anchor test, vitest, oyun simülasyonu, e2e stream akışı, security review, **final ship commit + push + tag** | review/release |
| **debug-specialist** | (hata) | PTY sorunları, WS hataları, summarizer pipeline hataları, Anchor error trace, devnet sorunları | bug fixing |
| **demo-master** | (teslim) | Hackathon submission, demo video, pitch deck, marketing copy | release |

**Sınır kuralı:** her agent sadece kendi klasörünü değiştirir. Interface değişiyorsa architect'e bildirir, gerekirse ADR yazılır.

### 9.2 Slash komutlar (9)

`.claude/commands/<isim>.md` — workflow otomasyonu.

| Komut | Ne yapar | Kullanım |
|---|---|---|
| `/plan <feature>` | Architect'i çağır, yapılandırılmış plan üret | yeni iş başlangıcı |
| `/ship-feature <plan>` | 10 adımlık delivery chain (anchor → sdk → hub → summarizer → games → runtime → ui → qa → test → commit+push) | plan onaylandıktan sonra |
| `/deploy-devnet` | `anchor build` + deploy + IDL sync + SAS setup + RPC failover check + smoke test | devnet'e çıkış |
| `/prep-demo` | Hackathon teslim paketi | submission haftası |
| `/review-all` | 11 katmanda review (runtime, hub, summarizer, games, anchor, sdk, ui, qa, demo-master) + ship-ready kararı + annotated tag | ship öncesi |
| `/pty-debug` | PTY/stream sorunlarına debug-specialist | hata anında |
| `/stream-test` | Yayıncı → hub → izleyici uçtan uca akış testi | smoke test |
| `/game-add <isim>` | Yeni mini-game scaffold | yeni oyun eklemek |
| `/solana-flow-test` | Devnet üstünde tip + escrow + attestation flow testi | on-chain integrity |

### 9.3 Han-özel skill'ler (`.claude/skills/`, 7 adet)

| Skill | İçerik |
|---|---|
| `han-architecture` | Han mimarisinin katman haritası, mesaj akışları, agent sahiplik |
| `han-conventions` | Yazım, naming, **Conventional Commits + scope listesi**, error handling, test, file size, imports |
| `han-pty-streaming` | PTY yakalama, WS transport, raw stream protokolü, NDJSON event schema |
| `han-solana-economy` | PDA seed'leri, escrow logic, attestation pattern'leri, tip flow, hub authority, fee model |
| `han-summarizer` | Pipeline detayı, prompt template'leri, model seçimi, maliyet ve latency yönetimi |
| `han-game-protocol` | State machine yapısı, server/client protokol, oyun SDK, Pong + Type-race spec |
| `han-terminal-ui` | ANSI escape sequences, ink component pattern'leri, layout sistemi, renk paleti |

### 9.4 Global solana-new skill router

`~/.claude/skills/SKILL_ROUTER.md` — kullanıcının harness'inde install edilmiş `solana-new` skill koleksiyonu. Han için sabit yolculuk:

| Faz | Skill | Trigger phrase | Han için ne yapar |
|---|---|---|---|
| Denetle | `review-and-iterate` | "review my code", "audit" | Hub + runtime + SDK + Anchor denetimi, P0/P1 listesi |
| Hata kov | `debug-program` | "transaction failed", "stuck" | Anchor instruction simulate, error trace |
| Güvenliği sıkıla | `cso` | "security audit", "OWASP" | Secrets + supply chain + skill manifest + OWASP |
| Karşılaştır | `colosseum-copilot` | "winner patterns" | 5.4K Colosseum projesinde farklılaşma boşluğu |
| Mainnet hazırlığı | `deploy-to-mainnet` | "deployment checklist" | Devnet→mainnet runbook |
| Pitch | `create-pitch-deck` | "pitch deck", "slides" | 5dk pitch + slide şablonu |
| Submit | `submit-to-hackathon` | "submission", "demo video" | Solana Frontier form + demo video script |

Skill çağırma router'daki trigger phrase'leri ile otomatik — isim verme zorunlu değil.

### 9.5 Hook'lar

`.claude/hooks/post-tool.json` — tool sonrası tetikleyiciler:

- `anchor build success` → "programs/ değiştiyse commit at" notify
- `anchor test failure` → debug-specialist'e delegate
- `pnpm test failure` → debug-specialist'e delegate
- `pnpm * test success` → "commit at" notify
- `vitest success` → "commit at" notify
- `Edit programs/**/*.rs success` → "anchor build + IDL refresh hatırlatma"
- `Edit sdk/idl/*.json success` → "TS type refresh"
- `Edit apps/runtime/src/transport/** success` → "hub-engineer ile koordine"
- `git commit success` → "Conventional Commits format kontrolü"

`.claude/hooks/pre-tool.json` da var.

### 9.6 ADR'lar

`.claude/docs/decisions/`:
- `2026-05-05-sas-vs-custom-pda` — attestation SAS üstünden, custom Anchor kapsam dışı
- `2026-05-05-refund-timeout` — 24h timeout sonrası trustless refund, V1 zorunlu
- `2026-05-05-rpc-fallback` — multi-endpoint failover, Helius backup

---

## 10. Git workflow + commit disiplini

**Han'da hiçbir adım commit'siz bırakılmaz.** Format kuralları `han-conventions/SKILL.md`, tetikleyici `CLAUDE.md` "Git workflow" bölümünde.

### Conventional Commits

```
feat(runtime): add stream session creation
fix(hub): correct WebSocket reconnect backoff
docs(architecture): clarify summarizer pipeline stages
chore(deps): bump node-pty to 1.0.0
test(games): add pong tick determinism test
feat(programs): implement game escrow settlement
chore(programs): sync idl after devnet deploy
chore(release): ship summarizer-v1
```

### Scope listesi

`runtime` · `hub` · `summarizer` · `games` · `ui` · `wallet` · `programs` · `sdk` · `docs` · `infra` · `claude`

### Tetikleyiciler

- Bir agent kendi paketini yeşil bitirdiğinde (build + lint + test) → anında commit
- `/ship-feature` her agent adımının sonunda otomatik commit
- `/deploy-devnet` IDL kopyasından sonra `chore(programs): sync idl`
- `/review-all` ship-ready kararından sonra annotated tag (`v0.x.0`) + `git push --tags`

### Commit kim atar

- O adımın sahibi agent (örn. `programs/` değişikliğini `anchor-engineer` atar)
- **Final ship commit + push'u `qa-engineer` atar**
- Asla `.env`, keypair, secret commit'lenmez — `.gitignore` güncel tut

### Geliştirme prensipleri (8+1 madde)

1. **Plan mode disiplini** — yeni iş `/plan`, kod onaysız yazılmaz
2. **Subagent delegation** — 11 agent, sınırlar sıkı, ben dispatcher
3. **ADR for divergence** — konvansiyondan sapma `.claude/docs/decisions/`
4. **Türkçe-first iletişim, İngilizce kod** — commit/log/error İngilizce
5. **Privacy & speed first** — 1 saniye gecikme yayın deneyimini bozar
6. **Don't add what task doesn't need** — bug fix yanına refactor yapma
7. **Trust internal code, validate boundaries** — sadece dış sınırlarda validate
8. **No half-finished implementations** — yarım feature merge edilmez
9. **Her yeşil adımda commit** — build + test geçti → Conventional Commit at

---

## 11. Devnet bilgileri

```
Cluster: devnet
RPC (birincil): https://api.devnet.solana.com
RPC (ikincil, fallback): Helius devnet (env HELIUS_RPC_URL)

Han Program ID: D7pgqFkNXvHPGocEknUgKHrGjwtNZfsQBQ6ey9xXYXfD  (Anchor.toml)
Hub Authority: <henüz set edilmedi, hub admin keypair pubkey>

SAS Credential PDA: <setup-sas.ts çıktısı, .env'e yazılacak>
SAS Schema PDA (game_result): <setup-sas.ts çıktısı>

Han hub URL (local dev): http://localhost:3000
Han hub URL (devnet demo): tbd

Sabitler:
- ROOM_TIMEOUT_SECONDS: 86400 (24 saat)
- MAX_PLAYERS: 8
- MIN_ENTRY_FEE: 0.001 SOL
- MAX_ENTRY_FEE: 10 SOL (V1 koruma)
- LLM cost ceiling: ~$2-3/saat/yayın (medium mode)
```

---

## 12. Şu anki durum (2026-05-12)

### Hazır (build geçiyor)

- ✅ Anchor program: tüm instruction'lar yazılı (`create_game_room`, `join_game`, `settle_game`, `cancel_game`, `claim_refund`, `timeout_refund`, `initialize_config`, `update_config`)
- ✅ SDK: `escrow`, `tip`, `attestation`, `rpc-client`, `errors`, `client`, `wallet/local-keypair` — derleniyor
- ✅ Hub backend: stream cache + fanout, lobby state, chat broker, ws gateway/router/handlers, sessions + tips routes — derleniyor
- ✅ Runtime CLI: `han stream | browse | connect` komutları, streamer (PTY + privacy filter), viewer (lobby + session), ink UI (Lobby, BroadcastFeed, RawStream, StatusBar) — derleniyor
- ✅ Git workflow + commit disiplini konfigürasyonu (yeni eklendi)

### Eksik

- ❌ `apps/hub/src/summarizer/` — AI pipeline yok
- ❌ `apps/hub/src/games/` — Pong + Type-race state machines yok
- ❌ `apps/hub/src/solana/` — hub'ın Anchor client/SAS bağı yok (tips route on-chain doğrulama yapmıyor)
- ❌ `apps/runtime/src/games/` — oyun client'ları yok
- ❌ `apps/runtime/src/wallet/` — wallet entegrasyonu yok
- ❌ Devnet'e deploy yapılmamış
- ❌ SAS setup script çalıştırılmamış (`scripts/setup-sas.ts` çıktıları yok)
- ❌ `.env` yok (sadece `.env.example`)
- ❌ Anchor test'leri yok (`programs/han/tests/` boş)
- ❌ SDK ve hub vitest test'leri yok
- ❌ Hiç commit yok (`master` branch boş)

### Bilinen ek sorunlar

- `files.zip` (68KB) repo kökünde — `.gitignore`'a eklenmeli, yanlışlıkla commit'lenmemeli
- `.env.example` permission `0600` — read denied bazı bağlamlarda

---

## 13. V1 vs V2

### V1 scope (hackathon submission)

- Streamer mode (`han stream`)
- Viewer mode (`han browse`, `han connect`, broadcast feed, raw mode)
- Public yayın
- 2 oyun: Pong + Type-race
- Chat (yayın başına)
- Tip flow (program-less)
- Game escrow + settle + SAS attestation
- Devnet deployment
- Local keypair wallet

### V2+ roadmap

- Topluluk oyun SDK (manifest + server.ts + client.ts plug-in)
- Prediction market (live betting on session events)
- Private yayın, davet
- Privy embedded wallet
- Web companion app (mobile için izleme)
- Tournament mode
- Sponsor / abonelik
- Replay (geçmiş yayınları izle)
- Mobile native client

---

## 14. Sık komutlar

```bash
# Geliştirme başında
pnpm install
anchor build

# Hub local
pnpm --filter @han/hub dev

# Runtime local (yayıncı)
pnpm --filter @han/runtime dev:streamer

# Runtime local (izleyici)
pnpm --filter @han/runtime dev:viewer

# Anchor test (ileride)
anchor test --skip-deploy

# Devnet'e deploy
/deploy-devnet           # slash command, tüm adımları takip eder

# Hackathon teslim haftası
/prep-demo
/review-all              # ship-ready ise annotated tag atar
```

---

## 15. Yazım kuralları (CLAUDE.md'den)

- Em dash yok
- Kısa cümle, ortalama 8-12 kelime
- Aktif ses
- Tripling yok
- Türkçe-first proje iletişimi, teknik terimler İngilizce
- Karar verildiyse alternatif önerme
- Adjective yığma yok ("revolutionary", "amazing", "powerful")

---

## 16. Bir başka Claude oturumu için kısa direktif

Eğer bu dosyayı yapıştırdığın oturuma "şu işi yap" diyeceksen, Claude'un şunları yapması beklenir:

1. **Her iş başında** `/plan <feature>` ile architect'i çağır, plan onaysız kod yazma
2. **Subagent'a delegate et** — kendi klasörü olan agent'a iş ver (anchor → `anchor-engineer`, hub → `hub-engineer`, vb.)
3. **Her yeşil adımda commit** — Conventional Commits, scope listesi yukarıda
4. **`/ship-feature` zincirini kullan** — 10 adımlık delivery, qa final ship'i atar
5. **Devnet deploy = `/deploy-devnet`** — IDL sync, SAS setup, RPC failover dahil
6. **Solana-new skill'leri kullan** — `review-and-iterate`, `cso`, `colosseum-copilot`, `submit-to-hackathon` faz başlangıçlarında otomatik tetiklenir
7. **Hiç commit yoksa "iş bitti" denmez** — her oturum sonunda `git log --oneline` bekle

Repo kökü: `/Users/omeraksu/https/han/`
CLAUDE.md: tam proje rehberi
HAN_HANDOFF.md: bu dosya, kondanse versiyon

---

*Doküman bitti. Sorular için CLAUDE.md, `.claude/docs/architecture.md`, `.claude/docs/decisions/*` ve `.claude/skills/han-*` referans noktalarıdır.*
