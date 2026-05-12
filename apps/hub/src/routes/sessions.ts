import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { HubContext } from '../ws/context.js';
import { logger } from '../logger.js';

const createSessionSchema = z.object({
  id: z.string().min(1).max(64),
  streamerWallet: z.string().min(1).max(64),
});

export async function sessionsRoutes(app: FastifyInstance, ctx: HubContext): Promise<void> {
  // POST /sessions
  app.post('/sessions', async (request, reply) => {
    const parsed = createSessionSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'invalid body', details: parsed.error.issues });
    }
    const { id, streamerWallet } = parsed.data;

    try {
      const session = await ctx.db.session.create({
        data: {
          id,
          streamerWallet,
          startedAt: new Date(),
        },
      });

      await ctx.lobby.addSession({
        id,
        streamerWallet,
        code: id,
        viewerCount: 0,
        startedAt: session.startedAt.getTime(),
      });

      logger.info({ sessionId: id }, 'session created');
      return reply.status(201).send(session);
    } catch (err) {
      logger.error({ err, sessionId: id }, 'failed to create session');
      return reply.status(500).send({ error: 'internal error' });
    }
  });

  // GET /sessions
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

      // clean up in-memory state
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
