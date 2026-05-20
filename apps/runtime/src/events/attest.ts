import {
  createPublicClient,
  createWalletClient,
  http,
  keccak256,
  toBytes,
  getAddress,
  type Address,
  type Hex,
} from 'viem';
import { avalancheFuji } from 'viem/chains';
import {
  loadLocalAccount,
  defaultWalletPath,
  anchorAttestation,
  EVENT_ROLE,
  type EventRole,
} from '@han/sdk/dist/index.js';

import { loadAuth } from '../auth/token-store.js';

interface RunArgs {
  hubUrl: string;
  walletPath?: string;
  eventSlug: string;
  role: EventRole;
}

interface AnchorConfig {
  address: string | null;
  network: string;
  chainId: number;
}

export async function runAttest(args: RunArgs): Promise<void> {
  const auth = loadAuth();
  if (!auth) {
    console.error('[attest] login gerek — `han login` calistir');
    process.exit(1);
  }

  // Validate event exists + caller is a member with that role (best-effort
  // off-chain check; on-chain is opt-in regardless).
  const evRes = await fetch(`${args.hubUrl}/events/${args.eventSlug}`, {
    headers: { Authorization: `Bearer ${auth.token}` },
  });
  if (!evRes.ok) {
    console.error(`[attest] event bulunamadi: ${args.eventSlug}`);
    process.exit(1);
  }
  const ev = (await evRes.json()) as {
    slug: string;
    title: string;
    members: Array<{ wallet: string; role: string }>;
  };

  const myMembership = ev.members.find(
    (m) => m.wallet.toLowerCase() === auth.wallet.toLowerCase(),
  );
  if (!myMembership) {
    console.error(`[attest] sen ${args.eventSlug} eventinin uyesi degilsin`);
    process.exit(1);
  }
  if (myMembership.role !== args.role) {
    console.error(
      `[attest] off-chain rolun "${myMembership.role}", --role ${args.role} ile uyusmuyor`,
    );
    process.exit(1);
  }

  // Pull anchor address from hub. If hub isn't configured, abort with a
  // useful message instead of a silent revert.
  const cfgRes = await fetch(`${args.hubUrl}/anchor/config`);
  if (!cfgRes.ok) {
    console.error('[attest] hub /anchor/config erisilemiyor');
    process.exit(1);
  }
  const cfg = (await cfgRes.json()) as AnchorConfig;
  if (!cfg.address) {
    console.error('[attest] hub anchor adresi konfigure degil (Sprint 6 deploy gerekli)');
    process.exit(1);
  }

  const account = loadLocalAccount(args.walletPath ?? defaultWalletPath());
  const transport = http(); // viem avalancheFuji default RPC
  const publicClient = createPublicClient({ chain: avalancheFuji, transport });
  const walletClient = createWalletClient({ account, chain: avalancheFuji, transport });

  const dataPayload = JSON.stringify({
    slug: ev.slug,
    title: ev.title,
    role: args.role,
    builder: account.address,
    ts: new Date().toISOString(),
  });
  const dataHash: Hex = keccak256(toBytes(dataPayload));

  console.log(`[attest] event=${ev.slug} role=${args.role}`);
  console.log(`[attest] builder=${account.address}`);
  console.log(`[attest] anchor=${cfg.address}`);

  const result = await anchorAttestation({
    publicClient,
    walletClient,
    anchor: getAddress(cfg.address) as Address,
    eventSlug: ev.slug,
    role: EVENT_ROLE[args.role],
    dataHash,
  });

  console.log(`[attest] tx=${result.hash}`);
  console.log(`[attest] eventKey=${result.eventKey}`);
  console.log(`[attest] snowtrace https://testnet.snowtrace.io/tx/${result.hash}`);
}
