import {
  createWalletClient,
  getContract,
  type Address,
  type Hex,
  type GetContractReturnType,
  type PublicClient,
  type WalletClient,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

import { chainFor, type HanNetwork } from './chain.js';
import { createHanTransport, createPublicHanClient } from './rpc-client.js';
import { hanAbi, hanTipRouterAbi } from './abi.js';

export interface HanClientOptions {
  network: HanNetwork;
  hanContract: Address;
  tipRouterContract: Address;
  privateKey?: Hex;
  publicClient?: PublicClient;
  walletClient?: WalletClient;
  extraRpcUrls?: string[];
}

export class HanClient {
  readonly network: HanNetwork;
  readonly publicClient: PublicClient;
  readonly walletClient: WalletClient | null;
  readonly han: GetContractReturnType<typeof hanAbi, PublicClient | WalletClient, Address>;
  readonly tipRouter: GetContractReturnType<
    typeof hanTipRouterAbi,
    PublicClient | WalletClient,
    Address
  >;

  constructor(opts: HanClientOptions) {
    this.network = opts.network;
    this.publicClient =
      opts.publicClient ??
      createPublicHanClient({ network: opts.network, extraUrls: opts.extraRpcUrls });

    if (opts.walletClient) {
      this.walletClient = opts.walletClient;
    } else if (opts.privateKey) {
      const account = privateKeyToAccount(opts.privateKey);
      this.walletClient = createWalletClient({
        account,
        chain: chainFor(opts.network),
        transport: createHanTransport({ network: opts.network, extraUrls: opts.extraRpcUrls }),
      });
    } else {
      this.walletClient = null;
    }

    const clientForContract = this.walletClient ?? this.publicClient;
    this.han = getContract({
      abi: hanAbi,
      address: opts.hanContract,
      client: clientForContract as PublicClient | WalletClient,
    });
    this.tipRouter = getContract({
      abi: hanTipRouterAbi,
      address: opts.tipRouterContract,
      client: clientForContract as PublicClient | WalletClient,
    });
  }

  get accountAddress(): Address | null {
    return this.walletClient?.account?.address ?? null;
  }
}
