# Han — Product & Engineering Report

**For:** business development outreach + cli-han.dev landing page source
**Version:** 1.0 — 2026-05-20
**Repository:** github.com/omeraksu/cli-han (MIT)
**Live network:** Avalanche Fuji testnet (43113)
**Contact:** omar@cli-han.dev · @omeraksu

---

## 0 · One-paragraph pitch

Han is the **terminal-native event layer for AI-native builders**. Every team streams their terminal from `han stream`; judges watch all of them at once in a CLI mosaic; instructors run split-pane workshops; organizers get a co-branded `cli-han.dev/event/<you>` hall with a live lobby, an on-chain-anchored submission archive, and an opt-in verified builder graph. The same motor that hosts solo broadcasts with native-AVAX peer-to-peer tips also runs paid hackathons and bootcamps. The build corpus and the builder graph compound to the organizer — they don't rent observability, they build an asset.

---

## 1 · The shift this product is riding

The AI-native developer is a new species. Claude Code, Cursor, Aider, Codex — the work happens **inside a terminal**, in compressed bursts, with long thinking pauses. Existing event tooling sees a slice and discards the rest:

| Tool | What it captures | What's lost |
|---|---|---|
| Discord / Slack | ephemeral chat | no archive, no observability across N teams |
| Devfolio / DoraHacks | submission cards | the build that produced them |
| Twitch / YouTube | video pixels | structure, every search, every tool call |
| Zoom rooms | live presence | judges burn out, can't pop into 30 rooms |
| sshx | one terminal | not branded, not replayable, not on-chain |

This isn't only an observability gap. **The build evaporates.** Nobody captures it. That's lost data the organizer's community will never get back.

Han closes the gap by recording the work where it actually happens — inside the terminal — as structured, replayable, on-chain-anchored data.

---

## 2 · What we ship today

### Three roles, one shared motor

| Role | CLI surface | What they see |
|---|---|---|
| **Builder** | `han stream`, `han login`, `han profile attest` | Their own terminal, streamed to the hub with an AI-summarized broadcast feed and optional native-AVAX tips |
| **Judge / Mentor** | `han watch --event <slug>` | A live CLI mosaic of N team tiles — current task, AI intent summary, "● help" red dot when a team is stuck |
| **Instructor** | `han workshop start <slug>` | Split-pane: their terminal on the left, tiled student terminals on the right, in-sync / lag indicators, help inbox |
| **Organizer** | `cli-han.dev/event/<you>` web hall + `han events create` | Co-branded landing, live stats, lobby, submission archive, DX intelligence report |

### Two assets that compound

Per deck slide 10 — *"the asset, not the service"*:

1. **Build corpus** — every PTY recording, every commit, every AI-summarized event anchored to the event. Where 312 teams hit friction in *your* SDK. Your DX audit, every event you run.
2. **Verified builder graph** — opt-in, on-chain proof-of-work graph of finishers. Not a directory. Your recruiting funnel and your grant pipeline, immutable.

Event N+1 makes event N's data more valuable. The gap widens every event the organizer runs on Han.

---

## 3 · Technical architecture

Han is a **monorepo** of six packages running on three tiers (terminal, backend, chain) plus a brand-aware web layer.

```
cli-han/
├── apps/
│   ├── runtime/     CLI binary (cli-han) — streamer + viewer + mosaic + workshop
│   ├── hub/         Fastify backend (REST + WS gateway) — Postgres + Redis
│   └── web/         Next.js 15 branded event hall + landing
├── contracts/       Foundry — Han.sol, HanTipRouter.sol, HanEventAnchor.sol
├── sdk/             TypeScript / viem wrapper — used by hub, runtime, web
└── packages/
    └── mcp-server/  Model Context Protocol bridge for Claude Code / Cursor / Aider
```

### 3.1 · Runtime CLI (`@han/runtime`, published as `cli-han`)

