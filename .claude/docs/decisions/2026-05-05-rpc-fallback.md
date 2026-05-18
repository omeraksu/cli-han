# 2026-05-05, RPC Endpoint Fallback Strategy

## Context

Han'ın hem hub backend'i hem runtime client'ı Solana RPC ile konuşur. Tipik akışlar: TX gönderme, balance okuma, account fetch, signature confirmation.

V1 mimaride sadece tek RPC tanımlı: `https://api.devnet.solana.com`. Bu Solana'nın public devnet endpoint'i, ücretsiz ama:

- Rate limit (saniyede 10 request gibi)
- Sıkışıklık zamanlarında throttle
- Hackathon demo gününde **çok kullanıcı bu endpoint'i çekecek**, jüri demosu sırasında patlama riski yüksek

Validation raporu (2026-05-05) demo gününde RPC rate limit sorununu somut bir risk olarak işaret etti.

## Decision

**Multi-RPC fallback stratejisi V1'e girer.**

Provider listesi:
1. **Birincil**: `https://api.devnet.solana.com` (Solana Foundation)
2. **İkincil (fallback)**: Helius devnet endpoint (`HELIUS_RPC_URL` env var, key gerekir)
3. **Üçüncül (acil)**: QuickNode veya Alchemy (V1.5'te eklenebilir)

Strateji **active-passive**, load balancing değil. Birincil her zaman ilk denenir, başarısız olursa ikinciye düşer. Round-robin veya weighted yok (basit tutuyoruz).

## Implementation

`apps/hub/src/solana/rpc-client.ts` ve `apps/runtime/src/wallet/rpc-client.ts` paylaşılabilir bir helper:

```typescript
import { Connection, ConnectionConfig } from '@solana/web3.js';

interface RpcEndpoint {
  url: string;
  name: string;
  priority: number;
}

class FailoverConnection {
  private endpoints: RpcEndpoint[];
  private current: number = 0;
  private failureCount: Map<string, number> = new Map();
  
  constructor(endpoints: RpcEndpoint[]) {
    this.endpoints = endpoints.sort((a, b) => a.priority - b.priority);
  }
  
  async call<T>(operation: (conn: Connection) => Promise<T>): Promise<T> {
    const maxAttempts = this.endpoints.length;
    let lastError: Error | null = null;
    
    for (let i = 0; i < maxAttempts; i++) {
      const endpoint = this.endpoints[this.current];
      const conn = new Connection(endpoint.url, 'confirmed');
      
      try {
        const result = await operation(conn);
        // Başarılıysa failure count sıfırla
        this.failureCount.set(endpoint.name, 0);
        return result;
      } catch (err) {
        lastError = err as Error;
        const fc = (this.failureCount.get(endpoint.name) ?? 0) + 1;
        this.failureCount.set(endpoint.name, fc);
        
        // Rate limit veya 5xx ise hemen geç
        if (this.isRetryable(err)) {
          this.current = (this.current + 1) % this.endpoints.length;
          continue;
        }
        
        throw err; // 4xx (auth, invalid request) ise fallback yapma
      }
    }
    
    throw new RpcError(`All RPC endpoints failed`, lastError);
  }
  
  private isRetryable(err: unknown): boolean {
    const msg = (err as Error).message.toLowerCase();
    return msg.includes('429') || msg.includes('rate limit') || 
           msg.includes('503') || msg.includes('502') || 
           msg.includes('timeout') || msg.includes('econnreset');
  }
}
```

Kullanım:
```typescript
const rpc = new FailoverConnection([
  { url: process.env.SOLANA_RPC_URL!, name: 'devnet-official', priority: 1 },
  { url: process.env.HELIUS_RPC_URL!, name: 'helius', priority: 2 },
]);

const sig = await rpc.call(conn => sendAndConfirm(conn, tx, [signer]));
```

## Environment

`.env.example` güncelleniyor:

```
# Birincil
SOLANA_RPC_URL=https://api.devnet.solana.com

# İkincil (Helius, demo öncesi key al)
HELIUS_API_KEY=
HELIUS_RPC_URL=https://devnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}

# Cluster
SOLANA_CLUSTER=devnet
```

## Consequences

**Kazandıkları:**
- Demo günü resilient
- Tek bir endpoint patlarsa kullanıcı fark etmez
- Hub backend de aynı stratejiyi kullanır, server-side reliability artar

**Kaybettikleri:**
- Helius API key alınmalı (ücretsiz tier var, hackathon için yeterli)
- Test'te de iki endpoint mock'lanmalı
- Code complexity biraz artar (~100 satır helper)

**Demo öncesi:**
1. Helius hesabı aç, devnet API key al
2. `.env` dosyasına ekle, `.env.example` güncelle
3. `solana-flow-test` komutuyla failover'ı doğrula (birincil endpoint'i kasten patlat)

## Status

Accepted, 2026-05-05. Implementation owner: solana-client-engineer (helper yazımı), hub-engineer (entegrasyon).

## References

- solana.new validate-idea raporu (2026-05-05)
- Helius docs: https://docs.helius.dev/
