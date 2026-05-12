import { z } from 'zod';
import type { Connection } from '../gateway.js';
import type { HubContext } from '../context.js';
import { logger } from '../../logger.js';
import { upsertProfile } from '../../profiles/upsert.js';

const joinSchema = z
  .object({
    roomId: z.string().min(1).optional(),
    sessionId: z.string().min(1).optional(),
    walletAddress: z.string().min(8).max(64).optional(),
    handle: z.string().min(1).max(32).optional(),
  })
  .refine((data) => data.roomId || data.sessionId, {
    message: 'roomId or sessionId required',
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
    const { walletAddress, handle } = parsed.data;
    const roomId = parsed.data.roomId ?? parsed.data.sessionId!;

    const room = await ctx.rooms.get(roomId);
    if (!room) {
      conn.ws.send(JSON.stringify({ type: 'error', message: 'room not found' }));
      return;
    }

    // Stream-rooms keep the viewer type so existing streamer features
    // (viewer_count broadcast back to streamer, fanout) keep working.
    const isStreamRoom = room.kind === 'stream';
    conn.type = isStreamRoom ? 'viewer' : 'member';
    conn.roomId = roomId;
    conn.sessionId = roomId; // legacy alias
    conn.mode = isStreamRoom ? 'feed' : undefined;
    conn.walletAddress = walletAddress;
    conn.handle = handle;
    ctx.gateway.register(conn);

    // Upsert profile so the handle is reserved across reconnects.
    let resolvedHandle = handle;
    if (walletAddress && handle) {
      try {
        const result = await upsertProfile(ctx.db, walletAddress, handle);
        if (result.collision) {
          conn.ws.send(
            JSON.stringify({
              type: 'handle_collision',
              suggested: result.suggested,
            }),
          );
        }
        resolvedHandle = result.handle;
        conn.handle = resolvedHandle;
      } catch (err) {
        logger.warn({ err, walletAddress, handle }, 'profile upsert failed');
      }
    }

    await ctx.rooms.incrementMembers(roomId);

    if (isStreamRoom) {
      const fanout = ctx.fanout.get(roomId);
      if (fanout) fanout.addViewer(conn.id, conn.ws);
    }

    logger.info(
      { connId: conn.id, roomId, kind: room.kind },
      'member joined room',
    );

    // Broadcast member count: streamer (if any) + everyone in the room.
    const peers = ctx.gateway.getMembersForRoom(roomId);
    const streamers = ctx.gateway
      .getStreamers()
      .filter((c) => (c.roomId ?? c.sessionId) === roomId);
    const count = peers.length;
    const countMsg = JSON.stringify({ type: 'viewer_count', count });
    const memberCountMsg = JSON.stringify({ type: 'member_count', count });
    for (const c of [...peers, ...streamers]) {
      c.ws.send(countMsg); // legacy
      c.ws.send(memberCountMsg); // new
    }

    conn.ws.send(
      JSON.stringify({
        type: 'joined',
        roomId,
        room,
        // legacy alias for older clients
        sessionId: roomId,
        session: isStreamRoom ? room : undefined,
      }),
    );

    if (isStreamRoom) {
      const cache = ctx.cache.get(roomId);
      if (cache) {
        for (const event of cache.getRecent()) {
          if (event.type === 'stdout') {
            conn.ws.send(
              JSON.stringify({ type: 'raw_chunk', data: event.data, ts: event.ts }),
            );
          } else {
            conn.ws.send(JSON.stringify({ type: 'semantic_event', event }));
          }
        }
      }
    }

    const history = await ctx.chat.getHistory(roomId);
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
        }),
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

    const roomId = conn.roomId ?? conn.sessionId;
    if (roomId) {
      const fanout = ctx.fanout.get(roomId);
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

    const roomId = conn.roomId ?? conn.sessionId;
    if (!roomId) {
      conn.ws.send(JSON.stringify({ type: 'error', message: 'not joined to a room' }));
      return;
    }

    const allowed = ctx.chat.checkRateLimit(conn.id);
    if (!allowed) {
      conn.ws.send(JSON.stringify({ type: 'error', message: 'rate limit exceeded' }));
      return;
    }

    const from = displayName(conn);
    const msg = await ctx.chat.publish(roomId, conn.id, from, content);

    // broadcast to all members of the room (and the streamer if any).
    const members = ctx.gateway.getMembersForRoom(roomId);
    const streamers = ctx.gateway
      .getStreamers()
      .filter((c) => (c.roomId ?? c.sessionId) === roomId);
    const wireMsg = JSON.stringify({
      type: 'chat_msg',
      from: msg.from,
      content: msg.content,
      ts: msg.ts,
    });
    for (const c of [...members, ...streamers]) {
      if (c.ws.readyState === 1) {
        c.ws.send(wireMsg);
      }
    }
  }

  return { handleJoin, handleSwitchMode, handleChatSend };
}
