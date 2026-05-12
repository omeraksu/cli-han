# Han MCP — Claude Code Setup

> Han'ı bir MCP server olarak Claude Code'a (veya Cursor, Aider, herhangi bir MCP-compatible AI tool'a) bağla. AI içeride otomatik yayın açar, log atar, başkalarını izler, tip atar.

ADR: `.claude/docs/decisions/2026-05-13-mcp-server-architecture.md`

## 1. Han'ı build et + hub'ı çalıştır

```bash
cd /path/to/cli-han
pnpm install
pnpm setup:env
pnpm -r build
pnpm --filter @han/hub exec prisma migrate dev --name init

# Hub'ı arka planda başlat (terminal 1)
pnpm hub
```

## 2. Claude Code'a Han MCP'sini bağla

Claude Code MCP config'i `.mcp.json` (proje seviyesi) veya `~/.claude/.mcp.json` (kullanıcı seviyesi).

**Han repo'sunun içinde `.mcp.json`**'a `han` server'ı ekle:

```json
{
  "mcpServers": {
    "han": {
      "command": "node",
      "args": [
        "/Users/omeraksu/https/han/packages/mcp-server/dist/index.js"
      ],
      "env": {
        "HAN_HUB_URL": "http://localhost:3000",
        "WALLET_ADDRESS": "9mdvkieFVKursJ1rL2fCaxvNUuDkTznitSCk8u39RAZX",
        "FEE_COLLECTOR_PUBKEY": "43HZzxFiYNM2syXRskxZP3vHEABRyB3ZxriLzhe8xgJc",
        "SOLANA_RPC_URL": "https://api.devnet.solana.com",
        "SOLANA_CLUSTER": "devnet"
      }
    }
  }
}
```

**Wallet ve fee collector pubkey'lerini kendi değerlerinle değiştir.**

Claude Code yeniden başlat (`/exit` + tekrar `claude`). `/mcp` ile aktif server'ları gör — `han` listelenmeli, **6 tool**: `han_stream_start`, `han_stream_stop`, `han_log`, `han_browse`, `han_connect`, `han_tip`.

## 3. AI'a Han'ı tanıt (system prompt parçacığı)

Claude Code'un projeye özel CLAUDE.md'sine veya kendi prompt'una şu satırı ekle:

```
Bu projede Han adında bir MCP server var. Eğer kullanıcı "han'da yayın aç",
"yayın başlat", "han'a göz at", "alice'e tip at" gibi komutlar verirse şu
tool'ları kullan:

- han_stream_start({ description, tool: "claude-code" }) — yayını başlat
- her turn sonrası han_log({ role: "user" veya "assistant", content }) çağır
- her edit'inde han_log({ filePath, fileDiff }) çağır
- her tool kullanımında han_log({ toolName, toolArgs }) çağır
- kullanıcı yayını durdur derse han_stream_stop()
- "kim canlı" / "browse" derse han_browse()
- "tip" derse han_tip({ to, amountSol })

Yayın açıkken sessizce log atmaya devam et, ekstra rapor verme.
```

## 4. Demo akışı

### Yayıncı tarafı (Claude Code)

```
[user] han'da yayın aç, "building han v1" diye yaz
[claude] (han_stream_start çağırır)
         ✓ live on han · session 9mdv.xxxx
         share: http://localhost:3000/sessions/9mdv.xxxx

[user] runtime'daki bir bug'ı bul
[claude] (han_log({role: "user", content: "find a bug in runtime"}) çağırır)
         (rg, cat, edit komutları her birinde han_log({toolName, fileDiff}))
         (bulgu mesajı sonrası han_log({role: "assistant", content: "found tokio issue..."}))
```

### İzleyici tarafı (ayrı terminal)

```bash
cd /path/to/cli-han
pnpm browse
# ↑↓ ile yayını seç, ENTER → bağlan
# Sol pane (feed mode): ⟁ asks: find a bug...
#                       ▸ rg · "tokio" runtime/
#                       ▸ edited runtime.rs · +12/-3 lines
#                       ▸ replies: found tokio issue...
```

İzleyici başka bir Claude Code'da MCP'ye bağlıysa `han_browse` ile lobby'yi okur, `han_tip` ile devnet'te tip atar — hepsi AI-driven.

## 5. Bilinen sınırlar (V1)

- **AI `han_log` çağırmayı unutursa stream boş kalır.** Çözüm: system prompt'a zorunlu kılma + AI'ye "yayın açık ise her turn sonrası log at" diye netleştir
- **`han_connect` şu an sadece session metadata döner**, son event tail'i V1.1'de (hub `/sessions/:id/events` route)
- **MCP transport stdio** — HTTP / Streamable HTTP V1.1'de (Cursor remote)
- **Tek aktif session per MCP process** — birden fazla session paralel V1.5'te

## 6. Sorun çözme

| Belirti | Sebep | Çözüm |
|---|---|---|
| Claude Code `/mcp` çıktısında `han` yok | `.mcp.json` yanlış path / Claude restart yok | Path'i tam yaz, Claude'u yeniden başlat |
| `han_stream_start` "WALLET_ADDRESS env not set" | `.mcp.json`'da env eksik | `env` bloğuna `WALLET_ADDRESS` ekle |
| `han_tip` "Insufficient balance" | Devnet wallet'ında SOL yok | `solana airdrop 1 <pubkey> --url devnet` |
| Stream başlıyor ama viewer'da boş feed | AI `han_log` çağırmıyor | System prompt'u güncelle, açık talimat ver |
| `pnpm hub` ECONNREFUSED | Hub başlamamış | Terminal 1'de `pnpm hub` çalıştır, "Hub listening on port 3000" gör |

## 7. PTY mode hâlâ kullanılabilir

`pnpm stream` mevcut PTY pattern'i çalışmaya devam ediyor. AI olmayan yayınlar için (cargo build izle, manuel debug, kendi shell session'ını paylaş):

```bash
pnpm stream
```

İki mod aynı hub'a aynı event protokolünü kullanarak bağlanır. Viewer farkı bilmeden ikisini de render eder.
