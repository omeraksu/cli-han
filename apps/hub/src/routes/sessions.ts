import type { FastifyInstance } from 'fastify';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { PublicKey } from '@solana/web3.js';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import type { HubContext } from '../ws/context.js';
import { logger } from '../logger.js';

const NONCE_TTL_SECONDS = 60;
const NONCE_BYTES = 32;
const WS_TOKEN_BYTES = 32;

function nonceKey(wallet: string, nonceHex: string): string {
  return `han:nonce:${wallet}:${nonceHex}`;
}

const requestNonceSchema = z.object({
  wallet: z.string().min(32).max(64),
});

const createSessionSchema = z.object({
  streamerWallet: z.string().min(32).max(64),
  nonce: z.string().regex(/^[0-9a-f]+$/i).length(NONCE_BYTES * 2),
  signature: z.string().min(1).max(128),
  streamerName: z.string().min(1).max(32).optional(),
  description: z.string().min(1).max(120).optional(),
  tool: z.string().min(1).max(32).optional(),
  id: z.string().min(3).max(64).optional(),
});

function generateSessionId(streamerWallet: string): string {
  const suffix = randomBytes(2).toString('hex');
  const walletShort = streamerWallet.slice(0, 4).toLowerCase();
  return `${walletShort}.${suffix}`;
}

function verifyWalletSignature(wallet: string, nonceHex: string, signatureB58: string): boolean {
  try {
    const pubkey = new PublicKey(wallet);
    const nonceBytes = Buffer.from(nonceHex, 'hex');
    const sigBytes = bs58.decode(signatureB58);
    if (sigBytes.length !== nacl.sign.signatureLength) return false;
    return nacl.sign.detached.verify(nonceBytes, sigBytes, pubkey.toBytes());
  } catch (err) {
    logger.debug({ err }, 'signature verification threw');
    return false;
  }
}

export async function sessionsRoutes(app: FastifyInstance, ctx: HubContext): Promise<void> {
  // POST /sessions/nonce — issue a one-shot nonce for a wallet to sign
  app.post('/sessions/nonce', async (request, reply) => {
    const parsed = requestNonceSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'invalid body', details: parsed.error.issues });
    }
    try {
      new PublicKey(parsed.data.wallet);
    } catch {
      return reply.status(400).send({ error: 'invalid wallet pubkey' });
    }

    const nonceHex = randomBytes(NONCE_BYTES).toString('hex');
    await ctx.redis.set(nonceKey(parsed.data.wallet, nonceHex), '1', 'EX', NONCE_TTL_SECONDS);

    return reply.status(201).send({
      nonce: nonceHex,
      expiresAt: Date.now() + NONCE_TTL_SECONDS * 1000,
      ttlSeconds: NONCE_TTL_SECONDS,
    });
  });

  // POST /sessions — streamer registers a new live session.
  // Requires a fresh nonce signed by the streamer wallet.
  app.post('/sessions', async (request, reply) => {
    const parsed = createSessionSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'invalid body', details: parsed.error.issues });
    }
    const { streamerWallet, nonce, signature, streamerName, description, tool } = parsed.data;

    const key = nonceKey(streamerWallet, nonce);
    const consumed = await ctx.redis.del(key);
    if (consumed === 0) {
      return reply.status(401).send({ error: 'nonce expired or already used' });
    }

    if (!verifyWalletSignature(streamerWallet, nonce, signature)) {
      return reply.status(401).send({ error: 'invalid signature' });
    }

    const id = parsed.data.id ?? generateSessionId(streamerWallet);
    const wsToken = randomBytes(WS_TOKEN_BYTES).toString('hex');

    try {
      const session = await ctx.db.session.create({
        data: {
          id,
          streamerWallet,
          wsToken,
          startedAt: new Date(),
        },
      });

      logger.info({ sessionId: id, streamerWallet, tool }, 'session reserved');
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

  // GET /sessions — lobby snapshot
  app.get('/sessions', async (_request, reply) => {
    try {
      const sessions = await ctx.lobby.getSnapshot();
      return reply.send(sessions);
    } catch (err) {
      logger.error({ err }, 'failed to get sessions');
      return reply.status(500).send({ error: 'internal error' });
    }
  });

  // GET /sessions/:id
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

  // DELETE /sessions/:id
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
