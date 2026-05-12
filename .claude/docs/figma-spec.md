# Figma Spec — cli-han Design

> Kaynak: `figma.com/design/VhDHQJG33eRrXZz2BZBjFL/cli-han`
> Çıkarılma tarihi: 2026-05-12
> Bu doküman terminal UI implementasyonunun referansıdır. Sapma varsa commit mesajında gerekçesi yazılır.

---

## 🎨 Brand sayfası (`0:1`)

Han'ın görsel kimliği. Üç frame: wordmark hero, color tokens, typography.

### Renk paleti (frame `3:11`)

| Token | Hex | Rol | ANSI yaklaşımı |
|---|---|---|---|
| `ink` | `#0E0E0E` | background — terminal ana zemin | terminal default bg |
| `ash` | `#1A1816` | surface — panel/kart zemin | bg `#1A1816` (truecolor) |
| `smoke` | `#2A2826` | border — ayraç çizgi | dim gri (`bright black` 8-color) |
| `cream` | `#EDE6D6` | foreground — ana metin | bright white veya `#EDE6D6` (truecolor) |
| `ember` | `#E0633A` | accent — CTA, vurgu, Han turuncusu | bright red yaklaşık, gerçek `#E0633A` |
| `teal` | `#5FA8A0` | info — bilgi, link, status | bright cyan yaklaşık, gerçek `#5FA8A0` |
| `amber` | `#E8C56B` | highlight — ödül, uyarı, vurgu | bright yellow yaklaşık, gerçek `#E8C56B` |

**Karanlık tema baz alındı.** ink + ash + smoke nötr nokta, ember tek sıcak accent, teal+amber ikincil tonlar.

### Tipografi (frame `3:49`)

| Font | Kullanım | Terminal'de |
|---|---|---|
| **JetBrains Mono** (Regular, Bold) | display, ui, code — terminal'in doğal fontu | Kullanıcının terminal monospace ayarını kullan; Bold = ink `bold` attribute |
| **Inter** (Regular) | body, meta, ui labels — Figma mockup'ta proportional metin | Terminal'de monospace zorunlu — Inter kullanılan yerler kullanıcı terminal fontuyla render olur |

### Wordmark + slogan (frame `3:4`)

- Wordmark: `cli-han` (büyük JetBrains Mono Bold, 317px height örnek)
- Slogan TR: **"yolda bir mola. terminalden çıkmadan."**
- Slogan EN/alt: **"terminal-native ambient social layer for AI-assisted developers"**
- README + pitch deck için kullanılır

---

## 🖼 Mockups sayfası (`?`)

> Beklemede — kullanıcıdan node ID lazım.

---

## 🎮 Games sayfası (`?`)

> Beklemede — kullanıcıdan node ID lazım.

---

## 👤 Profile sayfası (`26:2`)

5 ekran içerir, hepsi 900×600 terminal mockup formatı, üstte titlebar (mac-style 3 nokta + breadcrumb), altında klavye komut satırı.

### Ekran 1 · setup (`26:12`) — first time

- **Titlebar**: `~/ — first time setup`
- **İçerik**:
  - Başlık: `▮ welcome to han`
  - Status: `wallet connected · 7xK8mN9pQrStUvWx...` (truncated pubkey)
  - **ASCII avatar kutusu** (140×140) — pubkey'den deterministik üretilen 3×3 sembol grid (`◆ ▮ ◇` desen örneği)
    - "your ascii avatar"
    - "derived from your pubkey."
    - "deterministic — same wallet, same avatar."
    - `[ R ] regenerate seed`
  - **Handle input**: `pick a handle` etiket, kutu içinde `@omar` cursor + `✓ available` sağda
  - **Bio input** (opsiyonel): `add a one-liner (optional)`, kutu içinde örnek "builder · ai × web3 · kozalak hub"
- **Klavye altta**: `[ ENTER ] save and enter han`

### Ekran 2 · view (other) (`26:39`) — başkasının profilini gör

- **Titlebar**: `~/ — han · /profile alice`
- **İçerik**:
  - ASCII avatar 100×100 (`✦ ◆ / ◇ ▮ / ▮ ✦` grid)
  - Yanında: `@alice`, `alice.sol`, pubkey, bio "vibe coding solana games · istanbul"
  - Live status: `◉ live now · streaming for 1h 2min · 12 viewers`
  - Border ayraç (1px line)
  - `/ stats` bölümü — 3 sütun × 2 satır:
    - streams hosted: 48
    - hours streamed: 210
    - tips received: 124.5 USDC
    - games played: 32
    - games won: 21
    - pot earned: 8.2 USDC
  - `links` bölümü: `github.com/alice · twitter.com/alice`
