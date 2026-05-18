# Han

Terminal-native ambient social layer for AI-assisted developers. Yayıncı kendi tool'unu (Claude Code, Cursor, Codex CLI, Aider) çalıştırır, terminal output'u Han hub'a stream olur. İzleyiciler ham akışı veya AI özetli broadcast feed'i takip eder, kendi aralarında mini-game oynar, yayıncıya tip atar. Kazanan attestation Solana'ya yazılır.

**Indie product**, solo geliştirici, gelir hedefli. **Devnet** odaklı V1; mainnet V2 sonrası (kullanıcı kararı). Birincil V1 gelir: **tip komisyonu %3**. Hackathon submission'ı (12 May 2026) artık başlangıç noktası, gönderim değil. Detay: ADR `2026-05-13-indie-product-pivot`.

## Hızlı yön

Bu projede 11 subagent var (`.claude/agents/`). Her birinin sorumluluk alanı net. Bir iş geldiğinde önce architect'i çağır, plan al, sonra sırayla adımları geç.

Sık komutlar:

- `/plan <feature>` yeni iş için plan
- `/ship-feature <plan>` onaylanmış planı sırayla teslim et
- `/deploy-devnet` devnet'e deploy + IDL senkron
- `/prep-demo` hackathon teslim paketi
- `/review-all` ship öncesi son kontrol
- `/pty-debug` PTY veya stream sorunu
- `/stream-test` uçtan uca akış testi
- `/game-add <isim>` yeni mini-game scaffold
- `/solana-flow-test` devnet üstünde tip ve attestation testi

## Stack

- Runtime CLI: Node.js + TypeScript + node-pty + ws, dağıtım `npx @han/cli`
- Hub: Node.js + Fastify + ws + Redis (state) + Postgres (persistence)
- Summarizer: Anthropic API (Claude Sonnet) veya yayıncının kendi modeli
- Games: V1 sadece UI mockup (Roulette), engine V2'de — ADR `2026-05-12-game-decoupled-ui`
- UI: ink (React for terminal) + raw ANSI escape codes
- Wallet: Privy embedded wallet veya local keypair (devnet)
- Programs: Anchor (Rust), `programs/` — sadece game escrow + refund yolları (cancel, claim, timeout)
- SDK: TypeScript, `sdk/`
- Cluster: devnet, mainnet hedef sonra
- Solana micro-economy V1: **tip** (program-less, SystemProgram::transfer). Game escrow + attestation Anchor programda yazılı ama V1 demo'da çağrılmaz — V2 (ADR `2026-05-12-game-decoupled-ui`).
- RPC: multi-endpoint failover (api.devnet.solana.com birincil, Helius ikincil)

## Üç ana akış

**Yayıncı akışı** (`apps/runtime/streamer/`): yayıncı `han stream` çalıştırır, Han runtime PTY ile bir alt-shell forkluar, içinde claude/cursor/aider çalıştırılabilir. Tüm output PTY üstünden yakalanır, WebSocket ile hub'a stream edilir.

**İzleyici akışı** (`apps/runtime/viewer/`): izleyici `han browse` ile lobby'ye girer, açık yayınları görür, birine bağlanır. Default broadcast feed (özet) görür, `/raw` ile ham terminal moduna geçer. Yan panelde chat, alt çubukta oyun ve tip butonları.

**Hub akışı** (`apps/hub/`): yayıncıdan gelen stream'i alır, summarizer pipeline'a yollar, izleyicilere fanout eder, lobby state'i tutar, chat odalarını yönetir, oyun odalarını çalıştırır, Solana ile konuşur.

## Yazım kuralları

- Em dash yok
- Kısa cümle, ortalama 8-12 kelime
- Aktif ses
- Tripling yok
- Türkçe-first proje iletişimi, teknik terimler İngilizce
- Karar verildiyse alternatif önerme

## Önemli dosyalar

