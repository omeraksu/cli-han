import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import type { HubContext } from '../ws/context.js';
import { logger } from '../logger.js';
import { generateCorpusReport } from '../corpus/analyzer.js';

const evmAddress = z.string().regex(/^0x[a-fA-F0-9]{40}$/);
const slug = z.string().regex(/^[a-z0-9-]{3,64}$/);

const createEventSchema = z.object({
  slug,
  title: z.string().min(3).max(128),
  organizerWallet: evmAddress,
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  brand: z.record(z.unknown()).optional(),
});

const createSubmissionSchema = z.object({
  teamLabel: z.string().min(1).max(64),
  title: z.string().min(1).max(128),
  summary: z.string().max(1024).optional(),
  repoUrl: z.string().url().max(256).optional(),
  demoUrl: z.string().url().max(256).optional(),
});

export async function corpusRoutes(app: FastifyInstance, ctx: HubContext): Promise<void> {
  // Lightweight event create — Build Corpus Report MVP. Full Event CRUD with
  // org/team/role lands in Sprint 2.
  app.post('/corpus/events', async (req, reply) => {
    const parsed = createEventSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid body', details: parsed.error.flatten() });
    }
    const { slug, title, organizerWallet, startsAt, endsAt, brand } = parsed.data;

    const existing = await ctx.db.event.findUnique({ where: { slug } });
    if (existing) {
      return reply.code(409).send({ error: 'slug exists', eventId: existing.id });
    }

    const event = await ctx.db.event.create({
      data: {
        slug,
        title,
        organizerWallet,
        startsAt: startsAt ? new Date(startsAt) : new Date(),
        endsAt: endsAt ? new Date(endsAt) : null,
        status: 'live',
        plan: 'corpus-report',
        brand: brand ? (JSON.parse(JSON.stringify(brand)) as object) : undefined,
      },
    });

    logger.info({ eventId: event.id, slug }, 'corpus event created');
    return reply.code(201).send(event);
  });

  app.get('/corpus/events/:slug', async (req, reply) => {
    const { slug: eventSlug } = req.params as { slug: string };
    const event = await ctx.db.event.findUnique({
      where: { slug: eventSlug },
      include: {
        sessions: { select: { id: true, streamerWallet: true, teamLabel: true, startedAt: true, endedAt: true } },
        submissions: true,
        reports: { orderBy: { createdAt: 'desc' }, take: 5 },
      },
    });
    if (!event) return reply.code(404).send({ error: 'event not found' });
    return reply.send(event);
  });

  app.post('/corpus/events/:slug/submissions', async (req, reply) => {
    const { slug: eventSlug } = req.params as { slug: string };
    const event = await ctx.db.event.findUnique({ where: { slug: eventSlug } });
    if (!event) return reply.code(404).send({ error: 'event not found' });

    const parsed = createSubmissionSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid body', details: parsed.error.flatten() });
    }

    const submission = await ctx.db.submission.create({
      data: { eventId: event.id, ...parsed.data },
    });
    return reply.code(201).send(submission);
  });

  // Trigger report generation. Sync for MVP — Sprint 8 will move this to a
  // background worker with status polling.
  app.post('/corpus/events/:slug/reports', async (req, reply) => {
    const { slug: eventSlug } = req.params as { slug: string };
    const event = await ctx.db.event.findUnique({ where: { slug: eventSlug } });
    if (!event) return reply.code(404).send({ error: 'event not found' });

    const reportRow = await ctx.db.corpusReport.create({
      data: { eventId: event.id, status: 'running' },
    });

    try {
      const result = await generateCorpusReport(ctx, event.id);
      const updated = await ctx.db.corpusReport.update({
        where: { id: reportRow.id },
        data: {
          status: 'ready',
          frictionMap: JSON.parse(JSON.stringify(result.frictionMap)) as object,
          pdfPath: result.pdfPath,
          generatedAt: new Date(),
        },
      });
      return reply.send(updated);
    } catch (err) {
      logger.error({ err, eventId: event.id }, 'corpus report failed');
      await ctx.db.corpusReport.update({
        where: { id: reportRow.id },
        data: { status: 'failed' },
      });
      return reply.code(500).send({ error: 'report generation failed' });
    }
  });

  app.get('/corpus/events/:slug/reports/:reportId', async (req, reply) => {
    const { slug: eventSlug, reportId } = req.params as { slug: string; reportId: string };
    const report = await ctx.db.corpusReport.findUnique({
      where: { id: reportId },
      include: { event: { select: { slug: true } } },
    });
    if (!report || report.event.slug !== eventSlug) {
      return reply.code(404).send({ error: 'report not found' });
    }
    return reply.send(report);
  });
}
