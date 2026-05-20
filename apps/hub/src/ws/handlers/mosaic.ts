import { z } from 'zod';

import type { Connection } from '../gateway.js';
import type { HubContext } from '../context.js';
import { logger } from '../../logger.js';

const subscribeSchema = z.object({
  eventSlug: z.string().regex(/^[a-z0-9-]{3,64}$/),
});

export function makeMosaicHandlers(ctx: HubContext) {
  // mosaic_subscribe — a judge / mentor opens a WS connection and subscribes
  // to one event. The hub will fan stream_chunk → mosaic_tile_update to them
  // for the duration of the connection. Sprint 8 turns the snapshot into a
  // real AI-summarized feed.
  async function handleSubscribe(conn: Connection, payload: unknown): Promise<void> {
    const parsed = subscribeSchema.safeParse(payload);
    if (!parsed.success) {
      conn.ws.send(JSON.stringify({ type: 'error', message: 'invalid mosaic_subscribe payload' }));
      return;
    }
    const event = await ctx.db.event.findUnique({
      where: { slug: parsed.data.eventSlug },
      include: {
        sessions: {
          where: { endedAt: null },
          select: { id: true, streamerWallet: true, teamLabel: true, startedAt: true },
        },
        helpSignals: { where: { closedAt: null } },
        teams: { select: { id: true, slug: true, name: true } },
      },
    });
    if (!event) {
      conn.ws.send(JSON.stringify({ type: 'error', message: 'event not found' }));
      return;
    }

    // Register on the gateway so broadcastTileUpdate's gateway.send hits.
    conn.type = 'member';
    ctx.gateway.register(conn);
    ctx.mosaic.subscribe(conn.id, event.id);
    logger.info(
      { connId: conn.id, eventId: event.id, slug: event.slug },
      'mosaic subscribed',
    );

    // Initial snapshot: every live session as one tile.
    const openHelpBySession = new Set(event.helpSignals.map((h) => h.sessionId));
    conn.ws.send(
      JSON.stringify({
        type: 'mosaic_snapshot',
        eventId: event.id,
        eventSlug: event.slug,
        title: event.title,
        teams: event.teams,
        tiles: event.sessions.map((s) => ({
          sessionId: s.id,
          teamLabel: s.teamLabel ?? s.id,
          streamerWallet: s.streamerWallet,
          lastActivity: s.startedAt.getTime(),
          helpOpen: openHelpBySession.has(s.id),
        })),
      }),
    );
  }

  async function handleUnsubscribe(conn: Connection): Promise<void> {
    ctx.mosaic.unsubscribe(conn.id);
    conn.ws.send(JSON.stringify({ type: 'mosaic_unsubscribed' }));
  }

  return { handleSubscribe, handleUnsubscribe };
}
