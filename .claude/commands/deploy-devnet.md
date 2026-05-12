---
description: Han programı devnet'e deploy et, IDL'i SDK'ya senkron tut
---

Sırayla:

1. `anchor build` çalıştır, çıktıyı kontrol et
2. `solana balance` ile devnet wallet'ında SOL var mı bak, yoksa airdrop iste (`solana airdrop 2`)
3. `anchor deploy --provider.cluster devnet` çalıştır
4. Yeni program ID'yi `Anchor.toml` ve `programs/han/src/lib.rs` `declare_id!` makrosunda güncelle
5. `anchor build` tekrar (program ID değişti)
6. `anchor deploy --provider.cluster devnet` tekrar (yeni binary)
7. IDL'i `target/idl/han.json` altından `sdk/idl/han.json`'a kopyala
8. **solana-client-engineer**'a IDL refresh yaptır, type'ları güncelle → `chore(programs): sync idl after devnet deploy <programId>` commit
9. Devnet program ID'yi `.env.example` ve README.md'ye yaz → `chore(docs): bump devnet program id` commit
10. **SAS setup** (ilk deploy'da): `npx tsx scripts/setup-sas.ts` çalıştır. Credential ve schema PDA'ları yarat, çıktıyı `.env`'e yaz (`SAS_CREDENTIAL_PDA`, `SAS_SCHEMA_PDA`)
11. **RPC fallback kontrolü**: `.env`'de `HELIUS_RPC_URL` set mi, yoksa Helius key al ve ekle
12. Bir test transaction at (`/solana-flow-test` ile), başarılıysa onayla

Hata olursa **debug-specialist**'i çağır.

Notlar:
- İlk deploy'dan sonra program ID değişmez, sonraki deployment'larda 1, 2, 6, 7, 8 yeterli
- SAS setup bir kere çalışır, schema değişirse yeni version yaratılır (eski PDA değişmez)
- Mainnet deploy ayrı komut, bu sadece devnet
