---
name: han-architecture
description: Han projesinin mimari özeti, katman haritası, mesaj akışları, repo yapısı ve agent sahiplik haritası. Her subagent ihtiyaç duyduğunda buraya başvurur.
---

# Han Architecture Reference

## Bir cümlelik özet

Han, yayıncının terminal output'unu PTY üstünden yakalayıp WebSocket ile hub'a stream eden, hub'da AI summarizer ile özet akışı üretip izleyiciye yayınlayan, lobi/chat/oyun katmanlarıyla zenginleştirilmiş, Solana üstünde tip ve oyun ekonomisi olan bir CLI platformudur.

## Üç katman

### Runtime (`apps/runtime/`)

CLI binary. Hangi AI tool kullanılırsa kullanılsın çalışır.

İki rol:
- **Streamer mode** (`han stream [komut]`): PTY parent, output'u hub'a forward eder
- **Viewer mode** (`han connect <kod>` / `han browse`): hub'tan stream alır, render eder

Sahibi: runtime-engineer

### Hub (`apps/hub/`)

Backend. WebSocket gateway, stream router, summarizer, lobby, chat, room manager, REST API, Solana glue.

Sahibi: hub-engineer (ana). summarizer-engineer summarizer alt klasöründe, game-engineer games alt klasöründe.

### Solana (`contracts/`, `sdk/`)