| Module | Responsibility |
|---|---|
| `streamer/pty.ts` | `node-pty` fork of the user's `$SHELL`, locked to broadcast grid, stdout capture |
| `streamer/index.ts` | Nonce → wallet `signMessage` → WS handshake, then PTY chunks flow as `stream_chunk` events |
| `streamer/privacy-filter.ts` | Default-on filter for env / keys / tokens before any byte leaves the host |
| `viewer/MosaicView.tsx` (ink) | N-team tile grid, focused tile via arrow keys, help red dot, brand colors |
| `streamer/WorkshopMode.tsx` (ink) | Split layout; instructor publishes lesson cursor via ENTER, students see lesson_lesson updates |
| `events/{commands,attest,mosaic-ui,workshop-ui}.ts` | `han events list/join`, `han profile attest`, ink mount drivers |
| `auth/login.ts` + `auth/token-store.ts` | `han login` does signed-nonce handshake, persists bearer token at `~/.han/auth.json` (mode 0600) |
| `ui/colors.ts` | Brand tokens, mirrored 1:1 into `apps/web/tailwind.config.ts` |
| `transport/ws-client.ts` | Backoff, reconnect, typed handler registry |
| `wallet/local-account.ts` (via SDK) | Hex private key at `~/.config/han-avax/wallet.json` (mode 0600), `viem` `PrivateKeyAccount` |

CLI subcommand surface:
```
cli-han stream [cmd] --event <slug> --team <label>   builder
cli-han browse                                        viewer (public lobby)
cli-han connect <code>                                viewer (direct)
cli-han login [--handle <name>]                       wallet → bearer token
cli-han events list                                   user's events + invites
cli-han events join <slug>                            accept invite
cli-han watch --event <slug>                          judge mosaic
cli-han workshop start <slug>                         instructor split mode
cli-han profile attest --event <slug> --role <role>   on-chain self-attest
```

### 3.2 · Hub backend (`@han/hub`)

Fastify + Prisma 6 + Redis + ioredis + viem. One binary, multi-event (event-tenant, not multi-tenant SaaS).

**REST routes** (`apps/hub/src/routes/`):

| Path | Method | Purpose |
|---|---|---|
| `/health` | GET | liveness |
| `/config` | GET | public chain config — network, tipRouter, feeReceiver, hanContract, tipFeeBps |
| `/sessions/nonce`, `/sessions`, `/sessions/:id` | POST/GET | wallet signed-nonce session handshake (carries `eventSlug` + `teamLabel`) |
| `/tips` | POST | post-tx receipt + event-log validation via viem |
| `/rooms` | GET | universal room registry (channels + streams + event rooms) |
| `/corpus/events`, `/corpus/events/:slug/{submissions,reports}` | POST/GET | Build Corpus Report MVP — lightweight event, friction-map report generation |
| `/events`, `/events/:slug`, `/events/:slug/members[/:wallet]` | POST/GET/PATCH/DELETE | full event CRUD + invite |
| `/events/:slug/teams[/:teamId/members]` | POST/GET/DELETE | team CRUD + auto-builder EventMember upsert |
| `/events/:slug/teams/:teamId/submissions`, `/events/:slug/submissions` | POST/GET | submission write + list |
| `/events/:slug/submissions/:id/anchor` | POST | hub authority signs `HanEventAnchor.anchorSubmission`, persists `anchorTxHash` |
| `/anchor/config` | GET | runtime/web discovery — contract address + ABI + chain id |
| `/auth/wallet-login`, `/auth/dev-login`, `/auth/me` | POST/GET | hybrid auth: wallet signed-nonce or SSO dev-stub, 7d bearer in Redis |
| `/me/events`, `/events/:slug/accept` | GET/POST | bearer-scoped view + idempotent invite accept |

**WebSocket gateway** (`apps/hub/src/ws/`):

| Message | Direction | Handler |
|---|---|---|
| `register_streamer`, `stream_chunk`, `stream_end` | client → hub | streamer registers session, pushes PTY events, eagerly marks `endedAt` on shutdown |
| `join`, `switch_mode`, `chat_send` | client → hub | viewer joins, toggles feed/raw, sends chat |
| `help_signal_open`, `help_signal_close` | client → hub | builder `/help`, mentor resolves |
| `mosaic_subscribe`, `mosaic_unsubscribe` | client → hub | judge attaches to one event, receives snapshot + live updates |
| `workshop_join`, `workshop_cursor` | client → hub | student tracks lesson, instructor publishes lesson cursor |
| `mosaic_snapshot`, `mosaic_tile_update` | hub → client | initial tile list + per-chunk activity feed |
| `workshop_lesson` | hub → client | instructor lesson fan-out to other workshop members |

