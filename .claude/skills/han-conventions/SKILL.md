---
name: han-conventions
description: Han projesinin yazım, naming, commit, error handling ve test kuralları. Tüm subagent'lar bu kurallara uyar.
---

# Han Conventions

Tüm dosyalar bu kurallara uyar. Sapma istisnasıdır, ADR ile gerekçelendirilir.

## Yazım

- Em dash kullanma
- Kısa cümle, ortalama 8-12 kelime
- Aktif ses
- Tripling yok ("X, Y ve Z" gibi gereksiz üçleme)
- Türkçe-first proje iletişimi, teknik terimler İngilizce
- Adjective yığma yok ("revolutionary", "powerful", "amazing")
- Karar verildiyse alternatif önerme

## Commit

Conventional Commits formatı, İngilizce.

```
feat(runtime): add stream session creation
fix(hub): correct WebSocket reconnect backoff
docs(architecture): clarify summarizer pipeline stages
chore(deps): bump node-pty to 1.0.0
test(games): add pong tick determinism test
feat(programs): implement game escrow settlement
fix(sdk): handle wallet not connected error
feat(summarizer): add heuristic fast-path for command events
```

Scope listesi:
- `runtime` (apps/runtime/, hariç wallet, ui, games alt klasörleri)
- `hub` (apps/hub/, hariç summarizer, games alt klasörleri)
- `summarizer` (apps/hub/summarizer/)
- `games` (apps/hub/games/, apps/runtime/games/)
- `ui` (apps/runtime/ui/)
- `wallet` (apps/runtime/wallet/)
- `programs` (programs/)
- `sdk` (sdk/)
- `docs` (.claude/docs/, README.md, vs.)
- `infra` (deployment, CI/CD)
- `claude` (.claude/agents/, .claude/skills/, .claude/commands/)

## Naming

### Rust (programs/)

- Instruction: snake_case fiil, `create_game_escrow`, `settle_game`
- Account struct: PascalCase, `EscrowVault`, `GameAttestation`
- Error enum: `HanError`, varyantlar PascalCase
- PDA seed prefix: lowercase string, `b"escrow"`, `b"game_result"`

### TypeScript (sdk/, apps/)

- Function: camelCase fiil, `sendTip`, `settleGame`, `getEscrowState`
- Type: PascalCase, `EscrowState`, `GameResult`, `Summary`
- Error class: PascalCase, suffix `Error`, `TipError`, `EscrowError`
- Hook (ink): `use` prefix, `useStream`, `useChat`
- Component (ink): PascalCase, `BroadcastFeed`, `StatusBar`, `WalletStatus`

### Dosya

- Rust: snake_case, `create_game_escrow.rs`
- TypeScript: kebab-case, `ws-client.ts`, `pty-manager.ts`
- React component dosya = component adı: `BroadcastFeed.tsx`

## Error handling

### Rust

- `panic!` kullanma
- `unwrap()` kullanma
- `?` operatörü ile propagation
- Custom error: `#[error_code]` enum
- Error mesajı kısa, çözüm önerisi içerir

```rust
#[error_code]
pub enum HanError {
    #[msg("Stake amount below minimum (0.001 SOL)")]
    StakeTooLow,
    #[msg("Stake amount above maximum (10 SOL, V1 limit)")]
    StakeTooHigh,
    #[msg("Game escrow already settled")]
    AlreadySettled,
    #[msg("Game timeout, refund only")]
    Timeout,
}
```

### TypeScript

- Error class hierarchy: `HanError` base, alt sınıflar
- Async function her zaman try-catch, error context'i ekle
- Error mesajı kullanıcı-görünür değilse İngilizce, görünürse ürün tarafına bırak

```typescript
export class HanError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class TipError extends HanError {}
export class EscrowError extends HanError {}
export class WalletError extends HanError {}
export class StreamError extends HanError {}
```

## Testing

### Anchor (programs/)

- `programs/han/tests/<feature>.ts` dosyası
- Happy path + en az 2 edge case + en az 1 failure case
- PDA derivation test'i ayrı
- `anchor test --skip-deploy` ile koşulur

### SDK (sdk/)

- vitest, dosya `*.test.ts`
- Mock connection ile devnet'siz testler
- Public API her fonksiyonun en az 1 test'i

### Runtime ve hub

- vitest
- PTY mock ile streamer testleri
- WebSocket mock ile transport testleri
- Hub fanout testleri (synthetic stream input)
- Summarizer pipeline testleri (synthetic stream → expected summary)

### Game state machine

- Deterministic test, aynı input → aynı output
- Tick logic'i mock zaman ile (33ms tick, 100 tick = 3.3sn)

### End-to-end (devnet)

- Hackathon haftası critical
- Hub başlat → runtime streamer başlat → runtime viewer → oyun → settle
- Devnet TX'leri explorer'da doğrula

## Dosya boyutu

- Rust dosya: 300 satırı geçmesin, geçecekse instruction'ı module'e böl
- TypeScript dosya: 200 satır
- React component (ink): 150 satır, geçecekse alt component'lere böl

## Imports

### Rust

```rust
// 1. std
use std::convert::TryInto;

// 2. solana / anchor
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token};

// 3. proje içi
use crate::state::*;
use crate::errors::HanError;
```

### TypeScript

```typescript
// 1. node / web standard
import { readFileSync } from 'fs';

// 2. external paketler
import { PublicKey, Connection } from '@solana/web3.js';
import { z } from 'zod';

// 3. proje içi (alias ile)
import { HanClient } from '@/client';
import type { EscrowState } from '@/types';
```

## Async

- `async/await`, `.then()` zincirinden uzak dur
- `Promise.all` paralel işler için
- Race condition riski olan yerlerde mutex/semaphore (gerekirse)

## Logging

- Frontend (runtime CLI): `console.log` sadece dev'de, production'da kaldır veya log seviyesi flag'i
- Backend (hub): structured logging (pino önerilir)
- Anchor program: `msg!` minimum, sadece debug için
- Asla secret veya keypair log'lama, asla kullanıcı output'unu raw log'lama (privacy)

## Security

- Asla secret commit'leme
- `.env` her zaman `.gitignore`'da
- Kullanıcı input'u her zaman validate (zod, joi)
- SQL injection: ORM (Prisma) ile parametrize sorgular
- Rate limit her public endpoint'te (chat, tip)
- WebSocket auth her bağlantıda (session token)

## Documentation

- Public API: JSDoc zorunlu, en az bir `@example`
- Internal function: yalnızca complex logic için yorum
- `// TODO:` yorumu issue numarası ile, `// TODO(#42): ...`
- Skill ve agent dosyaları Türkçe açıklama, kod örnekleri İngilizce

## Konvansiyonel olmayan ama Han'a özel

- **Yayıncı/izleyici/hub** terimleri Türkçe kalır kod yorumlarında. Streamer/viewer/hub karşılığında kullanılır ama Türkçe daha sık.
- **Privacy first.** Yeni feature eklenirken otomatik soru: bu yayıncının ne'sini açığa çıkarır? Cevap "hassas bir şey" ise tasarım gözden geçirilir.
- **Hız önce.** Han real-time. 1 saniye gecikme yayın deneyimini bozar. Performans testleri her PR'da.
- **Topluluk hazırlığı.** Yeni oyun veya plugin nasıl eklenir, hep akılda. SDK pattern'larını V1'de bile düşün.
