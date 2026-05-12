---
description: Devnet üstünde tip ve attestation flow testi
---

Solana entegrasyonunun uçtan uca testi. Han için kritik akışları doğrular.

Adımlar:

1. **Setup**: devnet wallet'ında en az 0.1 SOL olmalı (`solana balance`, gerekirse `solana airdrop 1`)
2. **Program kontrol**: Anchor program devnet'te deployed (`/deploy-devnet` çıktısı), SAS credential/schema PDA'ları `.env`'de
3. **RPC failover kontrol**: `scripts/test-rpc-failover.ts`
   - Birincil endpoint'e ping
   - Birincili kasten patlat (geçersiz URL set), ikincile (Helius) düşmeli
   - Failover transparent olmalı (kullanıcı seviyesi başarı)
4. **Tip flow**: `scripts/test-tip.ts`
   - Test wallet'tan başka bir test wallet'a 0.01 SOL transfer (program-less, SystemProgram)
   - TX signature dön, devnet explorer'da doğrula
5. **Game escrow flow**: `scripts/test-game-escrow.ts`
   - create_game_room, 2 oyuncu join_game (her biri 0.01 SOL)
   - Hub authority settle_game çağırır, kazanan'a 0.02 transfer
   - Vault account drain edildi mi
6. **SAS attestation flow**: `scripts/test-attestation.ts`
   - settle sonrası `attestGameResult` çağır
   - SAS attestation PDA explorer'da görünüyor mu (https://explorer.solana.com/address/<pda>?cluster=devnet)
   - Payload doğru parse oluyor mu (`fetchAttestation`)
7. **Cancel + claim_refund**: `scripts/test-cancel-refund.ts`
   - Room yarat, host cancel_game çağır
   - Her oyuncu claim_refund ile kendi stake'ini çeker
8. **Timeout refund (V1 kritik)**: `scripts/test-timeout-refund.ts`
   - Room yarat (mock'ta `created_at` 25 saat öncesine ayarla, veya gerçek devnet'te 24h+1 bekle — opsiyon)
   - Bir oyuncu `timeout_refund` çağır, kendi stake'ini çekmeli
   - İkinci kez aynı oyuncu çağırırsa AlreadyRefunded error
   - Tüm oyuncular çektiyse status `timed_out` olmalı

Hata olursa **debug-specialist**'e ver. **anchor-engineer** veya **solana-client-engineer**'a delegate edilebilir.

Başarılıysa rapor:
- Tip TX hash
- Escrow + settlement TX hash
- SAS attestation PDA + TX hash
- Cancel + claim_refund TX hashes
- Timeout_refund TX hash
- RPC failover doğrulandı (yes/no)
- Toplam SOL harcaması (gas + airdrop)

Bu raporu `.claude/docs/devnet-test-results.md` altına kaydet, demo öncesi son referans.
