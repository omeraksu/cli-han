# ADR 2026-05-13 — MCP server, hybrid with `han stream` PTY

## Status

Accepted, 2026-05-13.

## Context

Sprint 3 sonunda yayıncı tarafının UX'i kullanıcı tarafından zayıf bulundu:

> "ben daha çok arayüzün interaksiyonunu claude code un yaptığı gibi bir çerçeve olarak ayarlarız diye düşünüyordum. bu şekilde çok kötü ux var"

Mevcut `han stream` (PTY) tüm host terminal'i kaplıyor; Han status bar mesajları (`◎ 1 viewer`, `🔥 +0.05 SOL`) shell prompt'una bulaşıyor. Tam TUI çerçeve (xterm.js headless + Ink) Claude Code/vim gibi alternate-screen TUI'lerle bir arada yaşamaz.

Kullanıcının önerdiği alternatif:

> "bu yayın işini bir mcp olarak oluştursak? yayın aç diyeyim mesela arkada bir shell başlatıp yayın yapsın... aynı mcp de claude içerisindeyken browse eder falan?"

Bu çok daha temiz bir model: Han kendi TUI'sını dayatmıyor, **yayıncı zaten Claude Code (veya başka MCP-compatible AI tool) içinde yaşıyor**, Han ona MCP üstünden bağlanır. Yayın açma, log atma, browse, tip — hepsi AI tool çağrıları.

## Decision

V1'de **iki transport, tek hub protokolü** çalışır.

### Transport A — `@han/cli` (PTY, mevcut)

- Mevcut `pnpm stream` davranışı korunur
- PTY çıktısı `stdout` event'i olarak hub'a stream
- Status mesajları stderr'e, ayrı satırda (Sprint 2'de fix edildi)
- Use case: AI olmayan shell yayını, `cargo build`, manuel debug, `claude` CLI'sının kendisi
- V1.5'te: tam TUI çerçeve denemesi (xterm-headless + ink) opsiyonel

### Transport B — `@han/mcp` (yeni, AI-tool side)

- Yeni workspace package: `packages/mcp-server`
- `@modelcontextprotocol/sdk` üstüne kurulu, stdio transport (Claude Code default)
- Tools (V1):
  - `han_stream_start({ description?, tool?, model? })` — session yarat
  - `han_stream_stop()` — session kapat
  - `han_log({ role, content, tool_call?, file_edit? })` — bir turn event'i yolla
  - `han_browse()` — lobby snapshot
  - `han_connect({ sessionId })` — bir yayına izleyici ol (resource expose)
  - `han_tip({ to, amountSol })` — `sendTipWithFee` + POST /tips
- Resources:
  - `han://lobby` — canlı yayınlar
  - `han://session/{id}` — bir yayının son N event'i
- Use case: AI-driven sosyal katman. Claude Code/Cursor/Aider içinde `han'da yayın aç` denildiğinde AI bunu çağırır.

### Hub event protokolü genişletilir

Mevcut `StreamEvent`:
```ts
{ v: 1; type: 'stdout'; ts: number; data: string }
```

Yeni varyantlar:
```ts
{ v: 1; type: 'turn'; ts; role: 'user' | 'assistant'; content: string }
{ v: 1; type: 'tool_call'; ts; name: string; argsSummary?: string }
{ v: 1; type: 'file_edit'; ts; path: string; diffSummary?: string }
```

Hem PTY hem MCP transport bu cache + fanout yolundan geçer. Viewer ham (raw mode) ve özet (feed mode) görünümler için aynı event'leri farklı render eder.

### Viewer render

- **Raw mode**: `stdout` event'leri terminal'e dökülür (mevcut). Turn/tool_call/file_edit event'leri "okunabilir tek satır" olarak (`[user] ...`, `→ edited path/x.ts`, `▸ ran cargo test`).
- **Feed mode (Figma 04 layout)**: turn'lerden `⟁ intent` (latest user turn), tool_call'lardan `▸ action` listesi türetilir. Bu, summarizer V1.5 olmadan zaten "broadcast feed dolu" hissini verir.

## Consequences

**Yes:**
- Yayıncı için TUI cehennemi yok — Claude Code'un kendi UI'sı kullanılır
- "AI agent'lar arası han" niyeti tam ifade edilir
- Demo videosu güçlü: "claude'a yayın açtırıyorum, başka claude izliyor, ona tip atıyor"
- Pong/Type Race gibi V1.5 oyunları da MCP üstünden tool olabilir gelecekte
- Hub mimarisi değişmez (sadece protocol genişler) — Sprint 1-2 emek korunur

**No:**
- AI `han_log` çağırmayı **unutabilir**. Çözüm: system prompt zorlaması + heartbeat fallback (live indicator AI inaktif olsa bile)
- MCP transport debug zor — stdio binary mesaj, transparent değil
- Conversation transcript'in tamamı tool çağrısına bağlı; AI'nın atladığı turn'ler stream'de boşluk
- `han stream` PTY tarafı V1'de "best effort UX" — V1.1'de pass-through clean fix (status mesajları sadece viewer'a)

## Alternatives considered

### A — MCP-only V1
PTY tamamen V1.5'e ertelenir. Reddedildi: non-AI shell stream'i (`cargo build`, manuel sysadmin) yine değerli; PTY mimarisi kullanıma hazır.

### B — PTY-only V1 + UI çerçeve
TUI host (xterm-headless + Ink). Reddedildi: 1+ hafta scope, alternate-screen TUI uyumluluğu hassas, ROI düşük (MCP daha güçlü demo verir).

### C — Paralel iki yol, ikisi de first-class V1
V1 tarihi 1-2 hafta kayar. Reddedildi: indie solo dev için 4 haftayı 6'ya çıkarmak burnout riski. Hibrit modu MCP-first + PTY backup ile yetinilir.

## Implementation impact

| Dosya / paket | Değişiklik |
|---|---|
| `packages/mcp-server/` | **Yeni** — `@han/mcp` workspace, 6 tool + 2 resource |
| `apps/hub/src/stream/cache.ts` | StreamEvent type genişlemesi |
| `apps/hub/src/stream/fanout.ts` | Yeni event tipleri broadcast |
| `apps/hub/src/ws/handlers/streamer.ts` | `stream_chunk` payload variant'larını kabul et |
| `apps/runtime/src/viewer/hooks/useStream.ts` | Yeni event'leri ayrı buffer'lara böl |
| `apps/runtime/src/ui/BroadcastFeed.tsx` | Turn/tool_call/file_edit render path |
| `pnpm-workspace.yaml` | `packages/*` zaten dahil; mcp-server orada yaşar |
| `.claude/docs/mcp-setup.md` | **Yeni** — Claude Code kurulum rehberi |

## V1 → V1.5 yol haritası

- V1.5: `han stream` PTY pass-through clean (status'lar sadece viewer'a)
- V1.5: MCP `han_play_roulette`, `han_chat_send` tool'ları
- V1.5: Streamable HTTP transport (Cursor, Aider, n8n)
- V2: Summarizer AI pipeline — raw → semantic event'lere otomatik dönüşüm (PTY mode için)
- V2: Pong + Type Race MCP tool'ları olarak (multiplayer + escrow)

## Referanslar

- Indie pivot: ADR `2026-05-13-indie-product-pivot`
- Tip mimarisi: ADR `2026-05-13-tip-fee-architecture`
- MCP spec: https://modelcontextprotocol.io
- MCP SDK: https://github.com/modelcontextprotocol/typescript-sdk
- Mevcut PTY ADR: `2026-05-12-game-decoupled-ui` (Revision 2)
