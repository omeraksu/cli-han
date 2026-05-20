import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
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
import { privateKeyToAccount } from 'viem/accounts';

import type { HubContext } from '../ws/context.js';
import { config } from '../config.js';
import { logger } from '../logger.js';
import { anchorSubmission, hanEventAnchorAbi } from '@han/sdk/dist/index.js';

const submissionHashSchema = z.object({
  team: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .optional(),
});

interface SubmissionRow {
  id: string;
  title: string;
  summary: string | null;
  repoUrl: string | null;
  demoUrl: string | null;
  teamLabel: string;
  anchorTxHash: string | null;
  team: { id: string; slug: string; name: string } | null;
}

function hashSubmissionPayload(s: SubmissionRow): Hex {
  // Stable canonical string — the bytes that get hashed into the on-chain
  // dataHash. Off-chain indexers reproduce this to verify a submission.
  const canonical = JSON.stringify({
    id: s.id,
    title: s.title,
    summary: s.summary ?? '',
    repoUrl: s.repoUrl ?? '',
    demoUrl: s.demoUrl ?? '',
    teamLabel: s.teamLabel,
  });
  return keccak256(toBytes(canonical));
}

export async function anchorRoutes(app: FastifyInstance, ctx: HubContext): Promise<void> {
  // POST /events/:slug/submissions/:id/anchor — hub authority signs the
  // submission's dataHash onto HanEventAnchor. Idempotent: if the row already
  // has anchorTxHash, returns it unchanged.
  app.post('/events/:slug/submissions/:id/anchor', async (req, reply) => {
    if (!config.HAN_EVENT_ANCHOR_ADDRESS) {
      return reply.code(503).send({ error: 'HAN_EVENT_ANCHOR_ADDRESS not configured' });
    }
    if (!config.HUB_AUTHORITY_PRIVATE_KEY) {
      return reply.code(503).send({ error: 'HUB_AUTHORITY_PRIVATE_KEY not configured' });
    }

    const { slug, id } = req.params as { slug: string; id: string };
    const submission = (await ctx.db.submission.findUnique({
      where: { id },
      include: {
        event: { select: { id: true, slug: true } },
        team: { select: { id: true, slug: true, name: true } },
      },
    })) as (SubmissionRow & { event: { slug: string } | null }) | null;

    if (!submission || submission.event?.slug !== slug) {
      return reply.code(404).send({ error: 'submission not found' });
    }
    if (submission.anchorTxHash) {
      return reply.send({ alreadyAnchored: true, txHash: submission.anchorTxHash });
    }

    const parsed = submissionHashSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid body', details: parsed.error.flatten() });
    }

    // Team address: caller-provided override, else the team lead from
    // TeamMember(role=lead). Sprint 8 will record this on the Team row so
    // the lookup is one query.
    let team: Address | null = parsed.data.team ? getAddress(parsed.data.team) : null;
    if (!team && submission.team) {
      const lead = await ctx.db.teamMember.findFirst({
        where: { teamId: submission.team.id, role: 'lead' },
        orderBy: { createdAt: 'asc' },
      });
      if (lead) team = getAddress(lead.wallet) as Address;
    }
    if (!team) {
      return reply
        .code(400)
        .send({ error: 'team address required (no lead member on file)' });
    }

    const dataHash = hashSubmissionPayload(submission);
    const account = privateKeyToAccount(config.HUB_AUTHORITY_PRIVATE_KEY as Hex);
    const transport = http(config.AVAX_RPC_URL);
    const publicClient = createPublicClient({ chain: avalancheFuji, transport });
    const walletClient = createWalletClient({ account, chain: avalancheFuji, transport });

    try {
      const { hash, eventKey } = await anchorSubmission({
        publicClient,
        walletClient,
        anchor: getAddress(config.HAN_EVENT_ANCHOR_ADDRESS) as Address,
        eventSlug: slug,
        team,
        dataHash,
      });
      const updated = await ctx.db.submission.update({
        where: { id },
        data: { anchorTxHash: hash },
      });
      logger.info(
        { submissionId: id, slug, hash, eventKey, team, dataHash },
        'submission anchored',
      );
      return reply.send({ txHash: hash, eventKey, dataHash, submission: updated });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error({ err, submissionId: id }, 'submission anchor failed');
      return reply.code(500).send({ error: 'anchor failed', detail: msg });
    }
  });

  // Lightweight discovery: indexers / web can resolve the contract + ABI
  // entrypoint without parsing config.
  app.get('/anchor/config', async () => ({
    address: config.HAN_EVENT_ANCHOR_ADDRESS ?? null,
    network: config.AVAX_NETWORK,
    chainId: 43113,
    abi: hanEventAnchorAbi,
  }));
}
