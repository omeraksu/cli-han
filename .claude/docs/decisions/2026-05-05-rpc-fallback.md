# 2026-05-05, RPC Endpoint Fallback Strategy

## Status

Accepted, 2026-05-05. Revised 2026-05-18 for Avalanche C-Chain port.

## Context

Han'ın hem hub backend'i hem runtime client'ı Avalanche RPC ile konuşur. Tipik akışlar: TX gönderme, balance okuma, contract read, receipt fetch.

V1 mimaride sadece tek RPC tanımlı: `https://api.avax-test.network/ext/bc/C/rpc`. Bu Avalanche Foundation'un public Fuji endpoint'i, ücretsiz ama:

- Rate limit (saniyede ~10-20 request)
- Sıkışıklık zamanlarında throttle
- Demo gününde çok kullanıcı bu endpoint'i çekerse patlama riski

## Decision

**Multi-RPC fallback stratejisi V1'e girer. viem `fallback` transport kullanılır.**

Provider listesi (öncelik sırası):
1. `https://api.avax-test.network/ext/bc/C/rpc` (official Avalanche Foundation)
2. `https://avalanche-fuji-c-chain-rpc.publicnode.com` (PublicNode)
3. `https://avalanche-fuji.drpc.org` (dRPC)
4. **Opsiyonel ücretli**: Ankr / QuickNode key (`AVAX_RPC_FALLBACK_URLS` env)

Strateji **active-passive**, load balancing değil. Birincil her zaman ilk denenir, başarısız olursa ikinciye düşer (viem `fallback` `rank: false`).

## Implementation

SDK helper `sdk/src/rpc-client.ts`:

```typescript
import { fallback, http, type Transport } from 'viem';
import { chainFor, rpcUrlsFor, type HanNetwork } from './chain.js';

export function createHanTransport(opts: {
  network: HanNetwork;
  extraUrls?: string[];
  retryCount?: number;
  rank?: boolean;
}): Transport {
  const urls = [...rpcUrlsFor(opts.network), ...(opts.extraUrls ?? [])];
  return fallback(
    urls.map((u) => http(u, { retryCount: opts.retryCount ?? 2 })),
    { rank: opts.rank ?? false },
  );
}
```

Hub ve runtime aynı helper'ı kullanır. Custom `FailoverConnection` class'ı yok — viem built-in.

## Hangi hatalar retryable

viem default retry HTTP 5xx, network error, timeout. 429 (rate limit) viem 2.21+ otomatik retry yapar. 4xx auth hataları throw.

## Write işlemleri için dikkat

`fallback` transport'u **write client**'ta direkt kullanmak nonce çakışmasına yol açabilir: ilk RPC TX'i kabul eder, ikinci RPC `nonce too low` döndürür ve fallback patlar.

**Çözüm**: write client'ta pin'lenmiş tek transport, read client'ta fallback:

```typescript
const readTransport = createHanTransport({ network: 'fuji' });
const writeTransport = http(process.env['AVAX_RPC_URL']!);

const publicClient = createPublicClient({ chain, transport: readTransport });
const walletClient = createWalletClient({ account, chain, transport: writeTransport });
```

V2: Smart RPC routing (nonce-aware fallback).

## Test stratejisi

`/avax-flow-test` adım 3:
- Birincil endpoint'e basit `getBlockNumber` call
- Geçici olarak birincili bozuk URL ile değiştir, request ikincisine düşmeli
- Failover transparent olmalı

## Maliyet

Public endpoint'ler ücretsiz. Ankr/QuickNode aylık $50-100. V1'de gerek yok, V1.5'te beta tester sayısı arttıkça eklenir.
