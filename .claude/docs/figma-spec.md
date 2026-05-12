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

## 🖥 Mockups sayfası (`3:3`)

Canvas adı: **"🖥 Mockups"**. Toplam **9 ana ekran**, 4 alt grupta. Hepsi 900×600 terminal mockup formatı, üstte mac-style titlebar (3 ellipse + breadcrumb), altında statusbar.

### A. Streamer flow

| Frame | ID | Konu |
|---|---|---|
| `01 · han stream` | `10:10` | Yayıncı `han stream claude` çalıştırır — session created, id, url, "mode public · devnet", claude code lansmanı, alt status `▮ han abc-123 ◉ live ◎ 0 viewers public · devnet` |
| `02 · stream active` | `10:29` | Yayın akıyor, claude kod yazıyor, dosya scaffold listesi, alt status `▮ han abc-123 ◉ live ◎ 7 viewers 🔥 0.12 SOL 💬 3 new` |

### B. Viewer flow

| Frame | ID | Konu |
|---|---|---|
| `03 · han browse` | `10:51` | Lobby kart listesi (4 yayın). Her kart: kullanıcı adı (cream bold), açıklama, "12 viewers · 1h2min · py + claude", sağda "🔥 0.42 SOL" |
| `04 · connected · alice` | `10:81` | **Split pane** — sol "stream · alice ── feed ─" + intent (`⟁`) + actions (`▸`), sağ "chat ─" + kullanıcılar (teal bold) + mesajlar (cream). Alt komut bar `/raw /play /tip /quit` |

### C. Interaction

| Frame | ID | Konu |
|---|---|---|
| `05 · solo rulet` | `10:111` | Solo roulette wheel (520×170 kutu), "✦ COMMIT ✦" sonuç, dare text "make your next commit in the next 5 minutes". Hint "free spin · no stake · just for fun". Komutlar: `[R] spin again`, `[T] tip the host`, `[Q] quit` |
| `06 · /tip alice` | `10:128` | Tip dialog. tipbox: `to alice.sol (7xK...mN9)`, `amount 0.05 SOL`, `network devnet`. `[Y] confirm [N] cancel`. Onay sonrası `✓ sent.`, `sig: 4xK...`, `solscan.io/tx/...`, "thanks for supporting the build 🔥" |

### D. Live stats

| Frame | ID | Konu |
|---|---|---|
| `A · status bar default` | `27:7` | **2-satır zengin status bar**. Satır 1: `▮ han · abc-123 · ◉ live ◎ 7 · 🔥 0.12 USDC · 💬 3 new · ◆ claude · sonnet 4.5 · $ 0.42 spent · ⏱ 23m`. Satır 2: `24.1k tok in · 8.2k out · 3 files touched · 5 cmds · peak 12 viewers · press /stats` |
| `B · /stats streamer` | `27:35` | Streamer dashboard. 4 box: AI (prompts/tokens/cost/latency), AUDIENCE (viewers/peak/curve), ECONOMY (tips/margin), ACTIVITY (files/cmds/lines/games/top tipper) |
| `C · /stats viewer` | `27:95` | Viewer perspective. Profile card (avatar + handle + pubkey + NOW intent). SESSION SNAPSHOT — viewers/tips/prompts/files/games/top tipper. MOMENTUM viewer curve sparkline |

### Mockups — kritik UI detayları

