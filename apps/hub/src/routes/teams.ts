import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import type { HubContext } from '../ws/context.js';

const evmAddress = z.string().regex(/^0x[a-fA-F0-9]{40}$/);
const slug = z.string().regex(/^[a-z0-9-]{2,64}$/);

const createTeamSchema = z.object({
  slug,
  name: z.string().min(1).max(128),
});

const addMemberSchema = z.object({
  wallet: evmAddress,
  role: z.enum(['lead', 'member']).default('member'),
});

export async function teamsRoutes(app: FastifyInstance, ctx: HubContext): Promise<void> {
  app.get('/events/:slug/teams', async (req, reply) => {
    const { slug } = req.params as { slug: string };
    const event = await ctx.db.event.findUnique({ where: { slug } });
    if (!event) return reply.code(404).send({ error: 'event not found' });

    const teams = await ctx.db.team.findMany({
      where: { eventId: event.id },
      include: {
        members: { include: { profile: { select: { handle: true } } } },
        _count: { select: { submissions: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    return reply.send(teams);
  });

  app.post('/events/:slug/teams', async (req, reply) => {
    const { slug: eventSlug } = req.params as { slug: string };
    const event = await ctx.db.event.findUnique({ where: { slug: eventSlug } });
    if (!event) return reply.code(404).send({ error: 'event not found' });

    const parsed = createTeamSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid body', details: parsed.error.flatten() });

    try {
      const team = await ctx.db.team.create({
        data: { eventId: event.id, slug: parsed.data.slug, name: parsed.data.name },
      });
      return reply.code(201).send(team);
    } catch {
      return reply.code(409).send({ error: 'team slug exists in this event' });
    }
  });

  app.get('/events/:slug/teams/:teamId', async (req, reply) => {
    const { slug, teamId } = req.params as { slug: string; teamId: string };
    const team = await ctx.db.team.findUnique({
      where: { id: teamId },
      include: {
        event: { select: { slug: true } },
        members: { include: { profile: { select: { handle: true } } } },
        submissions: true,
      },
    });
    if (!team || team.event.slug !== slug) return reply.code(404).send({ error: 'not found' });
    return reply.send(team);
  });

  app.post('/events/:slug/teams/:teamId/members', async (req, reply) => {
    const { slug, teamId } = req.params as { slug: string; teamId: string };
    const team = await ctx.db.team.findUnique({
      where: { id: teamId },
      include: { event: { select: { id: true, slug: true } } },
    });
    if (!team || team.event.slug !== slug) return reply.code(404).send({ error: 'team not found' });

    const parsed = addMemberSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid body', details: parsed.error.flatten() });
    const { wallet, role: teamRole } = parsed.data;

    // Profile + EventMember (builder) auto-provisioning so a team member can
    // immediately stream into the event without a separate invite step.
    await ctx.db.profile.upsert({
      where: { wallet },
      update: {},
      create: { wallet, handle: `builder-${wallet.slice(2, 8).toLowerCase()}` },
    });
    await ctx.db.eventMember.upsert({
      where: { eventId_wallet: { eventId: team.event.id, wallet } },
      update: {},
      create: { eventId: team.event.id, wallet, role: 'builder', acceptedAt: new Date() },
    });

    try {
      const member = await ctx.db.teamMember.create({
        data: { teamId: team.id, wallet, role: teamRole },
      });
      return reply.code(201).send(member);
    } catch {
      return reply.code(409).send({ error: 'already on this team' });
    }
  });

  app.delete('/events/:slug/teams/:teamId/members/:wallet', async (req, reply) => {
    const { slug, teamId, wallet } = req.params as {
      slug: string;
      teamId: string;
      wallet: string;
    };
    const team = await ctx.db.team.findUnique({
      where: { id: teamId },
      include: { event: { select: { slug: true } } },
    });
    if (!team || team.event.slug !== slug) return reply.code(404).send({ error: 'team not found' });

    const deleted = await ctx.db.teamMember.deleteMany({
      where: { teamId: team.id, wallet },
    });
    if (deleted.count === 0) return reply.code(404).send({ error: 'member not found' });
    return reply.code(204).send();
  });
}
