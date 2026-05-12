import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { HubContext } from '../ws/context.js';
import { logger } from '../logger.js';

const listQuerySchema = z.object({
  kind: z.enum(['channel', 'adhoc', 'stream']).optional(),
});

const createBodySchema = z.object({
  title: z.string().min(1).max(128),
  description: z.string().min(1).max(280).optional(),
  ownerWallet: z.string().min(32).max(64).optional(),
});

export async function roomsRoutes(app: FastifyInstance, ctx: HubContext): Promise<void> {
  // GET /rooms?kind=channel|adhoc|stream
  app.get('/rooms', async (request, reply) => {
    const parsed = listQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'invalid query', details: parsed.error.issues });
    }
    try {
      const rooms = await ctx.rooms.list(parsed.data.kind ? { kind: parsed.data.kind } : undefined);
      return reply.send(rooms);
    } catch (err) {
      logger.error({ err }, 'rooms list failed');
      return reply.status(500).send({ error: 'internal error' });
    }
  });

  // GET /rooms/:id
  app.get('/rooms/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const room = await ctx.rooms.get(id);
      if (!room) return reply.status(404).send({ error: 'not found' });
      return reply.send(room);
    } catch (err) {
      logger.error({ err, id }, 'rooms get failed');
      return reply.status(500).send({ error: 'internal error' });
    }
  });

  // POST /rooms — create an ad-hoc room. Authentication via ownerWallet is
  // V1; a signed handshake (like /sessions/nonce) lands in a follow-up.
  app.post('/rooms', async (request, reply) => {
    const parsed = createBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'invalid body', details: parsed.error.issues });
    }
    try {
      const room = await ctx.rooms.createAdhocRoom(parsed.data);
      logger.info({ roomId: room.id, title: room.title }, 'adhoc room created');
      return reply.status(201).send(room);
    } catch (err) {
      logger.error({ err }, 'adhoc room create failed');
      return reply.status(500).send({ error: 'internal error' });
    }
  });
}
