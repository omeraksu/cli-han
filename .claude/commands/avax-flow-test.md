---
description: Fuji testnet üstünde tip ve game escrow flow testi
---

Avalanche entegrasyonunun uçtan uca testi. Han için kritik akışları doğrular.

Adımlar:

1. **Setup**: Fuji wallet'ında en az 0.1 AVAX olmalı (`cast wallet balance <addr> --rpc-url $AVAX_RPC_URL`, yoksa https://faucet.avax.network/)
2. **Contract kontrolü**: Han ve HanTipRouter Fuji'de deployed (`/deploy-fuji` çıktısı), adresler `.env`'de set
3. **RPC failover kontrolü**: viem `fallback` transport'u doğrula
   - Birincil endpoint'e basit `getBlockNumber` call
   - Geçici olarak birincili bozuk URL ile değiştir, request ikincisine düşmeli
   - Failover transparent olmalı (kullanıcı seviyesi başarı)
4. **Tip flow**: `pnpm --filter @han/scripts tip`
   - Env: `HAN_TIP_ROUTER_ADDRESS`, `STREAMER_ADDRESS`, `AMOUNT_AVAX=0.001`
   - HanTipRouter.tip() çağrısı tek imzayla
   - TX hash dön, https://testnet.snowtrace.io/tx/<hash> doğrula
   - `Tipped` event içeriği: viewer/streamer/amount/feeAmount/streamerAmount
5. **Game escrow flow**: `pnpm --filter @han/scripts escrow`
   - Env: `HAN_CONTRACT_ADDRESS`, `AUTHORITY_PRIVATE_KEY`, `HOST_WALLET_PATH`, `PLAYER_WALLET_PATH`
   - createGameRoom + joinGame (2 oyuncu, her biri 0.001 AVAX)
   - Authority `settleGame` çağırır, kazanan'a (host) payout - fee
   - Snowtrace'te `GameSettled` event doğrula
6. **Cancel + claimRefund**: ek manuel test script veya yeni `test-cancel-refund.ts`
   - createGameRoom + joinGame, sonra host cancelGame
   - Her oyuncu claimRefund ile kendi stake'ini çeker
7. **Timeout refund (V1 kritik)**: forge test ile lokal doğrulanır (`vm.warp(+25 hours)`), Fuji'de manuel test 24h+1 bekleme gerektirir, opsiyonel

Hata olursa **debug-specialist**'e ver. **contract-engineer** veya **evm-client-engineer**'a delegate edilebilir.

Başarılıysa rapor:
- Tip TX hash + Snowtrace link
- Escrow + settlement TX hashes + Snowtrace link
- Cancel + claimRefund TX hashes
- RPC failover doğrulandı (yes/no)
- Toplam AVAX harcaması (gas)

Bu raporu `.claude/docs/fuji-test-results.md` altına kaydet, demo öncesi son referans.
