---
description: Han kontratlarını Fuji testnet'e deploy et, ABI'leri SDK'ya senkron tut
---

Sırayla:

1. `cd contracts && forge build` çalıştır, çıktıyı kontrol et
2. `cd contracts && forge test -vv` yeşil mi doğrula (32+ test geçmeli)
3. `cast wallet balance <deployer> --rpc-url $AVAX_RPC_URL` ile Fuji wallet'ında AVAX var mı bak (~0.1 AVAX yeterli). Yoksa kullanıcıya https://faucet.avax.network/ adresinden faucet iste
4. `.env`'de zorunlu env'ler set mi: `DEPLOYER_PRIVATE_KEY`, `HAN_FEE_RECEIVER_ADDRESS`, `HUB_AUTHORITY_ADDRESS`, `AVAX_RPC_URL`
5. Deploy çalıştır:
   ```bash
   cd contracts
   forge script script/DeployFuji.s.sol \
     --rpc-url $AVAX_RPC_URL \
     --broadcast \
     --verify \
     --etherscan-api-key $SNOWTRACE_API_KEY
   ```
6. Çıktıdan `HAN_CONTRACT_ADDRESS` ve `HAN_TIP_ROUTER_ADDRESS` adreslerini al
7. `.env`'e iki adresi yaz, `.env.example`'da varsayılan placeholder'ı koru
8. ABI sync:
   ```bash
   cd contracts
   forge inspect Han abi --json > ../sdk/abi/han.json
   forge inspect HanTipRouter abi --json > ../sdk/abi/hanTipRouter.json
   ```
9. **evm-client-engineer**'a sync sonrası tip'leri güncelletir, `pnpm --filter @han/sdk build` yeşil mi doğrula
10. Commit'ler:
    - `chore(sdk): sync abi after fuji deploy <hash short>`
    - `chore(docs): add fuji contract addresses to .env`
11. **RPC fallback kontrolü**: `.env`'de `AVAX_RPC_FALLBACK_URLS` set mi, en az 2 endpoint olmalı
12. `/avax-flow-test` ile bir tip transaction at, başarılıysa onayla

Hata olursa **debug-specialist**'i çağır.

Notlar:
- Forge `--verify` rate limit'e takılabilir (Snowtrace ücretsiz tier). Başarısızlık `--resume` ile telafi edilir.
- Mainnet deploy ayrı komut (`/deploy-mainnet` V2'de), bu sadece Fuji
- Deployer wallet ile fee receiver ve hub authority **ayrı** olmalı — security minimum
