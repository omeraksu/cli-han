import { Connection } from '@solana/web3.js';
import { RpcError } from './errors.js';

export interface RpcEndpoint {
  url: string;
  name: string;
  priority: number;
}

export class FailoverConnection {
  private endpoints: RpcEndpoint[];
  private current = 0;
  private failureCount: Map<string, number> = new Map();

  constructor(endpoints: RpcEndpoint[]) {
    this.endpoints = [...endpoints].sort((a, b) => a.priority - b.priority);
  }

  async call<T>(operation: (conn: Connection) => Promise<T>): Promise<T> {
    const errors: unknown[] = [];

    for (let i = 0; i < this.endpoints.length; i++) {
      const endpoint = this.endpoints[i];
      const conn = new Connection(endpoint.url, 'confirmed');
      try {
        const result = await operation(conn);
        // success — reset failure count for this endpoint
        this.failureCount.set(endpoint.url, 0);
        this.current = i;
        return result;
      } catch (err) {
        if (!this.isRetryable(err)) {
          // non-retryable (4xx auth, invalid request, etc.) — throw immediately
          throw err;
        }
        const prev = this.failureCount.get(endpoint.url) ?? 0;
        this.failureCount.set(endpoint.url, prev + 1);
        errors.push(err);
        // continue to next endpoint
      }
    }

    throw new RpcError(
      `All RPC endpoints failed (${this.endpoints.map((e) => e.name).join(', ')})`,
      errors,
    );
  }

  getConnection(): Connection {
    return new Connection(this.endpoints[this.current].url, 'confirmed');
  }

  private isRetryable(err: unknown): boolean {
    const msg = String(err instanceof Error ? err.message : err).toLowerCase();
    return (
      msg.includes('429') ||
      msg.includes('rate limit') ||
      msg.includes('503') ||
      msg.includes('502') ||
      msg.includes('timeout') ||
      msg.includes('econnreset')
    );
  }
}

export function createDevnetConnection(heliusRpcUrl?: string): FailoverConnection {
  const endpoints: RpcEndpoint[] = [
    { url: 'https://api.devnet.solana.com', name: 'devnet-official', priority: 1 },
  ];
  if (heliusRpcUrl) {
    endpoints.push({ url: heliusRpcUrl, name: 'helius', priority: 2 });
  }
  return new FailoverConnection(endpoints);
}
