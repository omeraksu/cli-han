import {
  keccak256,
  toBytes,
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient,
} from 'viem';

import { hanEventAnchorAbi } from './abi.js';

/**
 * Computes the on-chain eventKey for a given event slug. Mirrors the
 * `keccak256("han.event:" || event.slug)` rule used by the Solidity layer
 * (see HanEventAnchor.sol).
 */
export function eventKeyFromSlug(slug: string): Hex {
  return keccak256(toBytes(`han.event:${slug}`));
}

export interface AnchorSubmissionParams {
  publicClient: PublicClient;
  walletClient: WalletClient;
  anchor: Address;
  eventSlug: string;
  team: Address;
  dataHash: Hex;
}

export interface AnchorSubmissionResult {
  hash: Hex;
  eventKey: Hex;
}

/**
 * Anchors a submission. Must be called by the hub authority wallet — the
 * contract reverts otherwise. The off-chain layer is expected to hash the
 * submission JSON (`title`, `summary`, `repoUrl`, `demoUrl`) into `dataHash`
 * before calling this so the provenance stays meaningful.
 */
export async function anchorSubmission(
  args: AnchorSubmissionParams,
): Promise<AnchorSubmissionResult> {
  const eventKey = eventKeyFromSlug(args.eventSlug);
  const account = args.walletClient.account;
  if (!account) throw new Error('walletClient has no account');

  const hash = await args.walletClient.writeContract({
    address: args.anchor,
    abi: hanEventAnchorAbi,
    functionName: 'anchorSubmission',
    args: [eventKey, args.team, args.dataHash],
    account,
    chain: args.walletClient.chain ?? null,
  });

  await args.publicClient.waitForTransactionReceipt({ hash });
  return { hash, eventKey };
}

export interface AnchorAttestationParams {
  publicClient: PublicClient;
  walletClient: WalletClient;
  anchor: Address;
  eventSlug: string;
  role: number;
  dataHash: Hex;
}

export interface AnchorAttestationResult {
  hash: Hex;
  eventKey: Hex;
  builder: Address;
}

/**
 * Builder self-attestation. msg.sender = the builder's wallet, so the
 * caller's walletClient account is what gets indexed. Off-chain layers
 * decide which attestations to honor (e.g. only those whose role matches
 * the off-chain EventMember row).
 */
export async function anchorAttestation(
  args: AnchorAttestationParams,
): Promise<AnchorAttestationResult> {
  const eventKey = eventKeyFromSlug(args.eventSlug);
  const account = args.walletClient.account;
  if (!account) throw new Error('walletClient has no account');

  const hash = await args.walletClient.writeContract({
    address: args.anchor,
    abi: hanEventAnchorAbi,
    functionName: 'anchorAttestation',
    args: [eventKey, args.role, args.dataHash],
    account,
    chain: args.walletClient.chain ?? null,
  });

  await args.publicClient.waitForTransactionReceipt({ hash });
  return { hash, eventKey, builder: account.address };
}

/** Numeric role enum mirroring the Solidity event field. */
export const EVENT_ROLE = {
  organizer: 0,
  judge: 1,
  mentor: 2,
  instructor: 3,
  builder: 4,
  spectator: 5,
} as const;

export type EventRole = keyof typeof EVENT_ROLE;