- `Anchor.toml` program ID, cluster
- `programs/han/src/lib.rs` `declare_id!`
- `sdk/idl/` IDL kopyası
- `apps/runtime/package.json` CLI binary entry
- `apps/hub/package.json` hub entry
- `.claude/docs/architecture.md` mimari döküman
- `.claude/docs/decisions/` ADR'lar

## Devnet bilgileri

```
Cluster: devnet
RPC (birincil): https://api.devnet.solana.com
RPC (ikincil, fallback): Helius devnet (HELIUS_RPC_URL env)

Han Program ID: <Anchor.toml'dan oku, deploy sonrası güncellenir>
Hub Authority: <hub admin keypair pubkey>

SAS Credential PDA: <setup-sas.ts çıktısı, .env'e yazılır>
SAS Schema PDA (game_result): <setup-sas.ts çıktısı>

Han hub URL (dev): http://localhost:3000
Han hub URL (devnet demo): https://hub.han.dev (örnek)

Sabitler:
- ROOM_TIMEOUT_SECONDS: 86400 (24 saat, timeout_refund tetikler)
- MAX_PLAYERS: 8
- MIN_ENTRY_FEE: 0.001 SOL
- MAX_ENTRY_FEE: 10 SOL (V1 koruma)
```

## Solana karar referansları

