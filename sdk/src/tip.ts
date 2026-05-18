import {
  parseEther,
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient,
} from 'viem';

import { TipError } from './errors.js';
import { hanTipRouterAbi } from './abi.js';

/**
 * Han tip commission, expressed in basis points (300 = 3%).
 *
 * Mirrored from the HanTipRouter contract `feeBps` immutable. The contract
 * is the source of truth at runtime; this constant exists so callers can
 * preview fee/streamer splits before sending.
 *
 * @see ADR 2026-05-13-tip-fee-architecture
 */
export const TIP_FEE_BPS = 300n;
const BPS_DENOMINATOR = 10_000n;

export interface SendTipWithFeeParams {
  publicClient: PublicClient;
  walletClient: WalletClient;
  router: Address;
  streamer: Address;
  amountAvax: string;
}

export interface SendTipWithFeeResult {
  hash: Hex;
  amountWei: bigint;
  feeWei: bigint;
  streamerWei: bigint;
}

/**
 * Sends a tip with a 3% Han commission via the HanTipRouter contract.
 *
 * The router splits `msg.value` atomically: feeBps to feeReceiver, remainder
 * to streamer. One transaction, one signature.
 *
 * @example
 *   const result = await sendTipWithFee({
 *     publicClient, walletClient,
 *     router: '0x...', streamer: '0x...', amountAvax: '0.05',
 *   });
 */
export async function sendTipWithFee(
  params: SendTipWithFeeParams,
): Promise<SendTipWithFeeResult> {
  const { publicClient, walletClient, router, streamer, amountAvax } = params;
  const account = walletClient.account;
  if (!account) throw new TipError('walletClient is missing an account');

  let amountWei: bigint;
  try {
    amountWei = parseEther(amountAvax);
  } catch (err) {
    throw new TipError(`Invalid AVAX amount: ${amountAvax}`, err);
  }
  if (amountWei <= 0n) throw new TipError(`Tip amount must be positive (got ${amountAvax})`);

  const feeWei = (amountWei * TIP_FEE_BPS) / BPS_DENOMINATOR;
  const streamerWei = amountWei - feeWei;
  if (streamerWei <= 0n) throw new TipError(`Tip too small after fee (${amountWei} wei)`);

  const balance = await publicClient.getBalance({ address: account.address });
  if (balance < amountWei) {
    throw new TipError(
      `Insufficient balance: have ${balance} wei, need at least ${amountWei}`,
    );
  }

  try {
    const hash = await walletClient.writeContract({
      address: router,
      abi: hanTipRouterAbi,
      functionName: 'tip',
      args: [streamer],
      value: amountWei,
      account,
      chain: walletClient.chain,
    });
    await publicClient.waitForTransactionReceipt({ hash });
    return { hash, amountWei, feeWei, streamerWei };
  } catch (err) {
    throw new TipError('sendTipWithFee transaction failed', err);
  }
}
