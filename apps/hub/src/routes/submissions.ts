import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import type { HubContext } from '../ws/context.js';
import { logger } from '../logger.js';

const createSubmissionSchema = z.object({
  title: z.string().min(1).max(128),
  summary: z.string().max(1024).optional(),
  repoUrl: z.string().url().max(256).optional(),
  demoUrl: z.string().url().max(256).optional(),
});

export async function submissionsRoutes(app: FastifyInstance, ctx: HubContext): Promise<void> {
  // Submit on behalf of a team. anchor TX is set by Sprint 6 once
  // HanEventAnchor.sol ships; for now the field stays null and the route
  // returns the row immediately.
  app.post('/events/:slug/teams/:teamId/submissions', async (req, reply) => {
    const { slug, teamId } = req.params as { slug: string; teamId: string };
    const team = await ctx.db.team.findUnique({
      where: { id: teamId },
      include: { event: { select: { id: true, slug: true } } },
    });
    if (!team || team.event.slug !== slug) {
      return reply.code(404).send({ error: 'team not found' });
    }

    const parsed = createSubmissionSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid body', details: parsed.error.flatten() });
    }

    const submission = await ctx.db.submission.create({
      data: {
        eventId: team.event.id,
        teamId: team.id,
        teamLabel: team.slug,
        title: parsed.data.title,
        summary: parsed.data.summary,
        repoUrl: parsed.data.repoUrl,
        demoUrl: parsed.data.demoUrl,
      },
    });

    logger.info({ submissionId: submission.id, teamId: team.id }, 'submission created');
    return reply.code(201).send(submission);
  });

  app.get('/events/:slug/submissions', async (req, reply) => {
    const { slug } = req.params as { slug: string };
    const event = await ctx.db.event.findUnique({ where: { slug } });
    if (!event) return reply.code(404).send({ error: 'event not found' });

    const submissions = await ctx.db.submission.findMany({
      where: { eventId: event.id },
      include: { team: { select: { slug: true, name: true } } },
      orderBy: { submittedAt: 'desc' },
    });
    return reply.send(submissions);
  });

  app.get('/events/:slug/submissions/:submissionId', async (req, reply) => {
    const { slug, submissionId } = req.params as { slug: string; submissionId: string };
    const submission = await ctx.db.submission.findUnique({
      where: { id: submissionId },
      include: { event: { select: { slug: true } }, team: true },
    });
    if (!submission || submission.event.slug !== slug) {
      return reply.code(404).send({ error: 'submission not found' });
    }
    return reply.send(submission);
  });
}
