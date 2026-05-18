# ADR 2026-05-13 — Tip fee architecture (%3 program-less)

## Status

Accepted, 2026-05-13.

## Context

Indie product pivot'ında (ADR `2026-05-13-indie-product-pivot`) birincil V1 gelir modeli **tip komisyonu %3** olarak seçildi. Mevcut `sendTip` SDK fonksiyonu tek `SystemProgram::transfer` instruction (viewer → streamer, %100). Komisyon mimarisi tasarım kararı gerektiriyor.

## Decision

**Seçenek A** kullanılır: program-less iki transfer tek TX.

```typescript
const lamportsTotal = solToLamports(amount);
const lamportsFee = Math.floor(lamportsTotal * 0.03);
const lamportsToStreamer = lamportsTotal - lamportsFee;

const ix1 = SystemProgram.transfer({
  fromPubkey: viewer,
  toPubkey: feeCollector,
  lamports: lamportsFee,
});

const ix2 = SystemProgram.transfer({
  fromPubkey: viewer,
  toPubkey: streamer,
  lamports: lamportsToStreamer,
});

const tx = new Transaction().add(ix1, ix2);
tx.sign(viewerKeypair);
const sig = await connection.sendRawTransaction(tx.serialize());
```

Tek imza, atomik (ya hepsi geçer ya hepsi başarısız). Anchor program'a gerek yok.

## Detaylar

### Fee oranı

**%3** sabit, V1'de değiştirilmez. Yapılandırma `sdk/src/tip.ts`'te sabit, gelecekte env veya config'e taşınabilir.

```typescript
export const TIP_FEE_BPS = 300; // 3% in basis points
```

### Fee collector keypair

- **Devnet**: yeni keypair `~/.config/solana/han-fee-collector.json`, ayrı bir wallet (hub authority'den de kişisel keypair'den de farklı)
- **Mainnet** (V2 sonrası): aynı keypair'in mainnet kullanımı, **multisig** (Squads) tercih edilir kullanıcı kararı

Gerekçe: fee collector hesabı ayrı tutulur ki:
1. Hub admin (`GBTmt5Cg...`) attestation/settle imzalamak için kullanılır, fee ile karışmasın
2. Kişisel (`9mdvkieFV...`) deploy/test/normal işlemler için
3. Fee collector sadece komisyon biriktirir, audit edilebilir cüzdan

### UI gösterim

TipDialog'da fee transparent gösterilir:

```
to        @streamer (7xK...mN9)
amount    0.0500 SOL
fee       0.0015 SOL  (3%, supports han)
streamer  0.0485 SOL
network   devnet

[ Y ] confirm  [ N ] cancel
```

### Hub doğrulaması

Hub `/tips` REST endpoint:
1. TX signature alır
2. RPC `getTransaction(sig)` ile fetch eder
3. İki transfer instruction olduğunu doğrular
4. Tutarları kontrol eder: `amount * 0.03` ± 1 lamport tolerance fee_collector'a, kalan streamer'a
5. Doğru cüzdanlar (viewer signer, fee_collector receiver, streamer receiver)
6. Postgres `tips` tablosuna kayıt: `amount_lamports`, `fee_lamports`, `streamer_lamports`, `tx_signature`, `created_at`

Tolerance: Math.floor yuvarlamasından dolayı 1 lamport sapma olabilir. `Math.abs(actual_fee - expected_fee) <= 1` kontrolü.

### SDK API

```typescript
export interface SendTipParams {
  viewer: Keypair;
  streamer: PublicKey;
  feeCollector: PublicKey;
  amountSol: number;
  connection: Connection;
}

export interface SendTipResult {
  signature: string;
  feeLamports: number;
  streamerLamports: number;
}

export async function sendTipWithFee(params: SendTipParams): Promise<SendTipResult>
```

Eski `sendTip(connection, fromKeypair, toWallet, amount)` deprecated, V1'de kaldırılır (breaking change, hub yeni endpoint'i kullanır).

### Postgres şema değişikliği

Mevcut `tips` tablosuna iki kolon ekleme:

```sql
ALTER TABLE tips ADD COLUMN fee_lamports BIGINT NOT NULL DEFAULT 0;
ALTER TABLE tips ADD COLUMN streamer_lamports BIGINT NOT NULL DEFAULT 0;
```

