import type { FastifyInstance } from 'fastify';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { getAddress, verifyMessage, type Hex } from 'viem';

import type { HubContext } from '../ws/context.js';
import { logger } from '../logger.js';

const NONCE_TTL_SECONDS = 60;
const NONCE_BYTES = 32;
const WS_TOKEN_BYTES = 32;

const evmAddress = z.string().regex(/^0x[a-fA-F0-9]{40}$/);
const hexSignature = z.string().regex(/^0x[a-fA-F0-9]+$/).max(200);

function nonceKey(wallet: string, nonceHex: string): string {
  return `han:nonce:${wallet.toLowerCase()}:${nonceHex}`;
}

function nonceMessage(nonceHex: string): string {
  return `Han login\nnonce: ${nonceHex}`;
}

const requestNonceSchema = z.object({
  wallet: evmAddress,
});

const createSessionSchema = z.object({
  streamerWallet: evmAddress,
  nonce: z.string().regex(/^[0-9a-f]+$/i).length(NONCE_BYTES * 2),
  signature: hexSignature,
  streamerName: z.string().min(1).max(32).optional(),
  description: z.string().min(1).max(120).optional(),
  tool: z.string().min(1).max(32).optional(),
  id: z.string().min(3).max(64).optional(),
  eventSlug: z.string().regex(/^[a-z0-9-]{3,64}$/).optional(),
  teamLabel: z.string().min(1).max(64).optional(),
});

function generateSessionId(streamerWallet: string): string {
  const suffix = randomBytes(2).toString('hex');
  const walletShort = streamerWallet.slice(2, 6).toLowerCase();
  return `${walletShort}.${suffix}`;
}

async function verifyWalletSignature(
  wallet: string,
  nonceHex: string,
  signatureHex: string,
): Promise<boolean> {
  try {
    return await verifyMessage({
      address: getAddress(wallet),
      message: nonceMessage(nonceHex),
      signature: signatureHex as Hex,
    });
  } catch (err) {
    logger.debug({ err }, 'signature verification threw');
    return false;
  }
}

export async function sessionsRoutes(app: FastifyInstance, ctx: HubContext): Promise<void> {
  app.post('/sessions/nonce', async (request, reply) => {
    const parsed = requestNonceSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'invalid body', details: parsed.error.issues });
    }

    const wallet = getAddress(parsed.data.wallet);
    const nonceHex = randomBytes(NONCE_BYTES).toString('hex');
    await ctx.redis.set(nonceKey(wallet, nonceHex), '1', 'EX', NONCE_TTL_SECONDS);

    return reply.status(201).send({
      nonce: nonceHex,
      message: nonceMessage(nonceHex),
      expiresAt: Date.now() + NONCE_TTL_SECONDS * 1000,
      ttlSeconds: NONCE_TTL_SECONDS,
    });
  });

  app.post('/sessions', async (request, reply) => {
    const parsed = createSessionSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'invalid body', details: parsed.error.issues });
    }
    const { nonce, signature, streamerName, description, tool, eventSlug, teamLabel } = parsed.data;
    const streamerWallet = getAddress(parsed.data.streamerWallet);

    const key = nonceKey(streamerWallet, nonce);
    const consumed = await ctx.redis.del(key);
    if (consumed === 0) {
      return reply.status(401).send({ error: 'nonce expired or already used' });
    }

    if (!(await verifyWalletSignature(streamerWallet, nonce, signature))) {
      return reply.status(401).send({ error: 'invalid signature' });
    }

    const id = parsed.data.id ?? generateSessionId(streamerWallet);
    const wsToken = randomBytes(WS_TOKEN_BYTES).toString('hex');

    let eventId: string | null = null;
    if (eventSlug) {
      const event = await ctx.db.event.findUnique({ where: { slug: eventSlug } });
      if (!event) {
        return reply.status(404).send({ error: `event ${eventSlug} not found` });
      }
      eventId = event.id;
    }

    try {
      const session = await ctx.db.session.create({
        data: {
          id,
          streamerWallet,
          wsToken,
          startedAt: new Date(),
          eventId,
          teamLabel: teamLabel ?? null,
        },
      });

      logger.info({ sessionId: id, streamerWallet, tool, eventSlug, teamLabel }, 'session reserved');
      return reply.status(201).send({
        sessionId: id,
        code: id,
        wsToken,
        startedAt: session.startedAt.getTime(),
        streamerName,
        description,
        tool,
      });
    } catch (err) {
      logger.error({ err, sessionId: id }, 'failed to create session');
      return reply.status(500).send({ error: 'internal error' });
    }
  });

  app.get('/sessions', async (_request, reply) => {
    try {
      const sessions = await ctx.lobby.getSnapshot();
      return reply.send(sessions);
    } catch (err) {
      logger.error({ err }, 'failed to get sessions');
      return reply.status(500).send({ error: 'internal error' });
    }
  });

  app.get('/sessions/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const lobby = await ctx.lobby.getSession(id);
      if (lobby) return reply.send(lobby);

      const session = await ctx.db.session.findUnique({ where: { id } });
      if (!session) return reply.status(404).send({ error: 'not found' });
      return reply.send(session);
    } catch (err) {
      logger.error({ err, sessionId: id }, 'failed to get session');
      return reply.status(500).send({ error: 'internal error' });
    }
  });

  app.delete('/sessions/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      await ctx.db.session.update({
        where: { id },
        data: { endedAt: new Date() },
      });

      await ctx.lobby.removeSession(id);

      ctx.cache.delete(id);
      ctx.fanout.delete(id);

      logger.info({ sessionId: id }, 'session closed');
      return reply.status(204).send();
    } catch (err) {
      logger.error({ err, sessionId: id }, 'failed to close session');
      return reply.status(500).send({ error: 'internal error' });
    }
  });
}