Solidity contract (game escrow + attestation), TypeScript SDK (helper'lar, cüzdan abstraction).

Sahibi: contract-engineer (program), evm-client-engineer (SDK + cüzdan)

## Repo yapısı

```
han/
├── apps/
│   ├── runtime/                    # CLI binary
│   │   ├── src/
│   │   │   ├── index.ts           # entry, command router
│   │   │   ├── streamer/          # han stream
│   │   │   ├── viewer/            # han connect, han browse
│   │   │   ├── games/             # client-side oyun render
│   │   │   ├── ui/                # ink components, layout
│   │   │   ├── wallet/            # cüzdan adapter
│   │   │   └── transport/         # WebSocket client
│   │   └── package.json
│   └── hub/                       # Backend
│       ├── src/
│       │   ├── index.ts          # Fastify entry
│       │   ├── ws/               # WebSocket gateway
│       │   ├── routes/           # REST API
│       │   ├── stream/           # stream router, cache
│       │   ├── summarizer/       # özet pipeline
│       │   ├── lobby/            # lobby state
│       │   ├── chat/             # chat broker
│       │   ├── games/            # oyun state machines
│       │   ├── rooms/            # genel oda yönetimi
│       │   └── solana/           # Solana glue
│       └── package.json
│
├── contracts/
│   └── han/
│       ├── src/
│       │   ├── lib.rs
│       │   ├── instructions/
│       │   ├── state/
│       │   └── errors.rs
│       └── tests/
│
├── sdk/                            # TypeScript SDK
│   ├── src/
│   │   ├── client.ts
│   │   ├── tip.ts
│   │   ├── escrow.ts
│   │   ├── attestation.ts
│   │   ├── wallet/
│   │   └── types/
│   └── package.json
│
├── packages/
│   └── game-sdk/                   # Topluluk oyun SDK'sı (V2)
│
├── .claude/
├── Anchor.toml
├── package.json                    # pnpm workspace
└── pnpm-workspace.yaml
```

## Veri akışı: yayıncıdan izleyiciye

```
1. Yayıncı: han stream claude
2. Runtime spawn'lar claude (node-pty PTY parent)
3. Runtime hub'a WebSocket bağlanır, "register streamer"
4. Hub stream_id verir, lobby'ye ekler
5. PTY output → runtime → hub (raw stream chunk'ları)
6. Hub raw stream'i:
   a. ring buffer cache'e yazar (raw mode izleyiciler için)
   b. summarizer worker queue'ya push eder
7. Summarizer worker her N saniye:
   a. son N saniyelik raw stream'i alır
   b. son 3 özeti context'e ekler
   c. LLM çağrır
   d. özet string'i broadcast feed kanalına yayınlar
8. İzleyici: han connect <kod>
9. Runtime hub'a WebSocket bağlanır, "register viewer"
10. Hub:
    a. snapshot gönderir (son özet, viewer count, vs.)
    b. broadcast feed kanalına subscribe eder
11. İzleyici özetleri görür. /raw → raw kanalına geçer.
```

## Veri akışı: oyun

```
1. Host: han play pong --entry-fee 0.01
2. Runtime hub'a "create_room" mesajı gönderir
3. Hub:
   a. room state oluşturur
   b. anchor program'da create_game_room instruction (escrow PDA)
   c. lobby'ye oda ekler, code üretir
4. Diğer oyuncu: han play pong --join <kod>
5. Hub:
   a. Solana'da join_game (oyuncu deposit'i)
   b. room state'e player ekle
6. Host start (veya autostart minPlayers ulaşınca)
7. Game server tick başlar (Pong: 30fps)
8. Player input → runtime → hub → game server
9. Game server state update → broadcast tüm oyunculara + spectator'lara
10. Win condition → game server "settle" emit
11. Hub:
    a. anchor settle_game instruction (MetaMask/Core hub authority imzalar)
    b. attestation kayıt
    c. room state finalize
12. Tüm taraflara final state, TX hash gönderilir
```

## Mesaj formatları (WebSocket)

NDJSON, her satır bir mesaj.

### Yayıncı → Hub
```json
{ "type": "register_streamer", "auth": "...", "config": { "title": "...", "filters": [...] } }
{ "type": "stream_chunk", "data": "...", "ts": 1746..., "seq": 142 }
{ "type": "stream_end" }
```

### Hub → Yayıncı
```json
{ "type": "registered", "stream_id": "...", "code": "kz-han-7843" }
{ "type": "viewer_count", "n": 5 }
{ "type": "chat_msg", "from": "pubkey...", "text": "..." }
{ "type": "tip", "from": "pubkey...", "wei": 50000000 }
```

### İzleyici → Hub
```json
{ "type": "join", "code": "kz-han-7843", "auth": "..." }
{ "type": "switch_mode", "mode": "feed" | "raw" }
{ "type": "chat_send", "text": "..." }
{ "type": "tip", "wei": 50000000 }
```

### Hub → İzleyici
```json
{ "type": "snapshot", "stream_meta": {...}, "viewers": 5, "recent_feed": [...] }
{ "type": "feed_item", "text": "...", "ts": 1746... }
{ "type": "raw_chunk", "data": "...", "seq": 142 }
{ "type": "chat_msg", "from": "...", "text": "..." }
```

### Oyun mesajları
```json
{ "type": "game_create", "game_type": "pong", "entry_fee": 0.01 }
{ "type": "game_join", "room_id": "..." }
{ "type": "game_input", "input": { "key": "W" } }
{ "type": "game_state", "state": {...} }
{ "type": "game_end", "winner": "...", "tx": "..." }
```

## Tech stack özeti

| Katman | Tech |
|---|---|
| CLI binary | Node.js 20+, TypeScript, node-pty, ws, ink |
| Backend | Node.js, Fastify, ws, Redis (cache) |
| Summarizer LLM | Anthropic Sonnet via @anthropic-ai/sdk |
| Solidity contract | Rust, Anchor 0.30+ |
| TypeScript SDK | @solana/web3.js, Anchor TS bindings |
| Wallet | MetaMask/Core server SDK (hub authority), local keypair (CLI user) |
| Cluster | Fuji testnet → mainnet |
| Deploy | Hub: Fly.io. CLI: npm package + binary release |

## Hangi agent neyi sahiplenir

| Klasör/alan | Agent |
|---|---|
| `apps/runtime/` (genel) | runtime-engineer |
| `apps/runtime/ui/` | ui-designer |
| `apps/runtime/games/` (client) | game-engineer |
| `apps/runtime/wallet/` | evm-client-engineer |
| `apps/hub/` (genel) | hub-engineer |
| `apps/hub/summarizer/` | summarizer-engineer |
| `apps/hub/games/` (server) | game-engineer |
| `contracts/` | contract-engineer |
| `sdk/` | evm-client-engineer |
| `tests/` | qa-engineer |
| `.claude/docs/decisions/` | architect |
| Demo paketi | demo-master |

## Önemli kararlar

- **Runtime tek binary**: streamer ve viewer aynı process, mode flag ile.
- **PTY tabanlı capture**: AI tool seçiminden bağımsız.
- **Default izleyici modu özet**: izleyici context kazansın, privacy filter ek katman.
- **Solana program ince**: sadece game escrow + attestation. Tip flow program-less.
- **Hub authority MetaMask/Core delegated**: settle_game gibi authority gerektiren işlemler için.
- **V1 scope dar**: 2 oyun (Pong, Type-race), prediction market V2.
