import { z } from 'zod';
import type { Connection } from '../gateway.js';
import type { HubContext } from '../context.js';
import { logger } from '../../logger.js';

const joinSchema = z.object({
  sessionId: z.string().min(1),
  walletAddress: z.string().min(8).max(64).optional(),
  handle: z.string().min(1).max(32).optional(),
});

const switchModeSchema = z.object({
  mode: z.enum(['feed', 'raw']),
});

const chatSendSchema = z.object({
  content: z.string().min(1).max(500),
});

function displayName(conn: { handle?: string; walletAddress?: string; id: string }): string {
  if (conn.handle) return conn.handle;
  if (conn.walletAddress) return conn.walletAddress.slice(0, 4).toLowerCase();
  return `anon-${conn.id.slice(0, 4)}`;
}

export function makeViewerHandlers(ctx: HubContext) {
  async function handleJoin(conn: Connection, payload: unknown): Promise<void> {
    const parsed = joinSchema.safeParse(payload);
    if (!parsed.success) {
      conn.ws.send(JSON.stringify({ type: 'error', message: 'invalid join payload' }));
      return;
    }
    const { sessionId, walletAddress, handle } = parsed.data;

    // check session exists in lobby
    const snapshot = await ctx.lobby.getSnapshot();
    const session = snapshot.find((s) => s.id === sessionId);
    if (!session) {
      conn.ws.send(JSON.stringify({ type: 'error', message: 'session not found' }));
      return;
    }

    conn.type = 'viewer';
    conn.sessionId = sessionId;
    conn.mode = 'feed';
    conn.walletAddress = walletAddress;
    conn.handle = handle;
    ctx.gateway.register(conn);

    await ctx.lobby.incrementViewers(sessionId);

    // add to fanout
    const fanout = ctx.fanout.get(sessionId);
    if (fanout) fanout.addViewer(conn.id, conn.ws);

    logger.info({ connId: conn.id, sessionId }, 'viewer joined');

    // broadcast new viewer count to streamer + viewers
    const peers = ctx.gateway.getViewersForSession(sessionId);
    const streamers = ctx.gateway.getStreamers().filter((c) => c.sessionId === sessionId);
    const count = peers.length;
    for (const c of [...peers, ...streamers]) {
      ctx.gateway.send(c.id, { type: 'viewer_count', count });
    }

    // send lobby snapshot
    conn.ws.send(JSON.stringify({ type: 'joined', sessionId, session }));

    // replay recent cache one raw_chunk at a time so the viewer's
    // useStream hook can ingest it without a special handler
    const cache = ctx.cache.get(sessionId);
    if (cache) {
      for (const event of cache.getRecent()) {
        conn.ws.send(JSON.stringify({ type: 'raw_chunk', data: event.data, ts: event.ts }));
      }
    }

    // send recent chat history
    const history = await ctx.chat.getHistory(sessionId);
    if (history.length > 0) {
      conn.ws.send(
        JSON.stringify({
          type: 'chat_history',
          messages: history.map((m) => ({
            id: m.id,
            from: m.from,
            content: m.content,
            ts: m.ts,
          })),
        })
      );
    }
  }

  async function handleSwitchMode(conn: Connection, payload: unknown): Promise<void> {
    const parsed = switchModeSchema.safeParse(payload);
    if (!parsed.success) {
      conn.ws.send(JSON.stringify({ type: 'error', message: 'invalid switch_mode payload' }));
      return;
    }
    const { mode } = parsed.data;

    conn.mode = mode;

    const sessionId = conn.sessionId;
    if (sessionId) {
      const fanout = ctx.fanout.get(sessionId);
      if (fanout) fanout.setMode(conn.id, mode);
    }

    conn.ws.send(JSON.stringify({ type: 'mode_switched', mode }));
  }

  async function handleChatSend(conn: Connection, payload: unknown): Promise<void> {
    const parsed = chatSendSchema.safeParse(payload);
    if (!parsed.success) {
      conn.ws.send(JSON.stringify({ type: 'error', message: 'invalid chat_send payload' }));
      return;
    }
    const { content } = parsed.data;

    const sessionId = conn.sessionId;
    if (!sessionId) {
      conn.ws.send(JSON.stringify({ type: 'error', message: 'not joined to a session' }));
      return;
    }

    const allowed = ctx.chat.checkRateLimit(conn.id);
    if (!allowed) {
      conn.ws.send(JSON.stringify({ type: 'error', message: 'rate limit exceeded' }));
      return;
    }

    const from = displayName(conn);
    const msg = await ctx.chat.publish(sessionId, conn.id, from, content);

    // broadcast in the runtime's chat_msg wire format (from / content / ts)
    const viewers = ctx.gateway.getViewersForSession(sessionId);
    const wireMsg = JSON.stringify({
      type: 'chat_msg',
      from: msg.from,
      content: msg.content,
      ts: msg.ts,
    });
    for (const viewer of viewers) {
      if (viewer.ws.readyState === 1) {
        viewer.ws.send(wireMsg);
      }
    }
  }

  return { handleJoin, handleSwitchMode, handleChatSend };
}
