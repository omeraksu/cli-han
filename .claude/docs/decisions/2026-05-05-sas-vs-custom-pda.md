# 2026-05-05, SAS vs Custom PDA Attestation Kararı

## Context

Han'ın oyun sonuçlarını on-chain attestation olarak kaydetme ihtiyacı var. İki yol mümkün:

**Yol A, SAS (Solana Attestation Service).** Solana Foundation'ın resmi attestation altyapısı. `sas-lib` paketi, `getCreateAttestationInstruction` ile attestation instruction üretilir, hub authority imzalar ve gönderir. Anchor program tarafında ek kod gerekmez.

**Yol B, Custom Anchor Program.** Han'ın kendi Anchor program'ında bir `record_achievement` instruction. PDA: `[b"ach", player, game_type, nonce]`. Hub authority imzalar.

solana.new validate-idea raporu (2026-05-05) ikisi arasında karar tutarsızlığı tespit etti: CLAUDE.md SAS'tan bahsediyor, architecture.md "ya SAS ya custom" diyor, han-solana-economy skill'i ikisini de spec ediyor. Bu durum agent koordinasyonunda kafa karışıklığı yaratıyor.

## Decision

**SAS kullanılacak. Custom Anchor attestation tamamen kapsam dışı.**

Han'ın Anchor programı sadece game escrow + room state için var. Attestation tamamen SAS üstünden, hub authority off-chain yazıyor.

## Consequences

**Kazandıkları:**
- Solana Explorer'da attestation kutudan görünür (built-in viewer var)
- Composable, başka projeler aynı schema'yı okuyabilir
- Audit avantajı, topluluk pattern'i
- Anchor program scope daha dar, daha az audit yüzeyi
- Hackathon jüri için "etkileyici" faktör (Foundation primitive'i kullanım)
- `sas-lib` paketinin maintained ve dokumented olması

**Kaybettikleri:**
- Bağımlılık var (`sas-lib`), versiyon güncellemeleri takip
- Devnet üstünde SAS programı deployed olmalı (zaten öyle, kontrol ettik)
- Setup adımı: bir kez credential PDA + schema PDA yaratmak (script ile, deployment'ta)
- Schema versionlanma kuralları SAS standartına uymak zorunda

**Migration:**
- han-solana-economy skill'inden "Yol B (Custom Anchor)" bölümü çıkarılacak
- architecture.md'de attestation kararı netleşecek
- CLAUDE.md zaten SAS diyor, değişmiyor
- anchor-engineer agent prompt'unda "attestation custom da olabilir" cümlesi çıkarılacak

**Setup script:**
`scripts/setup-sas.ts` deployment'tan sonra bir kere çalışır:
1. `getCreateCredentialInstruction` ile Han credential PDA yarat
2. `getCreateSchemaInstruction` ile game_result schema yarat (winner, game_type, score, players, ts)
3. Çıkan PDA'ları `.env`'e yaz: `SAS_CREDENTIAL_PDA`, `SAS_SCHEMA_PDA`

**Schema spec:**
```
schema: game_result
version: 1
fields:
  - winner: Pubkey
  - game_type: string (max 32)
  - score: u32
  - player_count: u8
  - room_id: u64
  - timestamp: i64
```

## Status

Accepted, 2026-05-05.

## References

- solana.new validate-idea raporu (2026-05-05)
- SAS docs: https://attest.solana.com/docs
- sas-lib: https://github.com/solana-foundation/solana-attestation-service
