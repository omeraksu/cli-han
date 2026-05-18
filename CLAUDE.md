# Han (Avalanche)

Terminal-native ambient social layer for AI-assisted developers, **ported to Avalanche C-Chain**. Yayıncı kendi tool'unu (Claude Code, Cursor, Codex CLI, Aider) çalıştırır, terminal output'u Han hub'a stream olur. İzleyiciler ham akışı veya AI özetli broadcast feed'i takip eder, kendi aralarında mini-game oynar, yayıncıya native AVAX tip atar. Tip atomik split bir `HanTipRouter` kontratından geçer (%3 hub komisyonu). Game escrow tek bir `Han.sol` kontratında.

**Indie product**, solo geliştirici, gelir hedefli. **Fuji testnet** odaklı V1; mainnet (C-Chain 43114) sonra. Birincil V1 gelir: **tip komisyonu %3**, on-chain split, hub manuel müdahaleye gerek yok.

## Hızlı yön

11 subagent var (`.claude/agents/`). Bir iş geldiğinde önce architect'i çağır, plan al, sonra sırayla geç.

Sık komutlar:

- `/plan <feature>` yeni iş için plan
- `/ship-feature <plan>` onaylanmış planı sırayla teslim et
- `/deploy-fuji` Fuji'ye deploy + ABI senkron
- `/prep-demo` teslim paketi
- `/review-all` ship öncesi son kontrol
- `/pty-debug` PTY veya stream sorunu
- `/stream-test` uçtan uca akış testi
- `/game-add <isim>` yeni mini-game scaffold
- `/avax-flow-test` Fuji üstünde tip ve game escrow testi

## Stack

- Runtime CLI: Node.js + TypeScript + node-pty + ws, dağıtım `npx @han/cli`
- Hub: Node.js + Fastify + ws + Redis (state) + Postgres (persistence)
- Summarizer: Anthropic API (Claude Sonnet) veya yayıncının kendi modeli
- Games: V1 sadece UI mockup (Roulette), engine V2'de — ADR `2026-05-12-game-decoupled-ui`
- UI: ink (React for terminal) + raw ANSI escape codes
- Wallet: local hex private key (Fuji), MetaMask/Core/RainbowKit V1.5
- Contracts: Foundry (Solidity 0.8.26), `contracts/`. İki kontrat:
  - `Han.sol` — game escrow + config (8 fonksiyon: initialize, updateConfig, createGameRoom, joinGame, settleGame, cancelGame, claimRefund, timeoutRefund)
  - `HanTipRouter.sol` — atomic native-AVAX tip splitter, %3 fee on-chain
- SDK: TypeScript + viem, `sdk/`
- Network: Fuji testnet birincil, mainnet hedef sonra
- Avalanche micro-economy V1: native AVAX tip, `HanTipRouter.tip()` tek imza, %3 fee receiver'a atomik. Game escrow `Han.sol` V1.5'te aktif olur.
- RPC: viem `fallback` transport (drpc, publicnode, official)

## Üç ana akış

**Yayıncı akışı** (`apps/runtime/streamer/`): yayıncı `han stream` çalıştırır, Han runtime PTY ile bir alt-shell forkluar, içinde claude/cursor/aider çalıştırılabilir. Tüm output PTY üstünden yakalanır, WebSocket ile hub'a stream edilir.

**İzleyici akışı** (`apps/runtime/viewer/`): izleyici `han browse` ile lobby'ye girer, açık yayınları görür, birine bağlanır. Default broadcast feed (özet) görür, `/raw` ile ham terminal moduna geçer. Yan panelde chat, alt çubukta oyun ve tip butonları.

**Hub akışı** (`apps/hub/`): yayıncıdan gelen stream'i alır, summarizer pipeline'a yollar, izleyicilere fanout eder, lobby state'i tutar, chat odalarını yönetir, oyun odalarını çalıştırır, Avalanche RPC ile konuşur.

## Yazım kuralları

