---
name: han-avax-economy
description: Han'ın Avalanche C-Chain ekonomisi. Solidity storage, escrow logic, tip flow, hub authority. contract-engineer ve evm-client-engineer için ana referans.
---

# Han AVAX Economy

## Felsefe

Han'da Avalanche minimal ama her yerde. Tip, oyun escrow, gelecekte attestation. ERC-20 token yok (V1'de native AVAX).

İki kontrat var. `Han.sol` game escrow. `HanTipRouter.sol` atomic tip splitter. Hepsi bu kadar — minimal saldırı yüzeyi, basit audit.

## V1 scope

| Akış | Mekanik | Kontrat gerekli mi |
|---|---|---|
| Tip yayıncıya (+ fee) | `HanTipRouter.tip()` payable, atomic split | Evet (atomicity için) |
| Oyun entry fee deposit | `Han.createGameRoom` / `joinGame` payable | Evet |
| Oyun winner payout | `Han.settleGame` (authority signed) | Evet |
| Oyun iptal refund | `cancelGame` + `claimRefund` | Evet |
| 24h trustless refund | `timeoutRefund` | Evet |
| Game result attestation | `GameSettled` event Snowtrace'te | Hayır (event log yeterli V1, V2'de EAS) |

## Tip flow

EVM tek `to` constraint'i nedeniyle Solana'daki "iki SystemProgram::transfer tek TX" pattern'i tek-call'da uygulanamaz. `HanTipRouter` minimum kontratı atomikliği garanti eder.

Frontend:

```typescript
import { createPublicClient, createWalletClient, http, getAddress, parseEther } from 'viem';
import { avalancheFuji } from 'viem/chains';
import { loadLocalAccount, sendTipWithFee } from '@han/sdk';

const account = loadLocalAccount();
const publicClient = createPublicClient({
  chain: avalancheFuji,
  transport: http('https://api.avax-test.network/ext/bc/C/rpc'),
});
const walletClient = createWalletClient({
  account,
  chain: avalancheFuji,
  transport: http('https://api.avax-test.network/ext/bc/C/rpc'),
});

const { hash, amountWei, feeWei, streamerWei } = await sendTipWithFee({
  publicClient,
  walletClient,
  router: getAddress('0x...'),       // HanTipRouter address
  streamer: getAddress('0x...'),     // recipient
  amountAvax: '0.05',                // viem parseEther formatı
});
```

Kontratta:

```solidity
function tip(address streamer) external payable {
    uint256 fee = (msg.value * feeBps) / 10_000;
    uint256 toStreamer = msg.value - fee;
    (bool a,) = payable(feeReceiver).call{value: fee}("");
    (bool b,) = payable(streamer).call{value: toStreamer}("");
    require(a && b, "transfer failed");
    emit Tipped(msg.sender, streamer, msg.value, fee, toStreamer);
}
```

`feeBps` ve `feeReceiver` deploy sonrası **immutable** — Han ekonomisinin sözleşmesi sabit.

## Game escrow

