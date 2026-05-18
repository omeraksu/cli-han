import { createPublicClient, fallback, http, type PublicClient, type Transport } from 'viem';
import { chainFor, rpcUrlsFor, type HanNetwork } from './chain.js';

export interface CreateTransportOptions {
  network: HanNetwork;
  extraUrls?: string[];
  retryCount?: number;
  rank?: boolean;
}

export function createHanTransport(opts: CreateTransportOptions): Transport {
  const urls = [...rpcUrlsFor(opts.network), ...(opts.extraUrls ?? [])];
  return fallback(
    urls.map((u) => http(u, { retryCount: opts.retryCount ?? 2 })),
    { rank: opts.rank ?? false },
  );
}

export function createPublicHanClient(opts: CreateTransportOptions): PublicClient {
  return createPublicClient({
    chain: chainFor(opts.network),
    transport: createHanTransport(opts),
  });
}