- Em dash yok
- Kısa cümle, ortalama 8-12 kelime
- Aktif ses
- Tripling yok
- Türkçe-first proje iletişimi, teknik terimler İngilizce
- Karar verildiyse alternatif önerme

## Önemli dosyalar

- `contracts/foundry.toml` Foundry config
- `contracts/src/Han.sol`, `contracts/src/HanTipRouter.sol` kontratlar
- `contracts/script/DeployFuji.s.sol` Fuji deploy
- `sdk/abi/han.json`, `sdk/abi/hanTipRouter.json` ABI'ler
- `sdk/src/client.ts` viem `HanClient` wrapper
- `sdk/src/tip.ts` `sendTipWithFee()` üzerinden HanTipRouter çağrısı
- `apps/runtime/package.json` CLI binary entry
- `apps/hub/package.json` hub entry
- `apps/hub/src/config.ts` AVAX env schema
- `apps/hub/src/routes/tips.ts` viem receipt + event parse doğrulama
- `.claude/docs/architecture.md` mimari döküman
- `.claude/docs/decisions/` ADR'lar

## Fuji bilgileri

```
Network: Fuji testnet
Chain ID: 43113
RPC primary:  https://api.avax-test.network/ext/bc/C/rpc
RPC fallback: https://avalanche-fuji.drpc.org, publicnode
Explorer:     https://testnet.snowtrace.io
Faucet:       https://faucet.avax.network/ (2 AVAX/24h)
              https://core.app/tools/testnet-faucet/

Han contract:        <forge script DeployFuji çıktısı>
HanTipRouter:        <forge script DeployFuji çıktısı>
Fee receiver:        <hub admin wallet, ayrı address>
Hub authority:       <settle yetkisi olan ayrı address>

Sabitler (Han.sol):
- ROOM_TIMEOUT: 24 hours
- MAX_PLAYERS: 8
- MIN_ENTRY_FEE: 1e15 wei (0.001 AVAX)
- MAX_ENTRY_FEE: 10 ether (V1 koruma)
- MAX_FEE_BPS: 1000 (%10 tavan)
- TIP_FEE_BPS: 300 (%3, HanTipRouter immutable)
```

## ADR referansları

- ADR 2026-05-05-refund-timeout: 24 saat timeout sonrası `timeoutRefund` çağrılır, V1.5 zorunlu
- ADR 2026-05-05-rpc-fallback: viem `fallback` transport, multi-endpoint failover
- ADR 2026-05-12-game-decoupled-ui: Game UI V1'de Roulette mockup, engine V1.5'te
- ADR 2026-05-13-indie-product-pivot: solo indie ürün, Fuji odaklı V1, tip %3 V1 gelir
- ADR 2026-05-13-mcp-server-architecture: dual transport (raw + structured) tek hub protokolü
- ADR 2026-05-13-tip-fee-architecture: `HanTipRouter` contract pattern, atomic split
- ADR 2026-05-18-attestation-strategy: V1'de on-chain event log yeterli, V2'de EAS
- ADR 2026-05-18-solana-to-avax-port: Solana baseline'dan port rasyoneli

## Geliştirme akışı

```bash
# Geliştirme başında
pnpm install
cd contracts && forge build && forge test
cd ..

# Hub local (Postgres + Redis docker-compose ile)
docker-compose up -d
pnpm --filter @han/hub db:migrate
pnpm --filter @han/hub dev

# Runtime local (yayıncı)
pnpm --filter @han/runtime dev:streamer

# Runtime local (izleyici)
pnpm --filter @han/runtime dev:viewer

# Contract test
cd contracts && forge test -vv

# Fuji'ye deploy
/deploy-fuji   # slash command tüm adımları takip eder
```

## Git workflow

Han'da hiçbir adım commit'siz bırakılmaz. Format kuralları `han-conventions` SKILL.md'de, burada tetikleyici tanımlı.

