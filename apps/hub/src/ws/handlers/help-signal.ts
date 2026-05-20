import { z } from 'zod';

import type { Connection } from '../gateway.js';
import type { HubContext } from '../context.js';
import { logger } from '../../logger.js';

// help_signal — a builder ("@team-deniz: cpi context error · 3m") asks for
// mentor attention. The runtime sends this when the streamer types `/help`
// or when the MCP agent decides the team is stuck. Sprint 4 will subscribe
// the judge mosaic UI to changes here and route red dots to mentors.
const openSchema = z.object({
  reason: z.string().max(200).optional(),
});

const closeSchema = z.object({
  signalId: z.string().uuid(),
  resolvedBy: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
});

export function makeHelpSignalHandlers(ctx: HubContext) {
  async function handleHelpSignalOpen(conn: Connection, payload: unknown): Promise<void> {
    const sessionId = conn.sessionId;
    if (!sessionId) {
      conn.ws.send(JSON.stringify({ type: 'error', message: 'not registered' }));
      return;
    }

    const parsed = openSchema.safeParse(payload);
    if (!parsed.success) {
      conn.ws.send(JSON.stringify({ type: 'error', message: 'invalid help_signal_open payload' }));
      return;
    }

    const session = await ctx.db.session.findUnique({
      where: { id: sessionId },
      select: { id: true, eventId: true, teamLabel: true },
    });
    if (!session || !session.eventId) {
      conn.ws.send(JSON.stringify({ type: 'error', message: 'session is not event-scoped' }));
      return;
    }

    // Best-effort lookup of the Team row by (eventId, teamLabel) — slug match.
    // Falls back to a label-only signal when no Team row exists yet.
    const team = session.teamLabel
      ? await ctx.db.team.findUnique({
          where: { eventId_slug: { eventId: session.eventId, slug: session.teamLabel } },
        })
      : null;

    const signal = await ctx.db.helpSignal.create({
      data: {
        eventId: session.eventId,
        teamId: team?.id ?? null,
        sessionId,
        reason: parsed.data.reason,
      },
    });

    logger.info(
      { signalId: signal.id, eventId: session.eventId, teamId: team?.id, sessionId },
      'help signal opened',
    );

    // Echo back to the builder so the runtime UI can confirm the red dot.
    conn.ws.send(JSON.stringify({ type: 'help_signal_opened', signalId: signal.id }));

    // Sprint 4: fan this out to mentor mosaic subscribers. For now we just log.
  }

  async function handleHelpSignalClose(conn: Connection, payload: unknown): Promise<void> {
    const parsed = closeSchema.safeParse(payload);
    if (!parsed.success) {
      conn.ws.send(JSON.stringify({ type: 'error', message: 'invalid help_signal_close payload' }));
      return;
    }
    const { signalId, resolvedBy } = parsed.data;
    try {
      const closed = await ctx.db.helpSignal.update({
        where: { id: signalId },
        data: { closedAt: new Date(), resolvedBy: resolvedBy ?? conn.walletAddress },
      });
      conn.ws.send(JSON.stringify({ type: 'help_signal_closed', signalId: closed.id }));
    } catch {
      conn.ws.send(JSON.stringify({ type: 'error', message: 'signal not found' }));
    }
  }

  return { handleHelpSignalOpen, handleHelpSignalClose };
}
