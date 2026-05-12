# ADR 2026-05-12 — Game UI decoupled from game engine in V1

## Status

Accepted, 2026-05-12. **Revised** same day after Games sayfası (24:2) was fully inspected — see "Revision" section below.

## Context

Plan ve `CLAUDE.md` V1 scope'u: **2 oyun (Pong + Type-race), Anchor game escrow ile**. Figma tasarımı (`figma.com/design/VhDHQJG33eRrXZz2BZBjFL/cli-han`, frame `10:111`) farklı bir oyun gösteriyor: **solo roulette, no stake, fun mode**. Hint metni: *"free spin · no stake · just for fun"*.

İki çelişki:
1. **Hangi oyun?** Pong vs Type-race vs Roulette.
2. **Escrow var mı?** Roulette mockup "no stake" diyor; Anchor program'da `create_game_room` + `join_game` + `settle_game` zaten yazılı, escrow logic V1 hazır.

Hackathon teslimine 5 saat. Tüm oyun engine + canvas + state machine + integration uçtan uca yetişmez.

## Decision

**V1 UI layer'ı oyun engine'inden ayrıştırılır.** Şu an UI çalışır, gerçek game engine V2'de takılır.

Somut:

1. **Generic `GameCanvas` wrapper** — `apps/runtime/src/ui/GameCanvas.tsx`. Props: `{ gameType: string, children: ReactNode }`. Sadece çerçeve, başlık, hint satırı (Roulette/Pong/Type-race fark etmez). Şu an yalnızca **Roulette mockup statik render eder** (Figma 10:111'a birebir).
2. **Roulette UI mockup** — gerçek state machine yok. Spin animasyonu basit deterministic (timer + frame). "Result" Figma'daki sabit metin: `✦ COMMIT ✦` ve hardcoded dare text.
3. **Game escrow Anchor program V1'de kalır** ama runtime tarafında çağrılmaz. `programs/han/` derleniyor, `sdk/src/escrow.ts` hazır — V2'ye atanmaz, sadece **bağlanmaz**.
4. **`apps/hub/games/` ve `apps/runtime/games/` klasörleri V1'de yaratılmaz.** State machine, server tick loop, multiplayer fanout — hepsi V2.
5. **Solana ekonomisi V1** sadece **tip** akışı (program-less, SystemProgram::transfer). Game escrow on-chain V2 demo.

## Consequences

**Yes:**
- 5 saatte yetişebilir bir hackathon submission
- UI'da görsel deneyim Figma'ya birebir
- Generic canvas community'ye gelecekte plug-in için zemin (han-game-protocol skill'i bu plan'a uyar)
- Anchor program zaten yazıldığı için kod boşa gitmedi — V2'de hub tarafına bağlanır

**No:**
- "On-chain mini-game with stake" hackathon submission'ında **canlı çalışmaz**; sadece arşitekt diyagramında "var" der
- Demo videoda escrow + settle + attestation **gösterilemez**. Tip flow + roulette UI gösterilir
- `game-engineer` agent ve `han-game-protocol` skill'i V1'de devreye girmez

## Implementation impact

| Dosya | Değişiklik |
|---|---|
| `CLAUDE.md` | "V1 scope" bölümü: Pong/Type-race → "UI mockup (Roulette), engine V2"; "Solana micro-economy" bölümü: game escrow V2'ye atan |
| `.claude/skills/han-game-protocol/SKILL.md` | Header'a "V1: UI mockup only, V2: full engine" notu |
| Plan dosyası | Faz 6.2 GameCanvas → Roulette mockup'a daralt |
| `apps/runtime/src/ui/GameCanvas.tsx` | Yeni — wrapper |
| `apps/runtime/src/ui/Roulette.tsx` | Yeni — Figma 10:111 statik render |
| `programs/han/` | Değişiklik **yok** — derlenir ama V1 demo'da çağrılmaz |
| `sdk/src/escrow.ts` | Değişiklik **yok** — export'lar kalır, V2'de hub'dan kullanılır |

## Alternatives considered

- **Tüm 3 oyunu V1'de yetiştir**: 5 saatte mümkün değil
- **Pong escrow ile**: Figma'da Pong tasarımı yok, UI'sını uydurmak Figma ile uyuşmaz, risk
- **Roulette escrow'lu (multiplayer)**: Figma "no stake · solo" diyor, Figma'ya sapma ek bir karar gerektirir
- **GameCanvas'ı tamamen V2'ye at**: Mockup'larda roulette var, ekran tamamen boş kalır → demo zayıflar

## V2 yol haritası

- Anchor `create_game_room` / `join_game` / `settle_game` hub'a bağla
- Topluluk SDK pattern'ı (`apps/hub/games/<oyun>/server.ts` + `apps/runtime/games/<oyun>/client.ts`)
- 3 oyun engine: Roulette multiplayer, Pong, Type-race
- SAS attestation game result için

---

## Revision — 2026-05-12 (same day)

Games sayfası (`24:2`) tam taranınca durum değişti: Figma sadece Solo Roulette değil, **Pong + Type Race** için de tam akış çiziyor (5+5 ekran, on-chain stake + settle + SAS attest dahil). Buna rağmen 5 saatlik foundation hackathon kısıtı ve daha önce kullanıcının "UI'ı oyundan bağımsız yap" tercihi geçerli kalıyor.

**Revize edilmiş V1 kapsamı:**

- ✅ **Games Hub** (`24:11`) — 3 oyun menüsü, hepsi listede; Pong + Type Race "V1.1" rozetiyle. `/play` komutu hub'ı açar.
- ✅ **Solo Roulette** — 4 ekran state machine (idle → spinning → result, plus wheel info), no stake, no engine bağı.
- ❌ **Pong** — 5 ekran ve engine + on-chain stake V1.1'de.
- ❌ **Type Race** — 5 ekran ve engine + on-chain stake V1.1'de.

**Gerekçe**:
- Roulette state machine 4 ekran (~2 saat iş), demo'da gameplay'li mini eğlence
- Hub kartlarında Pong + Type Race görünüyor → ürün vizyonu net, "coming V1.1" rozeti tutarlı
- Anchor program (`programs/han/`) zaten derlenip duruyor — V1.1'de çağrılmaya hazır
- Hackathon demo videosunda Solo Roulette gameplay + Games Hub'ta diğer oyunların görünmesi yeterli storytelling

**Implementation impact (revize):**

| Dosya | Değişiklik |
|---|---|
| `apps/runtime/src/ui/Roulette.tsx` | 4-state machine'e genişlet (idle/spinning/result/wheel-info) |
| `apps/runtime/src/ui/GamesHub.tsx` | Yeni — 3 kart, klavye nav (1-3 select, Q back) |
| `apps/runtime/src/viewer/App.tsx` | `/play` slash command → GamesHub mount |
| `figma-spec.md` | Games sayfası bölümü detaylı eklendi |