**State managers**: `lobby/state.ts` (Redis session registry), `rooms/registry.ts` (universal room kinds: channel / stream / event-team / event-mosaic / workshop-cohort), `mosaic/state.ts` (eventId → connId subscribers), `stream/cache.ts` (per-session ring buffer, 100 events × 5min TTL — kept post-disconnect so the corpus analyzer can read post-mortem).

### 3.3 · Database (Prisma + PostgreSQL)

11 tables — single schema, event-tenant via nullable `eventId` FKs.

```
Profile        wallet · handle · bio · email? · ssoProvider? · ssoSubject?
                @@unique(ssoProvider, ssoSubject)
Session        id · streamerWallet · wsToken · startedAt · endedAt
                · eventId? · teamLabel?            ← Sprint 1 layer
Room           id · kind · slug · title · ownerWallet · endedAt · metadata
ChatMessage    id · sessionId? · roomId? · userWallet · content
Tip            id · sessionId · fromWallet · toWallet · amountWei · feeWei · streamerWei · txHash
GameResult     id · gameType · gameId · players · winner · stakeWei · potWei · settledTx

Event          id (uuid) · slug · title · organizerWallet · startsAt · endsAt
                · status · plan · brand (json)
EventMember    id · eventId · wallet · role · invitedBy · acceptedAt
                @@unique(eventId, wallet)
Team           id · eventId · slug · name · status      @@unique(eventId, slug)
TeamMember     id · teamId · wallet · role               @@unique(teamId, wallet)
Submission     id · eventId · teamId? · teamLabel · title · summary
                · repoUrl · demoUrl · anchorTxHash · submittedAt
HelpSignal     id · eventId · teamId? · sessionId · reason
                · openedAt · closedAt · resolvedBy
BuilderAttestation  id · eventId · wallet · role · anchorTxHash · attestedAt
                     @@unique(eventId, wallet)
CorpusReport   id · eventId · status · frictionMap (json) · pdfPath · generatedAt
```

B2C sessions stay with `eventId = null` so the indie tip flow works without any event layer changes.

### 3.4 · On-chain primitives (Avalanche C-Chain, Solidity 0.8.26)

All three contracts are **live on Fuji testnet** and verified end-to-end with transaction hashes.

#### Han.sol — game escrow (live: `0xa92571e8D0415D041468798767298872a60a3503`)
8 functions, owner + authority pattern, ReentrancyGuard. Constants enforced:
`ROOM_TIMEOUT = 24h`, `MAX_PLAYERS = 8`, `MIN_ENTRY_FEE = 0.001 AVAX`, `MAX_ENTRY_FEE = 10 AVAX`, `MAX_FEE_BPS = 1000`.

```
createGameRoom(roomId, gameType, entryFee, maxPlayers)   host stakes
joinGame(roomId)                                         player stakes
settleGame(roomId, winner)                               authority pays winner − fee
cancelGame(roomId)                                       host cancels filling room
claimRefund(roomId)                                      stake refund (bitmap)
timeoutRefund(roomId)                                    anyone after 24h
getRoom(roomId), getPlayers(roomId)                      read state
```

Events: `GameRoomCreated · PlayerJoined · GameSettled · GameCancelled · RefundClaimed · TimeoutRefundClaimed`.

Smoke (live Fuji): `0x703dc873` create + `0x3f949a17` join + `0xe5101707` settle. Contract balance returns to `0` after settle ✓.

