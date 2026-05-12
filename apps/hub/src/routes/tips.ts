import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { HubContext } from '../ws/context.js';
import { logger } from '../logger.js';
import { config } from '../config.js';

const createTipSchema = z.object({
  sessionId: z.string().min(1).max(64),
  fromWallet: z.string().min(1).max(64),
  toWallet: z.string().min(1).max(64),
  amountLamports: z.number().int().positive(),
  txSignature: z.string().min(1).max(128),
});

interface RpcResponse {
  result: {
    meta?: { err: unknown } | null;
  } | null;
}

async function verifyTransaction(signature: string): Promise<boolean> {
  try {
    const body = JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'getTransaction',
      params: [signature, { encoding: 'json', maxSupportedTransactionVersion: 0 }],
    });

    const res = await fetch(config.SOLANA_RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });

    const json = (await res.json()) as RpcResponse;
    if (!json.result) return false;
    return json.result.meta?.err === null;
  } catch (err) {
    logger.warn({ err, signature }, 'tx verification failed');
    return false;
  }
}

export async function tipsRoutes(app: FastifyInstance, ctx: HubContext): Promise<void> {
  // POST /tips
  app.post('/tips', async (request, reply) => {
    const parsed = createTipSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'invalid body', details: parsed.error.issues });
    }
    const { sessionId, fromWallet, toWallet, amountLamports, txSignature } = parsed.data;

    const valid = await verifyTransaction(txSignature);
    if (!valid) {
      return reply.status(422).send({ error: 'transaction not confirmed or invalid' });
    }

    try {
      const tip = await ctx.db.tip.create({
        data: {
          sessionId,
          fromWallet,
          toWallet,
          amountLamports: BigInt(amountLamports),
          txSignature,
        },
      });

      // notify streamer via WS
      const streamers = ctx.gateway.getStreamers().filter((c) => c.sessionId === sessionId);
      for (const streamer of streamers) {
        ctx.gateway.send(streamer.id, {
          type: 'tip_received',
          fromWallet,
          amountLamports,
          txSignature,
        });
      }

      logger.info({ sessionId, fromWallet, amountLamports }, 'tip recorded');
      return reply.status(201).send({
        ...tip,
        amountLamports: tip.amountLamports.toString(),
      });
    } catch (err) {
      logger.error({ err, txSignature }, 'failed to record tip');
      return reply.status(500).send({ error: 'internal error' });
    }
  });
}
