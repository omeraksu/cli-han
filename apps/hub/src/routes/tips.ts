import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { HubContext } from '../ws/context.js';
import { logger } from '../logger.js';
import { config } from '../config.js';

const TIP_FEE_BPS = 300;
const BPS_DENOMINATOR = 10_000;
const FEE_TOLERANCE_LAMPORTS = 1;
const LAMPORTS_PER_SOL = 1_000_000_000;

const createTipSchema = z.object({
  sessionId: z.string().min(1).max(64),
  fromWallet: z.string().min(32).max(64),
  toWallet: z.string().min(32).max(64),
  feeCollector: z.string().min(32).max(64),
  amountLamports: z.number().int().positive(),
  txSignature: z.string().min(1).max(128),
});

interface ParsedTransfer {
  source: string;
  destination: string;
  lamports: number;
}

interface ParsedTxResponse {
  result: {
    meta?: { err: unknown } | null;
    transaction?: {
      message?: {
        instructions?: Array<{
          program?: string;
          parsed?: {
            type?: string;
            info?: { source?: string; destination?: string; lamports?: number };
          };
        }>;
      };
    };
  } | null;
}

interface VerifyOk {
  ok: true;
  transfers: ParsedTransfer[];
}

interface VerifyFail {
  ok: false;
  reason: string;
}

type VerifyResult = VerifyOk | VerifyFail;

async function fetchTransaction(signature: string): Promise<ParsedTxResponse | null> {
  try {
    const body = JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'getTransaction',
      params: [
        signature,
        { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0, commitment: 'confirmed' },
      ],
    });
    const res = await fetch(config.SOLANA_RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    return (await res.json()) as ParsedTxResponse;
  } catch (err) {
    logger.warn({ err, signature }, 'rpc fetch failed');
    return null;
  }
}

function verifySplit(
  parsed: ParsedTxResponse | null,
  expected: {
    fromWallet: string;
    toWallet: string;
    feeCollector: string;
    feeLamports: number;
    streamerLamports: number;
  },
): VerifyResult {
  if (!parsed?.result) return { ok: false, reason: 'transaction not found' };
  if (parsed.result.meta?.err !== null && parsed.result.meta?.err !== undefined) {
    if (parsed.result.meta?.err !== null) return { ok: false, reason: 'transaction failed on-chain' };
  }

  const ixs = parsed.result.transaction?.message?.instructions ?? [];
  const transfers: ParsedTransfer[] = [];
  for (const ix of ixs) {
    if (ix.program === 'system' && ix.parsed?.type === 'transfer') {
      const info = ix.parsed.info;
      if (info?.source && info.destination && typeof info.lamports === 'number') {
        transfers.push({
          source: info.source,
          destination: info.destination,
          lamports: info.lamports,
        });
      }
    }
  }

  const feeTransfer = transfers.find(
    (t) => t.source === expected.fromWallet && t.destination === expected.feeCollector,
  );
  if (!feeTransfer) return { ok: false, reason: 'fee transfer missing' };

  const streamerTransfer = transfers.find(
    (t) => t.source === expected.fromWallet && t.destination === expected.toWallet,
  );
  if (!streamerTransfer) return { ok: false, reason: 'streamer transfer missing' };

  if (Math.abs(feeTransfer.lamports - expected.feeLamports) > FEE_TOLERANCE_LAMPORTS) {
    return {
      ok: false,
      reason: `fee mismatch: expected ${expected.feeLamports}, got ${feeTransfer.lamports}`,
    };
  }
  if (Math.abs(streamerTransfer.lamports - expected.streamerLamports) > FEE_TOLERANCE_LAMPORTS) {
    return {
      ok: false,
      reason: `streamer amount mismatch: expected ${expected.streamerLamports}, got ${streamerTransfer.lamports}`,
    };
  }

  return { ok: true, transfers };
}

export async function tipsRoutes(app: FastifyInstance, ctx: HubContext): Promise<void> {
  // POST /tips — record an already-confirmed split tip
  app.post('/tips', async (request, reply) => {
    const parsed = createTipSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'invalid body', details: parsed.error.issues });
    }
    const { sessionId, fromWallet, toWallet, feeCollector, amountLamports, txSignature } =
      parsed.data;

    if (feeCollector !== config.HAN_FEE_COLLECTOR_PUBKEY) {
      logger.warn(
        { feeCollector, expected: config.HAN_FEE_COLLECTOR_PUBKEY, txSignature },
        'tip rejected: fee collector mismatch',
      );
      return reply.status(422).send({ error: 'unauthorized fee collector' });
    }

    const expectedFee = Math.floor((amountLamports * TIP_FEE_BPS) / BPS_DENOMINATOR);
    const expectedStreamer = amountLamports - expectedFee;

    const tx = await fetchTransaction(txSignature);
    const verification = verifySplit(tx, {
      fromWallet,
      toWallet,
      feeCollector,
      feeLamports: expectedFee,
      streamerLamports: expectedStreamer,
    });

    if (!verification.ok) {
      logger.warn({ txSignature, reason: verification.reason }, 'tip verification failed');
      return reply.status(422).send({ error: verification.reason });
    }

    try {
      const tip = await ctx.db.tip.create({
        data: {
          sessionId,
          fromWallet,
          toWallet,
          amountLamports: BigInt(amountLamports),
          feeLamports: BigInt(expectedFee),
          streamerLamports: BigInt(expectedStreamer),
          txSignature,
        },
      });

      const newTotalSol = await ctx.lobby.addTipLamports(sessionId, amountLamports);

      // notify streamer
      const streamers = ctx.gateway
        .getStreamers()
        .filter((c) => c.sessionId === sessionId);
      const amountSol = amountLamports / LAMPORTS_PER_SOL;
      for (const streamer of streamers) {
        ctx.gateway.send(streamer.id, {
          type: 'new_tip',
          from: fromWallet,
          amount: amountSol,
        });
      }

      // notify all viewers in the session
      const viewers = ctx.gateway.getViewersForSession(sessionId);
      for (const viewer of viewers) {
        ctx.gateway.send(viewer.id, {
          type: 'tip_event',
          from: fromWallet,
          amount: amountSol,
          tipSol: newTotalSol ?? amountSol,
        });
      }

      logger.info(
        { sessionId, fromWallet, amountLamports, feeLamports: expectedFee },
        'tip recorded',
      );
      return reply.status(201).send({
        id: tip.id,
        sessionId,
        fromWallet,
        toWallet,
        amountLamports: amountLamports.toString(),
        feeLamports: expectedFee.toString(),
        streamerLamports: expectedStreamer.toString(),
        txSignature,
        tipSol: newTotalSol ?? amountSol,
      });
    } catch (err) {
      logger.error({ err, txSignature }, 'failed to record tip');
      return reply.status(500).send({ error: 'internal error' });
    }
  });
}
