import type { FastifyInstance } from 'fastify';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import type { HubContext } from '../ws/context.js';
import { logger } from '../logger.js';

const createSessionSchema = z.object({
  streamerWallet: z.string().min(32).max(64),
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

export async function sessionsRoutes(app: FastifyInstance, ctx: HubContext): Promise<void> {
  // POST /sessions — streamer registers a new live session
  app.post('/sessions', async (request, reply) => {
    const parsed = createSessionSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'invalid body', details: parsed.error.issues });
    }
    const { streamerWallet, streamerName, description, tool } = parsed.data;
    const id = parsed.data.id ?? generateSessionId(streamerWallet);

    try {
      const session = await ctx.db.session.create({
        data: {
          id,
          streamerWallet,
          startedAt: new Date(),
        },
      });

      // Lobby entry is created when the streamer actually opens the WS
      // (register_streamer handler). If the client never reconnects this
      // row stays in Postgres but never shows up as a zombie in the lobby.
      // The optional metadata fields ride along on the register payload.

      logger.info({ sessionId: id, streamerWallet, tool }, 'session reserved');
      return reply.status(201).send({
        sessionId: id,
        code: id,
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
