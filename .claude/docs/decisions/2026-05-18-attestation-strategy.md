# 2026-05-18, Attestation Strategy (Avalanche)

## Status

Accepted, 2026-05-18. Supersedes Solana ADR `2026-05-05-sas-vs-custom-pda` (artık geçersiz).

## Context

Solana versiyonunda game leaderboard'ları için SAS (Solana Attestation Service) entegrasyonu planlanmıştı. Hub authority off-chain imzalar, SAS PDA'ya yazardı.

Avalanche C-Chain'de SAS yok. Karşılığı **EAS (Ethereum Attestation Service)** — Avalanche için bir fork mevcut. Ancak EAS schema deployment + indexing maliyet+iş yaratır.

## Decision

**V1: Attestation yok. `GameSettled` event log yeterli.**

`Han.sol` her `settleGame()` çağrısında:

```solidity
emit GameSettled(uint256 indexed roomId, address indexed winner, uint256 payout);
```

Snowtrace'te event filter:
```
https://testnet.snowtrace.io/address/<han-contract>?tab=events
```

Hub off-chain `parseEventLogs` ile aynı event'i okur, Postgres `game_results` tablosuna yazar. Frontend bu tablodan leaderboard çeker.

**V2: EAS Avalanche fork**, eğer aşağıdaki üçü gerçekleşirse:
1. Üçüncü taraflar (başka uygulamalar) Han game result'larını cross-app olarak doğrulamak isterse
2. Beta tester sayısı 100+ olur, leaderboard manipülasyonu somut risk olur
3. Mainnet'e geçiş kararı verilir

## Gerekçe

V1'de attestation hub authority signed olacaktı. Yani SAS PDA'sını hub yazıyor, hub okuyor — extra trust hop yok. Aynı garantiyi event log + indexed Postgres tablosu sağlıyor, fazladan kontrat yok, deploy/audit zaman yok.

Event log Snowtrace'te public — herkes doğrulayabilir. `roomId indexed` ile filter cheap.

V2'de cross-app verification gerekirse EAS gerçek değer katar (third party'ler attestation'ı kendi UX'lerinde verify edebilir).

## Implementation

Hub backend `apps/hub/src/contracts/event-indexer.ts` (V1.5'te yazılır):

```typescript
import { watchContractEvent } from 'viem';
import { hanAbi } from '@han/sdk';

publicClient.watchContractEvent({
  address: HAN_CONTRACT_ADDRESS,
  abi: hanAbi,
  eventName: 'GameSettled',
  onLogs: async (logs) => {
    for (const log of logs) {
      const { roomId, winner, payout } = log.args;
      await db.gameResult.create({ data: { /* ... */ } });
    }
  },
});
```

`fromBlock` Hub başlangıç state'te son indeksli block + 1.

## Sonuç

V1 ship: attestation kavramı kaldırıldı, event log + DB cache yeterli. V2 EAS değerlendirmesi sonradan.