**Renk kullanımı** (Figma 04 split pane'den ölçüldü):
- Bölüm başlıkları (`─ stream ─`, `─ chat ─`, `─ feed ─`) → **ember** bold
- Intent satırı (`⟁`) → **cream**
- Action satırları (`▸`) → **rotation: success-green / amber / teal** (her satır farklı, görsel ritm)
- Kullanıcı adı (chat) → **teal** bold
- Mesaj içeriği → **cream**
- Hint/secondary text → **dim** (#6B6660 — yumuşatılmış cream)
- Cursor → **cream** kutu (8×14), önünde `>` ember bold
- Statusbar background → **ash**
- Statusbar metin → **dim**, key komutlar (`/raw /play`) belirgin
- Titlebar background → **ash**
- Titlebar 3 ellipse → red/yellow/green sentetik mac dots (Figma'da generic ellipse, terminal'de basit `● ● ●` renkli render)
- Vertical divider (split pane ortası) → **smoke** 1px

**Tipografi**: JetBrains Mono 13px ana, 11px statusbar/secondary. Bold için JetBrains Mono Bold.

**Layout**: 900px width = sabit yatay; terminal'de width'e göre ölçeklenir. Split pane oranı ~52/48 (470px sol / 410px sağ). Pong-için zorunlu min 80 col korunur.

**Yeni semantic eklenen renkler** (brand'in 7 tokenı dışı, görsel ritm için):
- **success-green** (`#82C784`) — yeşil action / test pass / success — `colors.successBright` olarak eklenebilir
- **dim text** (`#6B6660`) — cream'in karartılmış varyantı, dim ANSI alternative

### Implementasyon notları

1. **Roulette ≠ Pong/Type-race.** Figma "solo rulet" gösteriyor, no stake, free spin. Daha önceki plan'da Pong/Type-race vardı — karar lazım (kullanıcıya soruldu).
2. **Action satırları renk rotation** ufak bir görsel polish. İlk implementasyonda hepsi success-green olabilir, sonra rotation eklenir.
3. **`/stats` ekranı** mevcut plan'da yoktu. V1 scope dışı bırakılabilir, V1.1'e atılır.
4. **Statusbar 2-satır** zengin metrik — mevcut StatusBar.tsx'i bunu destekleyecek şekilde genişlet.

---

## 🎮 Games sayfası (`24:2`)

Canvas adı: **"🎮 Games"**. Toplam **14 ekran**, 3 oyun + 1 hub. Hepsi 900×600 terminal mockup.

### A. Games Hub (`24:11`) — V1 ✅

| Frame | ID | Konu |
|---|---|---|
| `00 · games hub` | `24:11` | `/play` komutu — 3 oyun kartı: Solo Roulette (`◇`, free, 10s), Pong (`◆`, 2-player, on-chain stake), Type Race (`✦`, up to 6 racers, winner takes pot). `[ 1-3 ] select [ Q ] back to stream` |

### B. Solo Roulette (4 ekran) — V1 ✅

| Frame | ID | Konu |
|---|---|---|
| `1.1 · idle` | `24:42` | Wheel kutusu (520×200) içinde `▮ ? ▮`, "press SPACE to spin". Komutlar: `[SPACE] spin`, `[W] see what's on the wheel`, `[Q] back to hub`. Hint: "→ free · no stake · just a nudge" |
| `1.2 · spinning` | `24:58` | Wheel içinde `▮ ◆ ▮ ◇ ▮ ◆ ▮ ◇ ▮` flicker animation, "spinning...". Speed progress bar (400px, 260px filled), "slowing down..." |
| `1.3 · result` | `24:73` | Wheel içinde `✦ COMMIT ✦` (amber bold) + dare 2 satır. Komutlar: `[R] spin again`, `[T] tip the host (0.05 SOL)`, `[S] share result in chat`, `[Q] quit` |
| `1.4 · the wheel` | `24:89` | 6 nudge listesi (eşit ağırlık): COMMIT (ship), STRETCH (stand up 30s), SIP (water/coffee), READ (skim doc), SHARE (paste chat), NUDGE (tip another builder · 0.01 SOL). Hint: "customizable in V2" |

### C. Pong (5 ekran) — **V1.1'e atıldı**

| Frame | ID | Konu |
|---|---|---|
| `2.1 · pong lobby` | `24:121` | Oda kartları (3 örnek): alice's room (1/2, 0.01 SOL, open), open room (0/2, 0.05 SOL), kerem vs bob (2/2, busy). `[J] join [C] create [R] refresh` |
| `2.2 · joining` | `24:147` | Stake confirm box: room, format (first to 3), stake, pot, network. Uyarı: "stake will lock in escrow until the game settles. if host cancels or after 24h, you can claim refund." `[Y] stake & join [N] cancel` |
| `2.3 · ready` | `24:164` | 2 player kart (alice/you), pot 0.02 SOL "locked in escrow", "GAME STARTS IN 3" countdown, controls hint |
| `2.4 · playing` | `24:184` | Score üstte (alice 1 vs you 0), field (852×360) içinde dashed center line, 2 paddle, 1 ball. Statusbar: "W/S paddle · ESC pause · ◉ live · pot 0.02 SOL · 3 watching" |
| `2.5 · game over` | `24:220` | "✦ alice wins 3-2 ✦", settle box (final score, pot, winner, prize, settle tx). `✓ settled on-chain`, `✓ result attested via SAS · schema: game_result · explorer link`. `[R] rematch [Q] lobby` |

### D. Type Race (5 ekran) — **V1.1'e atıldı**

| Frame | ID | Konu |
|---|---|---|
| `3.1 · type race lobby` | `24:243` | Oda kartları: rust async basics (3/6, 168 chars, code), solana docs intro (1/6, 240 chars, prose, free), typescript types 101 (6/6, 312 chars). `[J] join [C] create` |
| `3.2 · joining` | `24:268` | Preview box (yazılacak text), text length, racers, stake, pot. `[Y] stake & join [N] cancel` |
| `3.3 · ready` | `24:289` | Racer listesi (◉ alice ready, ◉ bob ready, vs.), "auto-start in 30s", pot in escrow, "STARTING IN 3" countdown |
| `3.4 · racing` | `24:312` | Live progress bars (her racer için), wpm, time. Bottom: text preview ile kursor pozisyonu. Statusbar: "3 viewers watching · pot 0.04 SOL · room rust-async" |
| `3.5 · results` | `24:346` | Leaderboard (1 alice 100% 74wpm, 2 kerem, 3 you, 4 bob DNF). `✓ 0.04 SOL → alice.sol`, `✓ attested via SAS · game_result schema`. `[R] rematch [N] new text [Q] lobby` |

### Games sayfası — kritik UI detayları

**Renk kullanımı:**
- Oyun sembolleri: ◇ (roulette dim), ◆ (pong cream), ✦ (type race amber)
- Live/Open status: ◉ live = success-green, ◉ open = info teal, ◉ busy = ember/highlight
- Pot SOL miktarı: 🔥 + ember bold
- Result başlık: `✦ COMMIT ✦` veya `✦ alice wins ✦` → amber bold, büyük

**Wheel kutusu** (Roulette): rounded border, ash bg, smoke border, 520×200, içerik ortalı

**Stake confirm box**: rounded, ash bg, key-value satırları, alt'ta ⚠ uyarı 2 satır

**Pong field**: 852×360, dashed center line (vertical, 8px segments, 2px gap), 2 paddle (8×64 each, sol/sağ), 1 ball (12×12 ellipse)

**Type race progress bar**: `████████████████░░░░` block karakterleri (Unicode `█` ve `░`), 20 segment, % ve wpm sağda

### V1 implementasyon kararı (revize)

ADR `2026-05-12-game-decoupled-ui` revize edildi. V1 kapsamı:

- ✅ Games Hub (24:11)
- ✅ Solo Roulette 4 ekran (24:42, 24:58, 24:73, 24:89) — state machine UI (idle → spinning → result), no stake
- ❌ Pong 5 ekran — V1.1'e atıldı (UI dahil hiçbir şey V1'de yok)
- ❌ Type Race 5 ekran — V1.1'e atıldı
- ❌ Anchor escrow on-chain bağı — V1.1'e atıldı (program kodu derlenir, runtime'dan çağrılmaz)

Demo akışı: viewer `/play` → Games Hub → `1` ile Solo Roulette → SPACE ile spin → result → R ile tekrar veya Q ile geri. Pong + Type Race hub kartları görünür ama "coming in V1.1" overlay olabilir.

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