- Her commit Conventional Commits, İngilizce, scope listesi `han-conventions`
- Tetikleyiciler:
  - Bir agent kendi paketini yeşil bitirdiğinde (build + lint + test) anında commit
  - `/ship-feature` her agent adımının sonunda otomatik commit
  - `/deploy-fuji` ABI sync sonrası `chore(sdk): sync abi`
  - `/review-all` ship-ready kararından sonra annotated tag
- Commit'i atan agent: o adımın sahibi (örn. `contracts/` değişikliğini `contract-engineer` atar)
- Final ship commit + push'u `qa-engineer` atar
- Asla `.env`, private key, secret commit'leme — `.gitignore` güncel tut
- Commit yoksa "iş bitti" denmez

## V1 sprint planı (indie product, Fuji)

| Sprint | Hedef |
|---|---|
| 1 — Hub canlı | Redis + Postgres lokal, e2e raw stream + chat |
| 2 — Tip + Streamer overlay | Fuji'de %3 komisyonlu tip, yayıncı UI |
| 3 — Profile + Onboarding | 5 Profile ekranı, first-time wizard, lobby polish |
| 4 — Polish + ilk demo | Bug fix, dokümantasyon, beta tester davet, demo video |

Mainnet V2'de. Pong + Type Race V1.5'te (game engine ile birlikte).

## Subagent listesi

| Agent | Klasör | Sorumluluk |
|---|---|---|
| architect | (planlama) | mimari karar, ADR, dispatcher |
| runtime-engineer | `apps/runtime/` | CLI binary, PTY, WebSocket transport |
| hub-engineer | `apps/hub/` | hub backend, fanout, lobby, chat |
| summarizer-engineer | `apps/hub/summarizer/` | AI özet pipeline, broadcast feed |
| game-engineer | `apps/hub/games/`, `apps/runtime/games/` | Pong, Type-race, SDK |
| ui-designer | `apps/runtime/ui/` | terminal UI, ink, ANSI, render |
| contract-engineer | `contracts/` | Solidity, Foundry, escrow + tip router |
| evm-client-engineer | `sdk/`, `apps/runtime/wallet/` | viem SDK, wallet, tip, market |
| qa-engineer | (test) | forge test, vitest, güvenlik, review |
| debug-specialist | (hata) | PTY, network, runtime, RPC hata |
| demo-master | (teslim) | video, pitch |

## Repo yapısı

```
han-avax/
├── apps/
│   ├── runtime/             CLI binary (yayıncı + izleyici)
│   │   ├── src/
│   │   │   ├── streamer/    yayıncı modu
│   │   │   ├── viewer/      izleyici modu
│   │   │   ├── games/       oyun client'ları
│   │   │   ├── ui/          ink components, ANSI render
│   │   │   ├── wallet/      viem wallet entegrasyonu
│   │   │   └── transport/   WebSocket client
│   │   └── package.json
│   └── hub/                 backend
│       ├── src/
│       │   ├── stream/      stream ingest, fanout
│       │   ├── summarizer/  AI özet pipeline
│       │   ├── lobby/       açık yayınlar
│       │   ├── chat/        chat odaları
│       │   ├── rooms/       universal room registry
│       │   ├── games/       oyun odaları, state machines
│       │   ├── routes/      HTTP endpoint'ler (tips, sessions, config, …)
│       │   └── ws/          WebSocket gateway + handlers
│       ├── prisma/          schema + migrations
│       └── package.json
├── contracts/               Foundry project
│   ├── src/
│   │   ├── Han.sol
│   │   ├── HanTipRouter.sol
│   │   ├── interfaces/
│   │   └── libraries/
│   ├── test/
│   ├── script/
│   ├── foundry.toml
│   └── lib/                 (gitignored, forge install)
├── sdk/                     TypeScript SDK
│   ├── src/
│   ├── abi/
│   └── package.json
├── packages/
│   └── mcp-server/          @han/mcp — Claude Code/Cursor/Aider için MCP
├── scripts/                 e2e smoke testleri (tip, game-escrow)
├── .claude/                 Claude Code yapılandırması
├── package.json             (workspace root)
└── pnpm-workspace.yaml
```
