import { z } from 'zod';
import type { Connection } from '../gateway.js';
import type { HubContext } from '../context.js';
import { StreamCache } from '../../stream/cache.js';
import { StreamFanout } from '../../stream/fanout.js';
import { logger } from '../../logger.js';

const registerStreamerSchema = z.object({
  sessionId: z.string().min(1),
  walletAddress: z.string().min(1),
});

const streamChunkSchema = z.object({
  data: z.string(),
  ts: z.number(),
});

export function makeStreamerHandlers(ctx: HubContext) {
  async function handleRegisterStreamer(conn: Connection, payload: unknown): Promise<void> {
    const parsed = registerStreamerSchema.safeParse(payload);
    if (!parsed.success) {
      conn.ws.send(JSON.stringify({ type: 'error', message: 'invalid register_streamer payload' }));
      return;
    }
    const { sessionId, walletAddress } = parsed.data;

    conn.type = 'streamer';
    conn.sessionId = sessionId;
    ctx.gateway.register(conn);

    // init cache + fanout for session if needed
    if (!ctx.cache.has(sessionId)) {
      ctx.cache.set(sessionId, new StreamCache());
    }
    if (!ctx.fanout.has(sessionId)) {
      ctx.fanout.set(sessionId, new StreamFanout());
    }

    // add to lobby
    await ctx.lobby.addSession({
      id: sessionId,
      streamerWallet: walletAddress,
      code: sessionId,
      viewerCount: 0,
      startedAt: Date.now(),
    });

    logger.info({ sessionId, walletAddress }, 'streamer registered');
    conn.ws.send(JSON.stringify({ type: 'registered', sessionId }));

    // notify existing viewers that session is live
    const viewers = ctx.gateway.getViewersForSession(sessionId);
    for (const viewer of viewers) {
      ctx.gateway.send(viewer.id, { type: 'session_live', sessionId });
    }
  }

  async function handleStreamChunk(conn: Connection, payload: unknown): Promise<void> {
    const parsed = streamChunkSchema.safeParse(payload);
    if (!parsed.success) {
      conn.ws.send(JSON.stringify({ type: 'error', message: 'invalid stream_chunk payload' }));
      return;
    }
    const { data, ts } = parsed.data;

    const sessionId = conn.sessionId;
    if (!sessionId) {
      conn.ws.send(JSON.stringify({ type: 'error', message: 'not registered' }));
      return;
    }

    const event = { v: 1, type: 'stdout' as const, ts, data };

    const cache = ctx.cache.get(sessionId);
    if (cache) cache.push(event);

    const fanout = ctx.fanout.get(sessionId);
    if (fanout) fanout.broadcast(event);
  }

  return { handleRegisterStreamer, handleStreamChunk };
}