- **Klavye altta**: `[ W ] watch stream  [ T ] tip  [ B ] back`

### Ekran 3 · view (self) (`26:73`) — kendi profilini gör

- **Titlebar**: `~/ — han · /profile me`
- **Fark**: `@omar · this is you` etiketi, `no .sol yet — [ S ] register` (sol kaydı varsa o görünür), `member since · 2026-05-12`
- **Stats** aynı yapı ama düşük sayılar (yeni kullanıcı)
- **Klavye altta**: `[ E ] edit profile  [ S ] settings  [ B ] back`

### Ekran 4 · edit (`26:107`) — profili düzenle

- **Titlebar**: `~/ — /profile edit`
- **Başlık**: `▮ edit profile`
- **Hint**: "changes save off-chain. avatar derived from pubkey."
- **4 form alanı** (her biri 852px geniş, 40px yükseklik):
  - `handle` — `@omar`
  - `display name (optional)` — `Ömer Aksu`
  - `bio (one line)` — `builder · ai × web3 · kozalak hub` + sağda `38 / 80 chars`
  - `links` — `github.com/omeraksu`
- **Klavye altta**: `[ TAB ] next field  [ S ] save  [ ESC ] cancel`

### Ekran 5 · settings (`26:132`) — privacy + wallet

- **Titlebar**: `~/ — /settings`
- **Başlık**: `▮ settings`
- **`/ privacy` bölümü**:
  - `privacy filters` toggle — "redact secrets in stream before sending" — `[ ON ]` (default)
  - `summarizer mode` — "how often ai feed updates" — `[ medium ]` (10s window)
- **Ayraç**
- **`/ wallet` bölümü**:
  - Wallet kart: `◆ phantom` + pubkey + `connected · devnet` + sağda `[ U ] unlink`
  - `usdc balance` — `4.20 USDC · on devnet` + sağda `[ + ] mint test USDC`
- **Klavye altta**: `[ ↑↓ ] navigate  [ ENTER ] toggle  [ B ] back`

### Profile sayfası — ortak kalıplar

| Kalıp | Detay |
|---|---|
| **Titlebar** | 900×38, sol başta 3 noktalı mac-style ellipse (16/34/52 px x), ortada breadcrumb (`~/ — ...`) |
| **Klavye komut satırı** | En altta, `[ KEY ] action` formatında, hint metni JetBrains Mono 14-15px |
| **Section başlığı** | `/ name` formatında, JetBrains Mono Regular, ember (`#E0633A`) |
| **Ayraç** | 852×1 rounded-rectangle, smoke (`#2A2826`) |
| **Input box** | 852×40 veya 852×52, border smoke, inner padding 16px |
| **Pubkey gösterim** | Truncated `7xK8mN9pQrStUvWxYz1AbCd...` (genelde 16-20 karakter + `...`) |
| **Status indikatörü** | `◉` (live), `●` (connected), `◆`/`◇`/`▮`/`✦` (avatar sembolleri) |

---

## Terminal'e indirgeme notları

Bu Figma 900×600 px mockup; Han terminal CLI olarak çalışır. Render kısıtları:

1. **Sabit boyut yok** — kullanıcı terminal'i her boyutta olabilir. Ink Box ile responsive layout. Min 80 sütun varsayım.
2. **Truecolor desteği** — `#E0633A` gibi hex direkt ANSI 24-bit escape (ink `<Text color="#E0633A">` destekliyor).
3. **Tek font** — Inter render olmaz, hepsi kullanıcının terminal monospace fontu. Inter sadece pitch deck için referans.
4. **ASCII avatar** — 3×3 sembol grid `◆ ▮ ◇` gibi unicode block. Pubkey hash → emoji index'leri.
5. **Border'lar** — ink `<Box borderStyle="single" borderColor="#2A2826">` ile ASCII box drawing (`┌─┐│└┘`).
6. **Klavye komut satırı** — sabit alt çubuk, status bar gibi davranır.

---

## Implementasyon haritası (sıra)

| Adım | Figma sayfa | Han tarafı | Commit hedefi |
|---|---|---|---|
| 1 | Brand | `apps/runtime/src/ui/colors.ts` token sistemine geç | `feat(ui): align colors with figma brand palette` |
| 2 | Mockups | viewer/streamer layout + StatusBar/BroadcastFeed güncellemesi | `feat(ui): implement mockup layouts from figma` |
| 3 | Games | GameCanvas + Pong/Type-race şablon | `feat(ui): add game canvas matching figma games page` |
| 4 | Profile | 5 ekran component'i + slash command bağı (`/profile`, `/settings`) | `feat(ui): add profile + settings screens` |

Mockups + Games node ID'leri eklendiğinde bu doküman güncellenir.
