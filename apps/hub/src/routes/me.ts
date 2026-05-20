import type { FastifyInstance } from 'fastify';

import type { HubContext } from '../ws/context.js';
import { resolveBearerWallet } from '../auth/bearer.js';
import { logger } from '../logger.js';

export async function meRoutes(app: FastifyInstance, ctx: HubContext): Promise<void> {
  // GET /me/events — list events the bearer wallet is a member of, including
  // pending invites (acceptedAt null). Distinguished by `accepted` field.
  app.get('/me/events', async (req, reply) => {
    const wallet = await resolveBearerWallet(req, ctx);
    if (!wallet) return reply.code(401).send({ error: 'unauthenticated' });

    const members = await ctx.db.eventMember.findMany({
      where: { wallet },
      include: {
        event: {
          select: {
            id: true, slug: true, title: true, status: true, plan: true,
            startsAt: true, endsAt: true, organizerWallet: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return reply.send(
      members.map((m) => ({
        role: m.role,
        accepted: m.acceptedAt !== null,
        invitedBy: m.invitedBy,
        invitedAt: m.createdAt,
        event: m.event,
      })),
    );
  });

  // POST /events/:slug/accept — bearer wallet accepts a pending invite.
  // Idempotent: already-accepted returns 200 with the row.
  app.post('/events/:slug/accept', async (req, reply) => {
    const wallet = await resolveBearerWallet(req, ctx);
    if (!wallet) return reply.code(401).send({ error: 'unauthenticated' });

    const { slug } = req.params as { slug: string };
    const event = await ctx.db.event.findUnique({ where: { slug } });
    if (!event) return reply.code(404).send({ error: 'event not found' });

    const member = await ctx.db.eventMember.findUnique({
      where: { eventId_wallet: { eventId: event.id, wallet } },
    });
    if (!member) {
      return reply.code(403).send({ error: 'no invite for this wallet' });
    }
    if (member.acceptedAt) return reply.send(member);

    const updated = await ctx.db.eventMember.update({
      where: { eventId_wallet: { eventId: event.id, wallet } },
      data: { acceptedAt: new Date() },
    });
    logger.info({ eventId: event.id, wallet, role: updated.role }, 'event invite accepted');
    return reply.send(updated);
  });
}
