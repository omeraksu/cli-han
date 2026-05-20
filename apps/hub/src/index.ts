import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { randomUUID } from 'node:crypto';
import { config } from './config.js';
import { logger } from './logger.js';
import { LobbyState } from './lobby/state.js';
import { StreamCache } from './stream/cache.js';
import { StreamFanout } from './stream/fanout.js';
import { WsGateway } from './ws/gateway.js';
import { WsRouter } from './ws/router.js';
import { ChatBroker } from './chat/broker.js';
import { RoomRegistry } from './rooms/registry.js';
import { seedChannels } from './rooms/seed.js';
import { makeStreamerHandlers } from './ws/handlers/streamer.js';
import { makeViewerHandlers } from './ws/handlers/viewer.js';
import { sessionsRoutes } from './routes/sessions.js';
import { tipsRoutes } from './routes/tips.js';
import { configRoutes } from './routes/config.js';
import { roomsRoutes } from './routes/rooms.js';
import { corpusRoutes } from './routes/corpus.js';
import type { HubContext } from './ws/context.js';

// shared services
const redis = new Redis(config.REDIS_URL);
const db = new PrismaClient();

const lobby = new LobbyState(redis);
const rooms = new RoomRegistry(redis);
const gateway = new WsGateway();
const chat = new ChatBroker(redis);
const cacheMap = new Map<string, StreamCache>();
const fanoutMap = new Map<string, StreamFanout>();

const ctx: HubContext = {
  lobby,
  rooms,
  cache: cacheMap,
  fanout: fanoutMap,
  gateway,
  chat,
  db,
  redis,
};

// Seed persistent channels on boot. Idempotent — won't overwrite live state.
await seedChannels(rooms);

// WS router
const wsRouter = new WsRouter();
const { handleRegisterStreamer, handleStreamChunk, handleStreamEnd } = makeStreamerHandlers(ctx);
const { handleJoin, handleSwitchMode, handleChatSend } = makeViewerHandlers(ctx);

wsRouter.on('register_streamer', handleRegisterStreamer);
wsRouter.on('stream_chunk', handleStreamChunk);
wsRouter.on('stream_end', handleStreamEnd);
wsRouter.on('join', handleJoin);
wsRouter.on('switch_mode', handleSwitchMode);
wsRouter.on('chat_send', handleChatSend);

// Fastify
const app = Fastify({ logger: false });

await app.register(websocket);

// health
app.get('/health', async () => ({ ok: true, ts: Date.now() }));

// REST routes
await app.register(async (instance) => {
  await sessionsRoutes(instance, ctx);
  await tipsRoutes(instance, ctx);
  await configRoutes(instance);
  await roomsRoutes(instance, ctx);
  await corpusRoutes(instance, ctx);
});

// WebSocket endpoint
app.get('/ws', { websocket: true }, (socket, _req) => {
  const connId = randomUUID();
  const conn = {
    id: connId,
    ws: socket,
    type: 'viewer' as const,
  };
  gateway.register(conn);
  logger.debug({ connId }, 'ws connected');

  socket.on('message', (raw: Buffer | string) => {
    const msg = raw.toString();
    wsRouter.route(conn, msg).catch((routeErr: unknown) => {
      logger.error({ connId, err: routeErr }, 'ws route error');
    });
  });

  socket.on('close', () => {
    const existing = gateway.get(connId);
    const roomId = existing?.roomId ?? existing?.sessionId;
    if (existing && roomId) {
      if (existing.type === 'streamer') {
        // The streamer left; tear the (stream) room down for everyone.
        lobby.removeSession(roomId).catch((removeErr: unknown) => {
          logger.error({ err: removeErr, sessionId: roomId }, 'remove session failed');
        });
        rooms.closeRoom(roomId).catch((closeErr: unknown) => {
          logger.error({ err: closeErr, roomId }, 'close room failed');
        });
        // Cache retained for corpus analyzer — TTL inside StreamCache will
        // evict stale events on its own (5 min maxAge). Sprint 8 will move
        // this to persistent storage (S3/R2) and drop the in-memory hold.
        const fan = fanoutMap.get(roomId);
        if (fan) {
          for (const viewerId of fan.viewerIds()) {
            gateway.send(viewerId, { type: 'stream_end', sessionId: roomId });
            gateway.send(viewerId, { type: 'room_closed', roomId, reason: 'stream_end' });
          }
          fanoutMap.delete(roomId);
        }
        db.session
          .update({ where: { id: roomId }, data: { endedAt: new Date() } })
          .catch((dbErr: unknown) => {
            logger.error({ err: dbErr, sessionId: roomId }, 'mark session ended failed');
          });
        logger.info({ roomId }, 'streamer disconnected, stream-room closed');
      } else {
        // Regular member (viewer or chat-only) leaving.
        rooms.decrementMembers(roomId).catch((decErr: unknown) => {
          logger.error({ err: decErr, roomId }, 'decrement members failed');
        });
        // Legacy lobby counter, only matters for stream-rooms.
        if (existing.type === 'viewer') {
          lobby.decrementViewers(roomId).catch((decErr: unknown) => {
            logger.error({ err: decErr }, 'decrement viewers failed');
          });
        }
        const fan = fanoutMap.get(roomId);
        if (fan) fan.removeViewer(connId);

        // broadcast new member count to remaining peers + streamer (if any).
        const peers = gateway.getMembersForRoom(roomId).filter((c) => c.id !== connId);
        const streamers = gateway
          .getStreamers()
          .filter((c) => (c.roomId ?? c.sessionId) === roomId);
        const count = peers.length;
        for (const c of [...peers, ...streamers]) {
          gateway.send(c.id, { type: 'viewer_count', count });
          gateway.send(c.id, { type: 'member_count', count });
        }
      }
    }
    gateway.unregister(connId);
    chat.clearRateLimit(connId);
    logger.debug({ connId }, 'ws disconnected');
  });

  socket.on('error', (wsErr: Error) => {
    logger.error({ connId, err: wsErr }, 'ws error');
  });
});

// global error handler
app.setErrorHandler((err: { statusCode?: number; message: string }, _request, reply) => {
  logger.error({ err }, 'fastify error');
  void reply.status(err.statusCode ?? 500).send({ error: err.message });
});

// start
await app.listen({ port: config.PORT, host: '0.0.0.0' });
logger.info(`Hub listening on port ${config.PORT}`);
