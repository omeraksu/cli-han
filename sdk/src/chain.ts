import { avalanche, avalancheFuji } from 'viem/chains';
import type { Chain } from 'viem';

export type HanNetwork = 'fuji' | 'mainnet' | 'localhost';

export const FUJI_CHAIN_ID = 43113;
export const AVAX_MAINNET_CHAIN_ID = 43114;

export const FUJI_PUBLIC_RPC_URLS = [
  'https://api.avax-test.network/ext/bc/C/rpc',
  'https://avalanche-fuji-c-chain-rpc.publicnode.com',
  'https://avalanche-fuji.drpc.org',
];

export const AVAX_MAINNET_PUBLIC_RPC_URLS = [
  'https://api.avax.network/ext/bc/C/rpc',
  'https://avalanche-c-chain-rpc.publicnode.com',
];

export function chainFor(network: HanNetwork): Chain {
  switch (network) {
    case 'fuji':
      return avalancheFuji;
    case 'mainnet':
      return avalanche;
    case 'localhost':
      return { ...avalancheFuji, id: 31337, name: 'Localhost' } as Chain;
  }
}

export function rpcUrlsFor(network: HanNetwork): string[] {
  switch (network) {
    case 'fuji':
      return FUJI_PUBLIC_RPC_URLS;
    case 'mainnet':
      return AVAX_MAINNET_PUBLIC_RPC_URLS;
    case 'localhost':
      return ['http://127.0.0.1:8545'];
  }
}
