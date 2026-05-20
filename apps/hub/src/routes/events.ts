import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import type { HubContext } from '../ws/context.js';
import { logger } from '../logger.js';

const evmAddress = z.string().regex(/^0x[a-fA-F0-9]{40}$/);
const slug = z.string().regex(/^[a-z0-9-]{3,64}$/);
const role = z.enum(['organizer', 'judge', 'mentor', 'instructor', 'builder', 'spectator']);

const createEventSchema = z.object({
  slug,
  title: z.string().min(3).max(128),
  organizerWallet: evmAddress,
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  plan: z.enum(['corpus-report', 'workshop', 'hackathon', 'ecosystem']).default('corpus-report'),
  brand: z.record(z.unknown()).optional(),
});

const updateEventSchema = z.object({
  title: z.string().min(3).max(128).optional(),
  status: z.enum(['draft', 'live', 'ended', 'archived']).optional(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  brand: z.record(z.unknown()).optional(),
});

const inviteMemberSchema = z.object({
  wallet: evmAddress,
  role,
});

function toJsonInput(v: unknown): object | undefined {
  return v == null ? undefined : (JSON.parse(JSON.stringify(v)) as object);
}

export async function eventsRoutes(app: FastifyInstance, ctx: HubContext): Promise<void> {
  // Create. Auto-promotes the organizerWallet to organizer EventMember.
  app.post('/events', async (req, reply) => {
    const parsed = createEventSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid body', details: parsed.error.flatten() });
    const data = parsed.data;

    const existing = await ctx.db.event.findUnique({ where: { slug: data.slug } });
    if (existing) return reply.code(409).send({ error: 'slug exists', eventId: existing.id });

    // Profile is required for EventMember FK. Auto-upsert a thin profile if missing.
    const handleSeed = `org-${data.organizerWallet.slice(2, 8).toLowerCase()}`;
    await ctx.db.profile.upsert({
      where: { wallet: data.organizerWallet },
      update: {},
      create: { wallet: data.organizerWallet, handle: handleSeed },
    });

    const event = await ctx.db.event.create({
      data: {
        slug: data.slug,
        title: data.title,
        organizerWallet: data.organizerWallet,
        startsAt: data.startsAt ? new Date(data.startsAt) : new Date(),
        endsAt: data.endsAt ? new Date(data.endsAt) : null,
        status: 'live',
        plan: data.plan,
        brand: toJsonInput(data.brand),
        members: {
          create: {
            wallet: data.organizerWallet,
            role: 'organizer',
            acceptedAt: new Date(),
          },
        },
      },
      include: { members: true },
    });

    logger.info({ eventId: event.id, slug: event.slug }, 'event created');
    return reply.code(201).send(event);
  });

  app.get('/events', async (_req, reply) => {
    const events = await ctx.db.event.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true, slug: true, title: true, organizerWallet: true,
        startsAt: true, endsAt: true, status: true, plan: true,
      },
    });
    return reply.send(events);
  });

  app.get('/events/:slug', async (req, reply) => {
    const { slug } = req.params as { slug: string };
    const event = await ctx.db.event.findUnique({
      where: { slug },
      include: {
        members: true,
        teams: { include: { _count: { select: { members: true, submissions: true } } } },
        sessions: {
          select: { id: true, streamerWallet: true, teamLabel: true, startedAt: true, endedAt: true },
          orderBy: { startedAt: 'desc' },
          take: 20,
        },
        submissions: true,
        helpSignals: {
          where: { closedAt: null },
          orderBy: { openedAt: 'desc' },
        },
      },
    });
    if (!event) return reply.code(404).send({ error: 'not found' });
    return reply.send(event);
  });

  app.patch('/events/:slug', async (req, reply) => {
    const { slug } = req.params as { slug: string };
    const parsed = updateEventSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid body', details: parsed.error.flatten() });

    const data = parsed.data;
    try {
      const event = await ctx.db.event.update({
        where: { slug },
        data: {
          title: data.title,
          status: data.status,
          startsAt: data.startsAt ? new Date(data.startsAt) : undefined,
          endsAt: data.endsAt ? new Date(data.endsAt) : undefined,
          brand: toJsonInput(data.brand),
        },
      });
      return reply.send(event);
    } catch {
      return reply.code(404).send({ error: 'not found' });
    }
  });

  // Invite a member to the event. role decides organizer/judge/mentor/etc.
  app.post('/events/:slug/members', async (req, reply) => {
    const { slug } = req.params as { slug: string };
    const event = await ctx.db.event.findUnique({ where: { slug } });
    if (!event) return reply.code(404).send({ error: 'event not found' });

    const parsed = inviteMemberSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid body', details: parsed.error.flatten() });
    const { wallet, role: memberRole } = parsed.data;

    const handleSeed = `${memberRole}-${wallet.slice(2, 8).toLowerCase()}`;
    await ctx.db.profile.upsert({
      where: { wallet },
      update: {},
      create: { wallet, handle: handleSeed },
    });

    try {
      const member = await ctx.db.eventMember.create({
        data: { eventId: event.id, wallet, role: memberRole, invitedBy: event.organizerWallet },
      });
      return reply.code(201).send(member);
    } catch {
      return reply.code(409).send({ error: 'already a member' });
    }
  });

  app.delete('/events/:slug/members/:wallet', async (req, reply) => {
    const { slug, wallet } = req.params as { slug: string; wallet: string };
    const event = await ctx.db.event.findUnique({ where: { slug } });
    if (!event) return reply.code(404).send({ error: 'event not found' });
    const deleted = await ctx.db.eventMember.deleteMany({
      where: { eventId: event.id, wallet },
    });
    if (deleted.count === 0) return reply.code(404).send({ error: 'member not found' });
    return reply.code(204).send();
  });
}