Yeni tip'lerde `fee + streamer = amount`. Eski tip'lerde `fee = 0`, `streamer = amount` (default backfill).

## Alternatives considered

### Seçenek B — Anchor program ile bookkeeping

```rust
pub fn tip(ctx: Context<Tip>, amount: u64) -> Result<()> {
    let fee = amount.checked_mul(300).unwrap().checked_div(10000).unwrap();
    let to_streamer = amount.checked_sub(fee).unwrap();

    invoke_signed(
        &system_instruction::transfer(viewer, fee_collector, fee),
        ...
    )?;
    invoke_signed(
        &system_instruction::transfer(viewer, streamer, to_streamer),
        ...
    )?;

    emit!(TipEvent { ... });
    Ok(())
}
```

Avantaj:
- Event emit, on-chain queryable
- Fee oran program'da (immutable, audit edilebilir)
- Akademik olarak temiz

Dezavantaj:
- 1 hafta ek geliştirme (instruction, test, IDL refresh, SDK güncelleme)
- CPI maliyeti (compute unit) program-less'ten 2-3x fazla
- Program upgrade gerektirir fee oran değişirse (mainnet'te zor)
- Anchor 1.0.1 + `invoke_signed` kompleksite

V1 için fazla mühendislik. V2'de gerek olursa migrate edilebilir.

### Seçenek C — Off-chain bookkeeping

Tip %100 streamer'a gider. Hub yan'da bir log tutar, ay sonu manuel hesaplama. Streamer manuel olarak %3'ü gönderir.

Reddedildi: kullanıcı güveni ve otomasyon eksikliği. Manuel ödemeler unutulur, dispute'lar ortaya çıkar.

### Seçenek D — Token (USDC) tip

V1'de SOL ile başla (SystemProgram::transfer, basit). V2'de USDC tip eklenir (SPL Token CPI). Token tip için Anchor program zorunlu olur, Seçenek B'ye geri dönmek gerek.

V1 dışında.

## Consequences

**Pozitif**:
- 1-2 günlük iş (SDK refactor + UI + hub verify)
- Atomik, kullanıcı için tek imza
- Audit edilebilir (Solana Explorer'da iki transfer görünür)
- Devnet'te test edilebilir, gerçek SOL riski yok
- Fee oran değişikliği SDK release ile (frontend update)

**Negatif**:
- Fee oran SDK'da hardcoded — değişirse tüm client'lar güncellenmeli (V2'de program'a taşınır)
- Off-chain event tracking (TX log fetch) hub bağımlı — hub offline ise tip kayıtlanmaz
- Multi-streamer split (gelecekte: takım yayın) bu mimari için yeniden tasarım gerek

**Risk mitigasyonu**:
- Hub indeksleme bir background job'a alınır (eventual consistency, 1-5dk lag OK)
- Postgres backup günlük

## Implementation plan

Sprint 2 görevleri (ADR `2026-05-13-indie-product-pivot` Sprint 2):

1. `solana-keygen new -o ~/.config/solana/han-fee-collector.json --no-bip39-passphrase`
2. `.env`'e `FEE_COLLECTOR_PUBKEY=...` ekle
3. `sdk/src/tip.ts` → `sendTipWithFee` implement, `sendTip` deprecated
4. `apps/runtime/src/ui/TipDialog.tsx` → fee gösterim güncelle
5. `apps/runtime/src/viewer/App.tsx` → `/tip <amount>` slash command dispatcher
6. `apps/hub/src/routes/tips.ts` → RPC verification + iki transfer check
7. Prisma migration: `tips` tablosuna `fee_lamports` + `streamer_lamports` kolonları
8. E2E test (`/solana-flow-test`): devnet'te 0.01 SOL tip at, fee collector balance %3 artar, streamer %97 alır

Süre tahmini: 1-2 gün.

## Referanslar

- Indie pivot: ADR `2026-05-13-indie-product-pivot`
- Solana SystemProgram docs: https://docs.rs/solana-program/latest/solana_program/system_instruction/
- Squads multisig (mainnet için, V2 sonrası): https://squads.so/
