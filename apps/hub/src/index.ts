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
import { makeStreamerHandlers } from './ws/handlers/streamer.js';
import { makeViewerHandlers } from './ws/handlers/viewer.js';
import { sessionsRoutes } from './routes/sessions.js';
import { tipsRoutes } from './routes/tips.js';
import { configRoutes } from './routes/config.js';
import type { HubContext } from './ws/context.js';

// shared services
const redis = new Redis(config.REDIS_URL);
const db = new PrismaClient();

const lobby = new LobbyState(redis);
const gateway = new WsGateway();
const chat = new ChatBroker(redis);
const cacheMap = new Map<string, StreamCache>();
const fanoutMap = new Map<string, StreamFanout>();

const ctx: HubContext = {
  lobby,
  cache: cacheMap,
  fanout: fanoutMap,
  gateway,
  chat,
  db,
  redis,
};

// WS router
const wsRouter = new WsRouter();
const { handleRegisterStreamer, handleStreamChunk } = makeStreamerHandlers(ctx);
const { handleJoin, handleSwitchMode, handleChatSend } = makeViewerHandlers(ctx);

wsRouter.on('register_streamer', handleRegisterStreamer);
wsRouter.on('stream_chunk', handleStreamChunk);
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
    if (existing?.sessionId) {
      const sessionId = existing.sessionId;

      if (existing.type === 'streamer') {
        // The streamer left; tear the session down for everyone.
        lobby.removeSession(sessionId).catch((removeErr: unknown) => {
          logger.error({ err: removeErr, sessionId }, 'remove session failed');
        });
        cacheMap.delete(sessionId);
        const fan = fanoutMap.get(sessionId);
        if (fan) {
          for (const viewerId of fan.viewerIds()) {
            gateway.send(viewerId, { type: 'stream_end', sessionId });
          }
          fanoutMap.delete(sessionId);
        }
        db.session
          .update({ where: { id: sessionId }, data: { endedAt: new Date() } })
          .catch((dbErr: unknown) => {
            logger.error({ err: dbErr, sessionId }, 'mark session ended failed');
          });
        logger.info({ sessionId }, 'streamer disconnected, session closed');
      } else {
        lobby.decrementViewers(sessionId).catch((decErr: unknown) => {
          logger.error({ err: decErr }, 'decrement viewers failed');
        });
        const fan = fanoutMap.get(sessionId);
        if (fan) fan.removeViewer(connId);

        // broadcast new count to remaining viewers + streamer
        const peers = gateway.getViewersForSession(sessionId).filter((c) => c.id !== connId);
        const streamers = gateway.getStreamers().filter((c) => c.sessionId === sessionId);
        const count = peers.length;
        for (const c of [...peers, ...streamers]) {
          gateway.send(c.id, { type: 'viewer_count', count });
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