`contracts/src/Han.sol` 8 fonksiyon (Anchor instruction'larıyla 1:1):

| Fonksiyon | Yetki | Açıklama |
|---|---|---|
| `initialize` | constructor | feeBps + feeReceiver + authority |
| `updateConfig` | onlyOwner | yeni feeBps/receiver/authority |
| `createGameRoom` | herkes | host ilk stake, room oluşur |
| `joinGame` | herkes | maxPlayers'a kadar |
| `settleGame` | onlyAuthority | hub admin imzalar, pot kazanan'a |
| `cancelGame` | onlyHost | filling status'te iken |
| `claimRefund` | herkes (player) | cancelled room'dan |
| `timeoutRefund` | herkes (player) | 24h sonra trustless |

### Storage layout

Solana PDA'larının EVM karşılığı:

```solidity
// Anchor: seeds = [b"room", room_id] + seeds = [b"vault", room_id]
// EVM: tek mapping, vault = kontrat balance per room (tracking storage'da)
mapping(uint256 => GameRoom) private _rooms;
mapping(uint256 => bool) public roomExists;

struct GameRoom {
    address host;
    bytes32 gameType;
    uint128 entryFee;            // wei
    uint8   maxPlayers;
    uint8   playerCount;
    uint8   status;              // 1 filling, 2 ready, 4 finished, 5 settled, 6 cancelled, 7 timedOut
    uint8   refundClaimedBitmap; // 8-player bitmap, aynen Anchor
    uint64  createdAt;
    address winner;
    address[8] players;          // sabit boyut, gas-friendly
}
```

Player bitmap aynen Anchor:

```solidity
uint8 bit = uint8(1 << playerIndex);
if (room.refundClaimedBitmap & bit != 0) revert AlreadyRefunded();
room.refundClaimedBitmap |= bit;
```

### Sabitler

```solidity
uint8   public constant MAX_PLAYERS = 8;
uint128 public constant MIN_ENTRY_FEE = 1e15;       // 0.001 AVAX
uint128 public constant MAX_ENTRY_FEE = 10 ether;
uint64  public constant ROOM_TIMEOUT = 24 hours;
uint16  public constant MAX_FEE_BPS = 1000;         // %10 tavan
```

### Events

```solidity
event GameRoomCreated(uint256 indexed roomId, address indexed host, bytes32 gameType, uint128 entryFee, uint8 maxPlayers);
event PlayerJoined(uint256 indexed roomId, address indexed player, uint8 playerIndex);
event GameSettled(uint256 indexed roomId, address indexed winner, uint256 payout);
event GameCancelled(uint256 indexed roomId);
event RefundClaimed(uint256 indexed roomId, address indexed player, uint256 amount);
event TimeoutRefundClaimed(uint256 indexed roomId, address indexed player, uint256 amount);
event ConfigUpdated(uint16 feeBps, address feeReceiver, address authority);
```

Hub off-chain bu event'leri `parseEventLogs({ abi: hanAbi, logs })` ile dinler. Game settlement sonrası `tips` ve `game_results` tabloları güncellenir.

## Wallet'lar üç ayrı kişi

V1'de tek-cüzdan tehlikeli. Üç ayrı `address`:

1. **Deployer** — `forge script DeployFuji` çalıştıran. Han.sol owner'ı. Faucet'tan AVAX alır.
2. **Hub authority** — `settleGame()` çağırma yetkisi. Hub backend `.env` `HUB_AUTHORITY_PRIVATE_KEY` üstünden saklar.
3. **Fee receiver** — `HanTipRouter` ve `Han.feeReceiver` immutable adresi. Hub admin'in *ayrı* personal wallet'ı. Komisyon buraya birikir.

Üçü ayrı olmazsa: bir wallet compromise edildiğinde hem deploy authority hem fee accrual hem settle yetkisi gider.

## Fee semantics

`TIP_FEE_BPS = 300` → 300/10000 = %3. Yayıncıya tip atan 1 AVAX gönderirse:
- `0.03 AVAX` → feeReceiver
- `0.97 AVAX` → streamer
- 1 transaction, 1 imza, atomik

Game escrow'da `settleGame` aynı feeBps ile pot'u böler:
- 8 player × 0.1 AVAX = 0.8 AVAX pot
- `0.024 AVAX` → feeReceiver
- `0.776 AVAX` → winner

## RPC failover

viem'in built-in `fallback` transport'u kullanılır. Custom `FailoverConnection` yok.

```typescript
import { createHanTransport } from '@han/sdk';

const transport = createHanTransport({
  network: 'fuji',
  extraUrls: process.env['AVAX_RPC_FALLBACK_URLS']?.split(',') ?? [],
});
```

Endpoint öncelik sırası:
1. `https://api.avax-test.network/ext/bc/C/rpc` (official)
2. `https://avalanche-fuji-c-chain-rpc.publicnode.com`
3. `https://avalanche-fuji.drpc.org`

Write işlemleri için tek RPC pin'lemek nonce yönetimi için güvenli (ADR `2026-05-05-rpc-fallback`).