- ADR 2026-05-05-sas-vs-custom-pda: Attestation SAS üstünden, custom Anchor kapsam dışı
- ADR 2026-05-05-refund-timeout: 24 saat timeout sonrası trustless refund, V1.5 zorunlu (V1'de game engine yok)
- ADR 2026-05-05-rpc-fallback: Multi-endpoint failover, Helius backup
- ADR 2026-05-12-game-decoupled-ui: Game UI V1'de Roulette mockup, engine V1.5'te (önceki "V2" Revision 2'de V1.5'e taşındı)
- ADR 2026-05-13-indie-product-pivot: Hackathon submission → solo indie ürün, devnet odaklı V1, tip %3 V1 gelir
- ADR 2026-05-13-tip-fee-architecture: %3 fee program-less, iki SystemProgram::transfer tek TX

## Geliştirme akışı

```bash
# Geliştirme başında
pnpm install
anchor build

# Hub local
pnpm --filter hub dev

# Runtime local (yayıncı)
pnpm --filter runtime dev:streamer

# Runtime local (izleyici)  
pnpm --filter runtime dev:viewer

# Anchor test
anchor test --skip-deploy

# Devnet'e deploy
/deploy-devnet  # slash command tüm adımları takip eder
```

## Git workflow

Han'da hiçbir adım commit'siz bırakılmaz. Format kuralları `han-conventions` SKILL.md'de, burada tetikleyici tanımlı.

- Her commit Conventional Commits, İngilizce, scope listesi `han-conventions`
- Tetikleyiciler:
  - Bir agent kendi paketini yeşil bitirdiğinde (build + lint + test) anında commit
  - `/ship-feature` her agent adımının sonunda otomatik commit
  - `/deploy-devnet` IDL kopyasından sonra `chore(programs): sync idl`
  - `/review-all` ship-ready kararından sonra annotated tag
- Commit'i atan agent: o adımın sahibi (örn. `programs/` değişikliğini `anchor-engineer` atar)
- Final ship commit + push'u `qa-engineer` atar
- Asla `.env`, keypair, secret commit'leme — `.gitignore` güncel tut
- Commit yoksa "iş bitti" denmez; her oturum sonunda en az bir `git log --oneline` bekle

## Solana-new self-update map

`~/.claude/skills/SKILL_ROUTER.md` global router. Han bağlamında sabit yolculuk:

| Faz | Skill | Tetikleyici |
|---|---|---|
| Denetle | `review-and-iterate` | her ship öncesi |
| Hata kov | `debug-program` | program veya devnet hatası |
| Güvenliği sıkıla | `cso` | 2 haftada bir, ship öncesi zorunlu |
| Karşılaştır | `colosseum-copilot` | submission ayında bir kez |
| Mainnet hazırlığı | `deploy-to-mainnet` | devnet kararlı olduğunda |
| Pitch | `create-pitch-deck` | submission 2 hafta öncesi |
| Submit | `submit-to-hackathon` | son hafta |

Skill çağırma router'da listelenen trigger phrase'leri ile otomatik. İsim verme zorunlu değil.

## V1 sprint planı (indie product, devnet)

Detay: `.claude/plans/neden-commit-yok-commit-prancy-crab.md`. 4 sprint × 1 hafta:

| Sprint | Hedef |
|---|---|
| 1 — Hub canlı | Redis + Postgres lokal, e2e raw stream + chat |
| 2 — Tip + Streamer overlay | Devnet'te %3 komisyonlu tip, yayıncı UI |
| 3 — Profile + Onboarding | 5 Profile ekranı, first-time wizard, lobby polish |
| 4 — Polish + ilk demo | Bug fix, dokümantasyon, beta tester davet, demo video |

Mainnet V2'ye taşındı (kullanıcı kararı). Pong + Type Race V1.5'e (önceden V2 idi, indie pivot'ta öne çekildi).

## Hackathon teslim haftası (artık aktif değil — history)

```bash
/prep-demo
/review-all
```

## Subagent listesi

| Agent | Klasör | Sorumluluk |
|---|---|---|
| architect | (planlama) | mimari karar, ADR, dispatcher |
| runtime-engineer | `apps/runtime/` | CLI binary, PTY, WebSocket transport |
| hub-engineer | `apps/hub/` | hub backend, fanout, lobby, chat |
| summarizer-engineer | `apps/hub/summarizer/` | AI özet pipeline, broadcast feed |
| game-engineer | `apps/hub/games/`, `apps/runtime/games/` | Pong, Type-race, SDK |
| ui-designer | `apps/runtime/ui/` | terminal UI, ink, ANSI, render |
| anchor-engineer | `programs/` | Solana program, escrow + refund yolları (attestation SAS, program dışı) |
| solana-client-engineer | `sdk/`, `apps/runtime/wallet/` | TS SDK, wallet, tip, market |
| qa-engineer | (test) | test, güvenlik, review |
| debug-specialist | (hata) | PTY, network, runtime hata |
| demo-master | (teslim) | hackathon submission, video, pitch |

## Repo yapısı

```
han/
├── apps/
│   ├── runtime/             CLI binary (yayıncı + izleyici)
│   │   ├── src/
│   │   │   ├── streamer/    yayıncı modu
│   │   │   ├── viewer/      izleyici modu
│   │   │   ├── games/       oyun client'ları (Pong, Type-race)
│   │   │   ├── ui/          ink components, ANSI render
│   │   │   ├── wallet/      Privy/keypair entegrasyonu
│   │   │   └── transport/   WebSocket client
│   │   └── package.json
│   └── hub/                 backend
│       ├── src/
│       │   ├── stream/      stream ingest, fanout
│       │   ├── summarizer/  AI özet pipeline
│       │   ├── lobby/       açık yayınlar
│       │   ├── chat/        chat odaları
│       │   ├── games/       oyun odaları, state machines
│       │   ├── solana/      Anchor client, tip, attestation
│       │   └── api/         HTTP/WebSocket endpoint'ler
│       └── package.json
├── programs/                Anchor programs
│   └── han/
│       ├── src/
│       │   ├── instructions/
│       │   ├── state/
│       │   └── lib.rs
│       └── Cargo.toml
├── sdk/                     TypeScript SDK
│   ├── src/
│   ├── idl/
│   └── package.json
├── .claude/                 Claude Code yapılandırması
├── Anchor.toml
├── package.json             (workspace root)
└── pnpm-workspace.yaml
```
