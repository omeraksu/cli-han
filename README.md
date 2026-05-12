# Han, Claude Code Setup

Han için tasarlanmış 11 subagent, 7 skill, 9 slash command, 2 hook, ve eşlik eden config dosyaları. Hepsi kopyala-yapıştır kullanıma hazır.

## Han nedir

Han, AI ile çalışan geliştiriciler için terminal-native ambient social layer. Yayıncı kendi tool'unu (Claude Code, Cursor, Codex CLI, Aider, vs.) çalıştırırken Han runtime PTY üstünden terminal output'unu yakalar, hub'a stream eder. İzleyiciler ham akışı veya AI özetli broadcast feed'i takip eder, kendi aralarında Pong veya Type-race oyunlar oynar, yayıncıya tip atar. Kazanan attestation Solana'ya yazılır.

Hackathon: Solana Frontier Hackathon submission.

## 5 dakikada yayın aç

```bash
# 1) Prerequisites (tek seferlik)
brew install redis postgresql@14    # zaten varsa atla
brew services start redis
brew services start postgresql@14
createdb han

# 2) Han'ı klonla + kur
git clone https://github.com/omeraksu/cli-han
cd cli-han
pnpm install
pnpm -r build
pnpm --filter @han/hub exec prisma migrate dev --name init

# 3) Hub'ı başlat (Terminal 1, repo kökünde)
cd /path/to/cli-han
pnpm hub
# → "Hub listening on port 3000"

# 4) Yayını aç (Terminal 2, repo kökünde)
cd /path/to/cli-han
pnpm stream
# İlk açılışta wizard: handle + bio seç → ENTER
# PTY açılır, ne istersen yaz (claude code, cargo build, vs.)
# Alt çubukta: [han] ◉ live ◎ N viewers 🔥 X SOL

# 5) İzleyici (Terminal 3, repo kökünde)
cd /path/to/cli-han
pnpm browse
# ↑↓ ile yayın seç, ENTER ile bağlan
# Split pane: sol stream, sağ chat
# /raw    → ham terminal'i izle
# /tip 0.005 → devnet'te %3 komisyonlu gerçek tip
# /play   → Roulette mola oyunu
# /profile → kendi profilin · /profile @alice → başkası
# /settings → privacy + summarizer modu
# /quit
```

İlk yayını 60 saniyede başlatabilir, gerçek devnet SOL ile tip kabul edebilirsin.

## Roadmap

Han şu an **indie product** modunda, devnet odaklı V1 yolculuğu. Mainnet V2'ye ertelendi (kullanıcı kararı). Detay: ADR `2026-05-13-indie-product-pivot`.

| Versiyon | Kapsam | Cluster |
|---|---|---|
| **V1** (4 hafta) | Hub canlı + viewer split pane + tip komisyonu %3 + Profile + onboarding | devnet |
| **V1.5** | Pong + Type Race engine + on-chain stake + SAS attestation + summarizer AI | devnet |
| **V2** | Premium abonelik $9/ay + mainnet deploy + web companion app | mainnet |

V1 birincil gelir: tip komisyonu %3 (program-less, iki SystemProgram::transfer tek TX). Detay: ADR `2026-05-13-tip-fee-architecture`.

## Live deployment

| | Devnet |
|---|---|
| Program ID | `D7pgqFkNXvHPGocEknUgKHrGjwtNZfsQBQ6ey9xXYXfD` |
| Explorer | https://explorer.solana.com/address/D7pgqFkNXvHPGocEknUgKHrGjwtNZfsQBQ6ey9xXYXfD?cluster=devnet |
| IDL metadata | `5HyaoGGrbSAdtbdfSzpU4B5ntHm9svA4D6MvawJ4U6i2` |
| Upgrade authority | `9mdvkieFVKursJ1rL2fCaxvNUuDkTznitSCk8u39RAZX` |
| Hub authority (V2) | `GBTmt5CgCFfnjbruroanitjMVF8LF1EjabdQvkGrTSir` |
| Mainnet | not yet — V1 hedef devnet |

## Hızlı kurulum

```bash
# 1. Bu klasörün içeriğini Han repo'na kopyala
cp -r .claude /path/to/han/
cp .mcp.json /path/to/han/
cp CLAUDE.md /path/to/han/

# 2. Repo'da Claude Code'u başlat
cd /path/to/han
claude

# 3. İlk koşturma için
> /plan Han için Sprint 1 milestone'unu çıkaralım
```

## İçindekiler

