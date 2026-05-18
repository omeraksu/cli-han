import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  createPublicClient,
  fallback,
  http,
  parseEventLogs,
  getAddress,
  type Address,
  type Hex,
} from 'viem';
import { avalanche, avalancheFuji } from 'viem/chains';
import { hanTipRouterAbi } from '@han/sdk';

import type { HubContext } from '../ws/context.js';
import { logger } from '../logger.js';
import { config } from '../config.js';

const TIP_FEE_BPS = 300n;
const BPS_DENOMINATOR = 10_000n;
const FEE_TOLERANCE_WEI = 1n;
const WEI_PER_AVAX = 10n ** 18n;

const evmAddress = z.string().regex(/^0x[a-fA-F0-9]{40}$/);
const txHash = z.string().regex(/^0x[a-fA-F0-9]{64}$/);

const createTipSchema = z.object({
  sessionId: z.string().min(1).max(64),
  fromWallet: evmAddress,
  toWallet: evmAddress,
  router: evmAddress,
  amountWei: z.string().regex(/^\d+$/, 'amountWei must be a base-10 integer string'),
  txHash,
});

const chain = config.AVAX_NETWORK === 'mainnet' ? avalanche : avalancheFuji;
const publicClient = createPublicClient({
  chain,
  transport: fallback(
    [config.AVAX_RPC_URL, ...config.AVAX_RPC_FALLBACK_URLS].map((u) => http(u, { retryCount: 2 })),
    { rank: false },
  ),
});

function avaxFromWei(wei: bigint): number {
  return Number(wei) / Number(WEI_PER_AVAX);
}

export async function tipsRoutes(app: FastifyInstance, ctx: HubContext): Promise<void> {
  app.post('/tips', async (request, reply) => {
    const parsed = createTipSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'invalid body', details: parsed.error.issues });
    }
    const body = parsed.data;
    const fromWallet = getAddress(body.fromWallet);
    const toWallet = getAddress(body.toWallet);
    const router = getAddress(body.router);
    const expectedRouter = getAddress(config.HAN_TIP_ROUTER_ADDRESS);
    const amountWei = BigInt(body.amountWei);

    if (router !== expectedRouter) {
      logger.warn(
        { router, expected: expectedRouter, txHash: body.txHash },
        'tip rejected: router mismatch',
      );
      return reply.status(422).send({ error: 'unauthorized router contract' });
    }

    if (amountWei <= 0n) {
      return reply.status(422).send({ error: 'amountWei must be positive' });
    }

    const expectedFee = (amountWei * TIP_FEE_BPS) / BPS_DENOMINATOR;
    const expectedStreamer = amountWei - expectedFee;

    let receipt: Awaited<ReturnType<typeof publicClient.getTransactionReceipt>>;
    try {
      receipt = await publicClient.getTransactionReceipt({ hash: body.txHash as Hex });
    } catch (err) {
      logger.warn({ err, txHash: body.txHash }, 'tip receipt fetch failed');
      return reply.status(422).send({ error: 'transaction not found' });
    }

    if (receipt.status !== 'success') {
      return reply.status(422).send({ error: 'transaction reverted on-chain' });
    }
    if (!receipt.to || getAddress(receipt.to) !== expectedRouter) {
      return reply.status(422).send({ error: 'transaction did not call tip router' });
    }

    const decoded = parseEventLogs({
      abi: hanTipRouterAbi,
      logs: receipt.logs,
      eventName: 'Tipped',
    });
    const event = decoded.find(
      (e) =>
        (getAddress((e.args as { viewer: Address }).viewer) === fromWallet) &&
        (getAddress((e.args as { streamer: Address }).streamer) === toWallet),
    );
    if (!event) {
      return reply.status(422).send({ error: 'matching Tipped event not found' });
    }

    const args = event.args as unknown as {
      viewer: Address;
      streamer: Address;
      amount: bigint;
      feeAmount: bigint;
      streamerAmount: bigint;
    };

    if (args.amount !== amountWei) {
      return reply.status(422).send({
        error: `amount mismatch: expected ${amountWei}, got ${args.amount}`,
      });
    }
    if (args.feeAmount + FEE_TOLERANCE_WEI < expectedFee || args.feeAmount > expectedFee + FEE_TOLERANCE_WEI) {
      return reply.status(422).send({
        error: `fee mismatch: expected ${expectedFee}, got ${args.feeAmount}`,
      });
    }
    if (
      args.streamerAmount + FEE_TOLERANCE_WEI < expectedStreamer ||
      args.streamerAmount > expectedStreamer + FEE_TOLERANCE_WEI
    ) {
      return reply.status(422).send({
        error: `streamer amount mismatch: expected ${expectedStreamer}, got ${args.streamerAmount}`,
      });
    }

    try {
      const tip = await ctx.db.tip.create({
        data: {
          sessionId: body.sessionId,
          fromWallet,
          toWallet,
          amountWei: amountWei.toString(),
          feeWei: expectedFee.toString(),
          streamerWei: expectedStreamer.toString(),
          txHash: body.txHash,
        },
      });

      const newTotalAvax = await ctx.lobby.addTipWei(body.sessionId, amountWei);
      const amountAvax = avaxFromWei(amountWei);

      const streamers = ctx.gateway
        .getStreamers()
        .filter((c) => c.sessionId === body.sessionId);
      for (const streamer of streamers) {
        ctx.gateway.send(streamer.id, {
          type: 'new_tip',
          from: fromWallet,
          amount: amountAvax,
        });
      }

      const viewers = ctx.gateway.getViewersForSession(body.sessionId);
      for (const viewer of viewers) {
        ctx.gateway.send(viewer.id, {
          type: 'tip_event',
          from: fromWallet,
          amount: amountAvax,
          tipAvax: newTotalAvax ?? amountAvax,
        });
      }

      logger.info(
        { sessionId: body.sessionId, fromWallet, amountWei: amountWei.toString() },
        'tip recorded',
      );
      return reply.status(201).send({
        id: tip.id,
        sessionId: body.sessionId,
        fromWallet,
        toWallet,
        amountWei: amountWei.toString(),
        feeWei: expectedFee.toString(),
        streamerWei: expectedStreamer.toString(),
        txHash: body.txHash,
        tipAvax: newTotalAvax ?? amountAvax,
      });
    } catch (err) {
      logger.error({ err, txHash: body.txHash }, 'failed to record tip');
      return reply.status(500).send({ error: 'internal error' });
    }
  });
}
