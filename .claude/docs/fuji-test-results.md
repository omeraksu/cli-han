# Fuji Test Sonuçları

İlk uçtan uca contract seviyesi doğrulama. Tarih: 2026-05-19. Chain: Avalanche Fuji (43113).

## Deploy

| Kontrat | Adres | Snowtrace |
|---|---|---|
| Han | `0xa92571e8D0415D041468798767298872a60a3503` | [link](https://testnet.snowtrace.io/address/0xa92571e8D0415D041468798767298872a60a3503) |
| HanTipRouter | `0x29290d67012c3495bC5F3b9333FAA332155Ddb58` | [link](https://testnet.snowtrace.io/address/0x29290d67012c3495bC5F3b9333FAA332155Ddb58) |

Konfig: `feeBps = 300` (%3), `feeReceiver = HUB_AUTHORITY = deployer` (V1 demo).

Deploy gaz tahmini: 2,340,905 gas, 0.000000003 gwei → ~0.000000000007 AVAX.

`--verify` atlandı (SNOWTRACE_API_KEY yok). Kontratlar canlı, kaynak sonradan elle verify edilebilir.

## Aktörler

| Rol | Adres | Not |
|---|---|---|
| Deployer / fee receiver / hub authority / player | `0xcA0b47469C7C8848423E7FAd2D4aa062f6507700` | Fuji-only test wallet, faucet'tan 1 AVAX |
| Streamer (tip alıcısı) | `0x6DDd4c3492Df663B52aa3887EC76c2d06DcC1D71` | Sadece alıcı, anahtarı saklanmadı |
| Host (game) | `0xDD75fEB906cf6dfCDe52331ee941cD4f6B5D6737` | Geçici test wallet, deployer'dan 0.005 AVAX fundlandı |

## Tip flow

Amaç: `HanTipRouter.tip()` tek imzayla %3 fee + %97 streamer split atomik.

| Aşama | TX | Detay |
|---|---|---|
| tip 0.001 AVAX | [`0xa4cb5517`](https://testnet.snowtrace.io/tx/0xa4cb5517c94c1274c69e59ab85ce5d391b7435412ba34fa3c83d361c836cfe6f) | block 55540564, gas 70927, status ok |

Balance doğrulama:
- Streamer = `0.000970000000000000 AVAX` → tam **970000000000000 wei** (%97) ✓
- Fee receiver (deployer): `+0.00003 AVAX` (%3) ✓
- Han contract balance after: `0` (router atomic) ✓

## Game escrow flow

Amaç: createGameRoom → joinGame → settleGame, pot dağıtımı + fee.

| Aşama | TX | Detay |
|---|---|---|
| createGameRoom (host, room=epochMs, entry=0.001, max=2) | [`0x703dc873`](https://testnet.snowtrace.io/tx/0x703dc873f66c2bb5bc077c0a61b57c11510a1ec2c434730a31f98d46a2354c51) | host stake locked |
| joinGame (player) | [`0x3f949a17`](https://testnet.snowtrace.io/tx/0x3f949a1710b532d7df4e4ac75a59255cc0b63972f27059e3c29d6e7e81658711) | player stake locked, room full |
| settleGame (authority → host wins) | [`0xe5101707`](https://testnet.snowtrace.io/tx/0xe5101707619d2b19752f5303e62fb48bde2a6183c113dc4ba58c67ee21a1eeda) | block 55540601, gas 82570 |

Balance doğrulama (settle sonrası):
- Han contract: `0 AVAX` → pot tamamen dağıtıldı ✓
- Host (winner): `0.00594 AVAX` ≈ 0.005 funding - 0.001 stake + 0.00194 winnings - gas ✓
- Deployer: `0.99309 AVAX` ≈ önceki - 0.005 funding - 0.001 player stake + 0.00006 fee - 3× gas ✓

Pot matematiği: `2 × 0.001 = 0.002 AVAX`, fee = `0.002 × 300 bps = 0.00006`, winner payout = `0.00194`. Kontrat side'da bu split doğrulandı.

## RPC failover

Bu sprint'te aktif edilmedi. `.env`'de `AVAX_RPC_FALLBACK_URLS` setli (drpc + publicnode), viem `fallback` transport ile SDK çağrılarında kullanılır. Network kesintisi simülasyonu V1.5'e ertelendi.

## Lokal test

forge test: **32/32 pass** (`Han.t.sol` 22, `HanTipRouter.t.sol` 8, `HanFuzz.t.sol` 2). Fuzz testleri 256 run/case.

## Bilinen küçük borçlar

1. `.env` Node `--env-file` parse sorunu: append edilen `HAN_CONTRACT_ADDRESS` / `HAN_TIP_ROUTER_ADDRESS` satırları sessizce yüklenmiyor, shell export ile bypass edildi. Format problemi; .env tekrar yazılırsa düzelir.
2. Solana baseline env'leri (`SOLANA_*`, `HELIUS_*`, `HAN_PROGRAM_ID`, `SAS_*`, `HUB_AUTHORITY_KEYPAIR`) hâlâ `.env`'de duruyor, AVAX port'una taşımaz.
3. Snowtrace kaynak verify yapılmadı. Sonra `forge verify-contract` ile elle.

## Sonraki adımlar

- Hub backend + runtime CLI'yi canlı dene (Sprint 1 birincil hedef)
- RPC failover'u testlerle simüle et (debug-specialist)
- `cancelGame` + `claimRefund` + `timeoutRefund` flow'larını Fuji'de smoke test'le (forge'da pass, mainnet'ten önce gerçek block context'inde de gör)
