---
description: Yeni mini-game scaffold yarat
argument-hint: <oyun-adı> (kebab-case, örn: snake, tetris, reaction-test)
---

Yeni oyun: $ARGUMENTS

**game-engineer** agent'ını çağır.

Sırayla:

1. `han-game-protocol` skill'ini oku, contract'a uy
2. Server tarafı klasör yarat: `apps/hub/games/$ARGUMENTS/`
   - `manifest.json` (ad, açıklama, max oyuncu, süre tahmini)
   - `server.ts` (GameServer<State> implementasyonu)
3. Client tarafı klasör yarat: `apps/runtime/games/$ARGUMENTS/`
   - `client.ts` (GameClient implementasyonu, render + input)
4. State type'ı `apps/hub/games/$ARGUMENTS/types.ts` içinde tanımla
5. Hub registry'sine yeni oyunu ekle (`apps/hub/src/games/registry.ts`)
6. **ui-designer**'a oyun canvas'ının terminal UI'a uyduğunu doğrulat
7. **qa-engineer**'a state machine testi yazdır (deterministic, tick logic)

Çıktı:
- Klasörler ve dosyalar
- State type definition
- Server tick logic kısa açıklama
- Client render kısa açıklama
- Win condition
- Test komutu

Tipik oyun süresi 1-3 dakika hedef. Demoda klip için iyi olmalı.
