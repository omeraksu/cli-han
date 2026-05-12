import { z } from 'zod';
import type { Connection } from '../gateway.js';
import type { HubContext } from '../context.js';
import { logger } from '../../logger.js';

const joinSchema = z.object({
  sessionId: z.string().min(1),
});

const switchModeSchema = z.object({
  mode: z.enum(['feed', 'raw']),
});

const chatSendSchema = z.object({
  content: z.string().min(1).max(500),
});

export function makeViewerHandlers(ctx: HubContext) {
  async function handleJoin(conn: Connection, payload: unknown): Promise<void> {
    const parsed = joinSchema.safeParse(payload);
    if (!parsed.success) {
      conn.ws.send(JSON.stringify({ type: 'error', message: 'invalid join payload' }));
      return;
    }
    const { sessionId } = parsed.data;

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
    ctx.gateway.register(conn);

    await ctx.lobby.incrementViewers(sessionId);

    // add to fanout
    const fanout = ctx.fanout.get(sessionId);
    if (fanout) fanout.addViewer(conn.id, conn.ws);

    logger.info({ connId: conn.id, sessionId }, 'viewer joined');

    // send lobby snapshot
    conn.ws.send(JSON.stringify({ type: 'joined', sessionId, session }));

    // replay recent cache
    const cache = ctx.cache.get(sessionId);
    if (cache) {
      const recent = cache.getRecent();
      if (recent.length > 0) {
        conn.ws.send(JSON.stringify({ type: 'cache_replay', events: recent }));
      }
    }

    // send recent chat history
    const history = await ctx.chat.getHistory(sessionId);
    if (history.length > 0) {
      conn.ws.send(JSON.stringify({ type: 'chat_history', messages: history }));
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

    const msg = await ctx.chat.publish(sessionId, conn.id, content);

    // broadcast to all viewers in session
    const viewers = ctx.gateway.getViewersForSession(sessionId);
    const msgPayload = JSON.stringify({ type: 'chat_message', message: msg });
    for (const viewer of viewers) {
      if (viewer.ws.readyState === 1) {
        viewer.ws.send(msgPayload);
      }
    }
  }

  return { handleJoin, handleSwitchMode, handleChatSend };
}
