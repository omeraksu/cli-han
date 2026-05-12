import { z } from 'zod';
import type { Connection } from '../gateway.js';
import type { HubContext } from '../context.js';
import { StreamCache } from '../../stream/cache.js';
import { StreamFanout } from '../../stream/fanout.js';
import { logger } from '../../logger.js';

const registerStreamerSchema = z.object({
  sessionId: z.string().min(1),
  walletAddress: z.string().min(1),
  streamerName: z.string().min(1).max(32).optional(),
  description: z.string().min(1).max(120).optional(),
  tool: z.string().min(1).max(32).optional(),
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
    const { sessionId, walletAddress, streamerName, description, tool } = parsed.data;

    conn.type = 'streamer';
    conn.sessionId = sessionId;
    ctx.gateway.register(conn);

    if (!ctx.cache.has(sessionId)) {
      ctx.cache.set(sessionId, new StreamCache());
    }
    if (!ctx.fanout.has(sessionId)) {
      ctx.fanout.set(sessionId, new StreamFanout());
    }

    // POST /sessions may have already added the session; if so, keep its
    // metadata and only patch in any fresher fields from the WS payload.
    const existing = await ctx.lobby.getSession(sessionId);
    await ctx.lobby.addSession({
      id: sessionId,
      streamerWallet: walletAddress,
      code: existing?.code ?? sessionId,
      viewerCount: existing?.viewerCount ?? 0,
      startedAt: existing?.startedAt ?? Date.now(),
      streamerName: streamerName ?? existing?.streamerName,
      description: description ?? existing?.description,
      tool: tool ?? existing?.tool,
      tipSol: existing?.tipSol ?? 0,
    });

    logger.info({ sessionId, walletAddress, tool }, 'streamer registered');
    conn.ws.send(JSON.stringify({ type: 'registered', sessionId, code: sessionId }));

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