#### HanTipRouter.sol — atomic peer-to-peer tip with 3% commission (live: `0x29290d67012c3495bC5F3b9333FAA332155Ddb58`)
EVM has a single-`to` constraint, so the router is what makes tipping atomic (counterpart to Solana's two `SystemProgram::transfer`s).

```
tip(streamer) payable
  → fee     = msg.value × feeBps / 10_000   (300 bps default = 3%)
  → toStreamer = msg.value − fee
  → fee to feeReceiver + toStreamer to streamer in a single tx
  emit Tipped(viewer, streamer, amount, feeAmount, streamerAmount)
```

Smoke (live Fuji): `0xa4cb5517` — 0.001 AVAX in, 0.00003 to fee receiver, 0.00097 to streamer, contract balance `0` after ✓.

#### HanEventAnchor.sol — event-log-only submission + attestation anchor (live: `0x2cD1B822Db2Bc6F44D612D86075f804Ab61ac112`)
Per ADR 2026-05-18, V1 anchors use append-only logs (no storage) so gas stays bounded whether the event has 30 builders or 3000. `eventKey = keccak256("han.event:" || event.slug)` — deterministic across hub, SDK, and runtime so a single slug maps to a single on-chain key.

```
anchorSubmission(eventKey, team, dataHash)        hub authority only
anchorAttestation(eventKey, role, dataHash)       msg.sender = builder (self-sign)
```

Role enum: `organizer=0 · judge=1 · mentor=2 · instructor=3 · builder=4 · spectator=5`.

Smoke (live Fuji): submission anchor `0x5b06a1af` block 55561989 gas 24977 ✓; builder self-attest `0xfea96157` block 55561994 gas 24871 ✓. Same `eventKey 0x00e9b9c7…` on both — slug → key derivation deterministic.

#### Test coverage
Foundry: **40 tests** across `Han.t.sol` (22 + 2 fuzz), `HanTipRouter.t.sol` (8), `HanEventAnchor.t.sol` (8). All green. Fuzz runs are 256 cases each, property-based.

### 3.5 · SDK (`@han/sdk`)

TypeScript + viem 2.x. Hub, runtime, and web all consume it so chain calls are typed and chain configuration is single-sourced.

```
client.ts          HanClient wrapper (chain + contracts + clients)
tip.ts             sendTipWithFee({ publicClient, walletClient, router, streamer, amountAvax })
escrow.ts          createGameRoom · joinGame · settleGame helpers
event-anchor.ts    anchorSubmission · anchorAttestation · eventKeyFromSlug · EVENT_ROLE enum
chain.ts           viem chain objects (avalancheFuji / avalanche)
rpc-client.ts      fallback transport: drpc + publicnode + official
wallet/local-account.ts  loadLocalAccount(path) + createAndSaveLocalAccount
abi.ts             hanAbi · hanTipRouterAbi · hanEventAnchorAbi (typed via abitype)
```

### 3.6 · Web layer (`@han/web`, Next.js 15)

| Route | Source | Renders |
|---|---|---|
| `/` | `app/page.tsx` | Landing (deck slide 01 hero, slide 11 packages summary, sample event link, CTAs) |
| `/event/[slug]` | `app/event/[slug]/page.tsx` | SSR-fetches `/events/:slug` from hub, renders deck slide 08 branded hall: hero + 5-stat live grid + team cards + live lobby + submission archive (with on-chain anchor links) + open help signals callout |

Live stats poll every 5s via `components/EventHallClient.tsx` (Sprint 8 swap to WS mosaic stream). `lib/hub.ts` is the typed fetch wrapper.

Brand foundation in `tailwind.config.ts` is byte-for-byte the same palette as `apps/runtime/src/ui/colors.ts` — terminal UI and web are the same brand.

### 3.7 · AI corpus analyzer (`apps/hub/src/corpus/analyzer.ts`)

The Build Corpus Report engine — the wedge in the sales motion.

**Flow**:
1. Load all `Session` rows for the event.
2. Pull each session's `StreamCache` (post-mortem retained) and concat into a text blob (`stdout`, `command_start`, `tool_call`, `file_edit`, `turn`).
3. If `ANTHROPIC_API_KEY` is set → call **Claude Sonnet 4.6** with a structured-output prompt asking for `topPatterns: [{ pattern, count, affectedTeams, sampleQuotes }]`. Parse, return as FrictionMap.
4. **Fallback (always available)**: heuristic regex matcher across 7 friction categories — compile errors, anchor CPI confusion, Wormhole SDK failures, wallet/signing, gas/fee, RPC timeout, env config. Deterministic, no external API, ship-ready for offline demos.
5. Render: `corpus/report-pdf.ts` outputs an HTML page (also written at the `.pdf` path so the contract is stable) using the brand foundation tokens. Real PDF rendering via puppeteer ships in Sprint 8.

Output FrictionMap is also written as `.json` next to the PDF so customers can pipe it into their own dashboards.

Smoke (3 mock teams, friction-bearing commands): `wormhole_fail` → Wormhole SDK failures; `E0308_mismatch` → Compile errors; `rpc_429` → RPC timeout. 3/3 patterns correctly attributed.

### 3.8 · MCP integration (`packages/mcp-server`)

Han ships as a Model Context Protocol server so Claude Code / Cursor / Aider can drive the runtime directly:

- **Tools**: `han_stream_start`, `han_stream_stop`, `han_log`, `han_browse`, `han_connect`, `han_tip`
- **Resources**: `han://lobby` (live session list), `han://session/{id}` (event buffer)

This is the lane where AI agents become **first-class builders** — they don't just write code, they participate in events.

### 3.9 · Brand foundation

Tokens (deck slide 02 + 03, mirrored across terminal UI and web):

| Token | Hex | Role |
|---|---|---|
| ink | `#0E0E0E` | background |
| ash | `#1A1816` | surface |
| smoke | `#2A2826` | border |
| cream | `#EDE6D6` | foreground |
| ember | `#E0633A` | accent / primary CTA |
| teal | `#5FA8A0` | success / info |
| amber | `#E8C56B` | highlight / metric |
| dim | `#7A7268` | muted text |

Typography: **JetBrains Mono** (display + UI + code) and **Inter** (body). Both terminal UI (ink) and web (Tailwind) render from the same palette.

---

## 4 · The moat (deck slide 09 — why nobody catches up)

| Competitor | What they capture | What they miss |
|---|---|---|
| sshx | one terminal at a time | no event scope, no archive, no on-chain |
| Twitch | video pixels | structured events, judge tooling, archive replay |
| Discord | ephemeral chat | the build itself |
| Devfolio / DoraHacks | submission cards | the build that produced them |
| **Han** | **structured · replayable · on-chain** | (this is the keeper) |

**Compounding asset**: every event Han runs makes the previous events more valuable. The build corpus accretes; the verified builder graph thickens; the DX intelligence per sponsor SDK gets sharper. The gap widens with every event.

---

## 5 · Packaging (deck slide 11)

| Tier | Price | Target | Scope |
|---|---|---|---|
| **Workshop** | **$1.2k / event** | bootcamps, educators, internal teams | 1 instructor + up to 50 students, 8h, replay, 1 custom accent + logo |
| **Hackathon** *(sweet spot)* | **$12k / event** | foundations, ecosystem teams, dev-tools | unlimited teams, 7 days, jury, branded subdomain + mosaic, on-chain submission archive, public lobby + spectator feed (add-ons +$3k) |
| **Ecosystem partner** | **$80k+ / year** | chain foundations, long-term programs | multi-event, DX intelligence across all events, verified builder graph access, white-label CLI command, game SDK + prize programs |
| **Build Corpus Report** *(wedge)* | **from $9k / report** | existing event organizers | plug Han into your existing hackathon. We capture, structure, and deliver the DX report on where your SDK loses builders. No need to run the whole event on us. |

The wedge product (Corpus Report) lets a sponsor try the asset without committing to running an entire event on Han — the lowest-friction path to revenue validation.

---

## 6 · Status — what's live as of 2026-05-20

- **3 contracts deployed on Fuji**: Han, HanTipRouter, HanEventAnchor.
- **40 Foundry tests passing** (constructor guards, room lifecycle, tip math, anchor authority, fuzz).
- **5 end-to-end on-chain flows verified** (tip with 3% split; create + join + settle game; submission anchor; builder attestation) — each with a Snowtrace tx hash.
- **Hub backend** running 12+ REST endpoints, 11 WS message types, full Prisma migration history.
- **Runtime CLI** ships 9 subcommands across builder / viewer / judge / instructor.
- **Web app** (`apps/web/`) — Next.js 15 branded event hall renders live hub data.
- **40+ TypeScript / TSX source files**, ~6k LOC, monorepo via pnpm workspaces.
- **9 ADRs** documenting every architecture decision (RPC fallback, refund timeout, tip fee, attestation, Solana→AVAX port, indie product pivot, MCP server, decoupled game UI, events pivot).

Repository is single-developer, MIT, six sprints of commits (`Sprint 0–6`), each with green build + smoke test.

---

## 7 · Roadmap

| Sprint | Status | Deliverable |
|---|---|---|
| 0 | ✓ ship | ADR + small debt cleanup (stream_end handler, hub env) |
| 1 | ✓ ship | Build Corpus Report MVP (Event/Submission schema, analyzer, PDF, runtime `--event` flag) |
| 2 | ✓ ship | Full events schema (Member/Team/HelpSignal/Attestation) + CRUD + SSO scaffolding |
| 3 | ✓ ship | Runtime CLI events/join/login + wallet bearer auth |
| 4 | ✓ ship | Judge mosaic + workshop split UI + WS fanout |
| 5 | ✓ ship | Branded event hall web (Next.js + Tailwind brand tokens) |
| 6 | ✓ ship | HanEventAnchor on Fuji + submission + attestation |
| 7 | next | Stripe checkout + paket billing (per-tier limits, webhooks) |
| 8 | next | Corpus storage cloud (S3/R2) + DX intelligence dashboard + puppeteer PDF |
| — | V2 | Mainnet (Avalanche C-Chain 43114), real OAuth callbacks (Google + GitHub), `apps/web` deploy on Vercel/Cloudflare |

---

## 8 · Why now

1. Claude Code, Cursor, Aider, Codex are the default tools for any builder under 30. **The terminal is the work surface again.**
2. Hackathon counts are flat but build-quality per team is 3–5× higher. **Observability is the only way to capture that.**
3. On-chain provenance is becoming table stakes for grants and rev-share. **Han ships submission anchors today.**
4. Remote and hybrid hours are 3× pre-2024. **Discord-share is the bar. Han is the unfair advantage.**

---

## 9 · Landing-page copy blocks (ready to paste)

### Hero
> **han for hackathons & workshops**
>
> The terminal-native event layer for AI-native builders.
> We run the event. The build corpus and the builder graph stay yours.

**CTA:** `npm i -g cli-han` · `han stream` · [talk to us →](mailto:omar@cli-han.dev)

### Sub-hero strip
N teams streaming. M judges watching. 1 organizer in control. All in the terminal, branded for you. **Runs in any format · online · hybrid · in-person. No venue, no problem.**

### Feature block — the mosaic (slide 06)
> Judges in London. Builders in Istanbul. One screen.
>
> Every team is a tile. Every tile shows what they're doing right now: `anchor build · in sync 12s`, `cpi context error · 3m`, `help`. One-key zoom. Mentor note. Vote. This view is also a dataset.

### Feature block — workshop mode (slide 07)
> Instructor terminal on the left. N student terminals tiled on the right. Red dot routes to a help inbox. Lesson cursor publishes to every student. Lag and in-sync indicators per learner.

### Feature block — branded hall (slide 08)
> `cli-han.dev/event/<you>` — your colors, your domain, our motor. A co-branded landing, a live lobby of open Hans, and a submission archive that's anchored on-chain.

### Feature block — what you keep (slide 10)
> You don't rent observability. You build an asset.
>
> **Build corpus** — every PTY recording, every commit, every AI-summary anchored to your event. Exactly where 312 teams hit friction in your SDK. Replayable. Provable. Your DX audit, every event.
>
> **Verified builder graph** — opt-in, on-chain proof-of-work of every finisher. Not a directory — your recruiting funnel and your grant pipeline, immutable.

### Receipts strip (deck slide 12 framing — replace numbers with real ones as events run)
```
312 teams streamed     2.1M cli commands · structured
8,043h corpus captured 487 help signals · avg 1m12s
14.2 tipped p2p        0 zoom calls
```

### Footer
Open source · MIT · github.com/omeraksu/cli-han · `npm i -g cli-han`

---

## 10 · Business developer brief (one-page edition)

**Product.** Han = `cli-han` (open-source CLI) + a hosted hub + a co-branded web event hall. Builders stream their terminal; judges watch every team at once in a CLI mosaic; instructors run split-pane workshops; organizers ship branded events that compound the build corpus and verified builder graph on-chain.

**Wedge.** Build Corpus Report ($9k+). Instrument an existing event with Han. We capture, structure, and deliver a DX report on where the sponsor's SDK loses builders. No need to switch event platforms.

**ICP.**
- *Wedge buyer:* SDK / dev-tool company that already runs hackathons and wants to know where builders get stuck.
- *Sweet spot:* L1/L2 foundation or AI-tool company running 7-day hackathons.
- *Anchor account:* Chain foundation running 4+ events / year (Ecosystem Partner tier).

**Revenue model.** Per-event fixed price + annual recurring for ecosystem partners. No platform commission on prize pools (yet). Optional 3% atomic-split commission on peer-to-peer tips between viewers and streamers (already live on Fuji, separate revenue line).

**Differentiation.** Terminal-native (not video). Structured events (not pixels). On-chain anchored (not ephemeral). Compounding asset (not a service). MIT open source (no vendor lock-in fear).

**Status (2026-05-20).**
- 3 smart contracts deployed on Avalanche Fuji (Snowtrace-verified TX hashes for every flow).
- 6 sprints shipped end-to-end. 40 Foundry tests green.
- Hub + runtime + web all working together; live demo available on request.
- Domain: `cli-han.dev` (target).
- Mainnet (Avalanche C-Chain) targeted post-launch; testnet during pilots is intentional (no $-risk for early customers).

**Asks.**
- 1 hackathon pilot, free or at-cost, in exchange for case-study rights.
- 1 SDK Build Corpus Report pilot (paid, $9k).
- Intros to foundations running multi-event programs (ecosystem-partner-shaped accounts).

**Contact.** Ömer Aksu · omar@cli-han.dev · x.com/omeraksu

---

## 11 · Türkçe yönetici özeti

Han, AI-asistanlı geliştiriciler için terminal-yerli bir etkinlik platformu. Yapımcı kendi terminalinden yayın yapar, juri 30 takımı tek ekranda mosaic ile izler, eğitmen split-pane workshop yönetir, organizer ise `cli-han.dev/event/<sen>` üzerinde markalı bir lobi + canlı istatistik + on-chain anchored submission arşivi alır. Solo geliştiriciler hâlâ %3 komisyonlu native-AVAX tip akışını kullanmaya devam eder — aynı motor, B2C ve B2B paralel yaşar.

**Şu an canlı (Fuji testnet)**: 3 kontrat, 40 Foundry testi yeşil, 5 uçtan uca on-chain akış doğrulandı. Hub backend, runtime CLI, web frontend, MCP server hepsi çalışıyor. Repo MIT, tek geliştirici, 6 sprint commit'lendi.

**Paketler**: Workshop $1.2k, Hackathon $12k (sweet spot), Ecosystem Partner $80k+/yıl, ek-paket Build Corpus Report $9k+ (mevcut event'e plug-in olarak gelir wedge'i).

**Birinci satış hamlesi**: SDK sahibi bir dev-tool şirketine $9k Build Corpus Report pilot. Mevcut hackathonlarına Han'ı bir oturum için tak, sonunda DX raporu teslim et.

**Ana farklılaştırıcı**: terminal-yerli (video değil), yapılandırılmış (piksel değil), on-chain anchored (geçici değil), bileşen birikiyor (servis değil), MIT açık kaynak (vendor lock-in korkusu yok).
