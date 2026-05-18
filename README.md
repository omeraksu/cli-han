# han

**A terminal-native streaming network for AI-assisted coding. Built on Avalanche.**

A developer running Claude Code, Cursor, Aider, or Codex CLI is already producing a *stream*. Han turns that stream into a first-class network event — structured (turn / tool_call / file_edit / test), shareable, replayable, **tippable**.

```
[broadcaster · cli]  →  [han hub · ws + on-chain]  →  [viewer · cli]
                                ↓
                       on-chain tip · 3% protocol fee
```

We stream the **events**, not the pixels.

- **Pitch deck:** https://pitch-ochre-alpha.vercel.app
- **Fuji testnet program:** [`D7pgqFkNXvHPGocEknUgKHrGjwtNZfsQBQ6ey9xXYXfD`](https://explorer.solana.com/address/D7pgqFkNXvHPGocEknUgKHrGjwtNZfsQBQ6ey9xXYXfD?cluster=Fuji testnet)
- **Submission:** Superteam Turkey × Halborn · Avalanche Colosseum Frontier (May 2026)

## What's live (V1, Fuji testnet)

| Capability | How it works |
|---|---|
| **Structured activity feed** | MCP `han_log` events stream from the broadcaster through the hub to every viewer. `⟁` intent · `▸` tool_call · `▸` file_edit render top-of-fold by default. |
| **Raw terminal stream** | `/raw` toggle drops you into the bit-for-bit PTY (xterm emulator), then `/feed` returns to the structured view. |
| **On-chain tip · 3% protocol fee** | One transaction, two `SystemProgram::transfer` legs. 0.005 – 0.05 SOL typical range. Fuji testnet-verified end to end. |
| **Lobby + chat + profile** | Browse live broadcasters, sort by tips, drop into the room with one keystroke. Wallet-keyed handles. |
| **Roulette · ambient micro-game** | A small social break that runs alongside a coding session — not the headline; the headline is the stream itself. |
| **MCP server (6 tools)** | `han_stream_start`, `han_stream_stop`, `han_log`, `han_browse`, `han_connect`, `han_tip`. Bridges Claude Code & Cursor. Aider & Codex CLI compatible via MCP protocol. |

## Quickstart

```bash
# Prerequisites
brew install redis postgresql@14
brew services start redis postgresql@14
createdb han

# Clone + install
git clone https://github.com/omeraksu/cli-han
cd cli-han
pnpm install
pnpm setup:env       # copy .env.example, then fill in:
                     #   WALLET_ADDRESS, FEE_COLLECTOR_PUBKEY,
                     #   SOLANA_RPC_URL=https://api.Fuji testnet.solana.com,
                     #   DATABASE_URL, REDIS_URL
pnpm -r build
pnpm --filter @han/hub exec prisma migrate dev --name init

# Three terminals
pnpm hub      # T1 · hub listens on :3000
pnpm stream   # T2 · broadcaster (pick handle, write code)
pnpm browse   # T3 · viewer (↑↓ to pick a stream, ⏎ to join)
```

Inside the viewer:
- `/raw` ↔ `/feed` — toggle bit-for-bit vs structured event view
- `/tip 0.005` — Fuji testnet SOL tip, 3% protocol fee verified on-chain
- `/play` — Roulette ambient game
- `/profile @alice` — read another broadcaster's profile
- `/quit`

## MCP integration — "open a stream on Han"

Han ships as an MCP server so Claude Code, Cursor, or any MCP-compatible agent can drive it in natural language.

```jsonc
// .mcp.json
{
  "mcpServers": {
    "han": {
      "command": "node",
      "args": ["/absolute/path/to/cli-han/packages/mcp-server/dist/index.js"],
      "env": {
        "HAN_HUB_URL": "http://localhost:3000",
        "WALLET_ADDRESS": "<your pubkey>",
        "FEE_COLLECTOR_PUBKEY": "<fee collector pubkey>"
      }
    }
  }
}
```

```
[you]      open a stream on han
[claude]   ✓ live · session 9mdv.xxxx
[you]      track down the runtime bug
[claude]   (han_log fires on every turn + tool call;
            viewers see ⟁ intent · ▸ tool_call · ▸ file_edit
            in their structured feed in real time)
```

Setup notes: `.claude/docs/mcp-setup.md`.

## Architecture

Three runtimes, one event bus, one on-chain tip path.

```
broadcaster · runtime/cli         hub · network                  viewer · runtime/cli
─────────────────────────         ─────────────────────          ──────────────────────
Node + node-pty + ink             Fastify + WebSocket fan-out    same binary as broadcaster
MCP server (6 tools)              Redis · Postgres               browse · join · chat · tip
                            ──→   Structured event bus     ──→
                                  (MCP → fan-out)
                                  V1.5: hub-side summarizer
                                       + moderator agents
                            ──→   on-chain tip · 2× transfer ──→
                                  (broadcaster + protocol)
```

- **Stack:** Node.js + TypeScript everywhere · React (ink) on the CLI · Foundry (Rust) on Avalanche · Avalanche Fuji testnet (V1)
- **Tip flow:** program-less, two `SystemProgram::transfer` in a single TX (broadcaster net + 3% protocol fee), verified on-chain
- **Game escrow:** Solidity contract deployed on Fuji testnet — runtime invoke lands in V1.5

## Roadmap

Han is an indie product. The pitch deck has the full story; the short version:

| Version | Window | Highlights |
|---|---|---|
| **V1** · *now* | May 2026 · Fuji testnet | Structured feed default · raw mode toggle · 2× transfer tip + 3% fee · MCP (6 tools) · Roulette · lobby/profile |
| **V1.5** | Q3 2026 · Fuji testnet | SummarizerAgent (narrative feed via Claude Sonnet) · ModeratorAgent · idle-gap detection · escrow runtime invoke · Pong + Type-race playable |
| **V2** | Q4 2026 — Q1 2027 · mainnet | Multi-leg tip in one TX (4 legs: broadcaster + protocol + agent operator + referrer) · on-chain agent identity (PDA per agent) · viewer-side companion agents · Halborn audit complete |
| **V3** | 2027+ | SAS attestation for agent actions and game outcomes · capability marketplace · rev-share rails · SPL tokens (USDC tip + subscriptions) |

## Repo layout

```
apps/
├─ runtime/        CLI binary (broadcaster + viewer modes)
│  └─ src/streamer, viewer, ui, wallet, transport
└─ hub/            backend
   └─ src/stream, lobby, chat, rooms, routes, solana
contracts/han/      Foundry (escrow + refund paths)
sdk/               TypeScript SDK + IDL
packages/mcp-server/   MCP bridge — 6 tools
pitch/             Vite + React shell wrapping the static deck
.claude/           dev environment: subagents, skills, slash commands
```

## Development

Built with 1 human + 11 Claude-Code subagents (architect, runtime-engineer, hub-engineer, summarizer-engineer, game-engineer, ui-designer, contract-engineer, evm-client-engineer, qa-engineer, debug-specialist, demo-master). Each owns a surface; `architect` dispatches.

Slash commands:

```
/plan <feature>          ask architect to design a feature
/ship-feature <plan>     ship an approved plan step by step
/deploy-Fuji testnet           Foundry build + deploy + IDL sync
/stream-test             end-to-end broadcaster → hub → viewer smoke test
/avax-flow-test        Fuji testnet tip + attestation test
/review-all              pre-ship review across layers
```

Conventions, ADRs, and the architecture deep-dive live under `.claude/docs/`. Subagent definitions are in `.claude/agents/`.

## License

MIT.