```
.claude/
├── settings.json              model, izinler, env, hook bağlantıları
├── agents/                    11 subagent
│   ├── architect.md
│   ├── runtime-engineer.md    PTY, streaming, CLI binary
│   ├── hub-engineer.md        backend, fanout, lobby, chat
│   ├── summarizer-engineer.md broadcast feed, AI özet pipeline
│   ├── game-engineer.md       Pong, Type-race, game SDK
│   ├── ui-designer.md         terminal UI, ANSI, ink, render
│   ├── anchor-engineer.md     Solana program (escrow, refund — SAS attestation program-dışı)
│   ├── solana-client-engineer.md SDK, wallet, tip, market
│   ├── qa-engineer.md         test, security, review
│   ├── debug-specialist.md    PTY, network, runtime hata
│   └── demo-master.md         hackathon submission
├── commands/                  9 slash command
│   ├── plan.md
│   ├── ship-feature.md
│   ├── deploy-devnet.md
│   ├── prep-demo.md
│   ├── review-all.md
│   ├── pty-debug.md
│   ├── stream-test.md
│   ├── game-add.md
│   └── solana-flow-test.md
├── skills/                    7 proje skill'i
│   ├── han-architecture/SKILL.md
│   ├── han-pty-streaming/SKILL.md
│   ├── han-summarizer/SKILL.md
│   ├── han-game-protocol/SKILL.md
│   ├── han-solana-economy/SKILL.md
│   ├── han-terminal-ui/SKILL.md
│   └── han-conventions/SKILL.md
├── hooks/                     2 hook
│   ├── pre-tool.json
│   └── post-tool.json
└── docs/
    ├── architecture.md        ana mimari döküman
    ├── prompt-update-guide.md system prompt'ları nasıl güncellersin
    └── decisions/             ADR'lar

CLAUDE.md                      repo kökü, Claude Code önce burayı okur
.mcp.json                      proje seviyesi MCP server'lar
```

## Üç katman, üç sorumluluk

**Skill havuzu** (machine-level, `~/.claude/skills/`): solana.new ile gelen 25 journey + 77 ekosistem skill. Helius plugin (RPC, DAS API). Genel Solana ve build pattern'ları.

**Proje skill'leri** (repo-level, `.claude/skills/`): Han'a özel sabit bilgi. PTY streaming, summarizer pipeline, game protocol, micro-economy, terminal UI, conventions. Subagent'lar buraya başvurur.

**Subagent'lar** (repo-level, `.claude/agents/`): davranış katmanı. Her birinin kendi sorumluluk alanı.

## Plugin önerileri

```bash
# solana.new (machine-level skill bundle)
curl -fsSL https://www.solana.new/setup.sh | bash

# Helius (Solana RPC, 60+ tool, expert skills)
claude /plugin install helius@helius-labs
```

## MCP server'lar

`.mcp.json` proje seviyesi MCP config'i içerir:

- **GitHub** issue, PR, repo data
- **Context7** library docs (node-pty, ws, ink, Anchor)

## Sık komutlar

```
/plan <feature>            yeni iş için plan, architect üretir
/ship-feature <plan>       onaylanmış planı sırayla teslim et
/deploy-devnet             Anchor build + deploy + IDL senkron
/prep-demo                 hackathon submission paketi
/review-all                ship öncesi son kontrol
/pty-debug                 PTY veya stream sorunu debug
/stream-test               yayıncı→hub→izleyici akışı uçtan uca test
/game-add <isim>           yeni mini-game scaffold
/solana-flow-test          devnet üstünde tip + attestation test
```

## İlk denemen için

```bash
cd /path/to/han
claude

> /plan Han Sprint 1 için PTY runtime + minimal hub + tek izleyici akışı planlayalım

# architect bir plan üretir, sen onaylarsın
> /ship-feature <plan>

# her adımda bir agent devreye girer, qa-engineer review eder, sonunda demo edebilirsin
```

## Agent listesi, kim neyi sahiplenir

| Agent | Sorumluluk alanı | Klasör |
|---|---|---|
| architect | mimari, ADR, dispatcher | (planlama) |
| runtime-engineer | CLI binary, PTY capture, WebSocket transport | `apps/runtime/` |
| hub-engineer | hub backend, fanout, lobby, chat | `apps/hub/` |
| summarizer-engineer | broadcast feed pipeline | `apps/hub/summarizer/` |
| game-engineer | Pong, Type-race, game SDK | `apps/hub/games/`, `apps/runtime/games/` |
| ui-designer | terminal UI, ink, render | `apps/runtime/ui/` |
| anchor-engineer | Anchor program | `programs/` |
| solana-client-engineer | SDK, wallet, tip flow | `sdk/`, `apps/runtime/wallet/` |
| qa-engineer | test, güvenlik, review | (test) |
| debug-specialist | PTY, network, runtime hata | (debug) |
| demo-master | hackathon submission | (teslim) |

## Lisans

MIT. solana.new (SendAI + Superteam), solana-foundation/solana-dev-skill, ve solanabr/solana-claude-config örneklerinden ilham alır.
