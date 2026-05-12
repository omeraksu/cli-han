import type { LobbyState } from '../lobby/state.js';
import type { StreamCache } from '../stream/cache.js';
import type { StreamFanout } from '../stream/fanout.js';
import type { WsGateway } from './gateway.js';
import type { ChatBroker } from '../chat/broker.js';
import type { RoomRegistry } from '../rooms/registry.js';
import type { PrismaClient } from '@prisma/client';
import type { Redis } from 'ioredis';

export interface HubContext {
  /** @deprecated use `rooms` (Faz 1 onwards) — kept while stream code migrates. */
  lobby: LobbyState;
  rooms: RoomRegistry;
  cache: Map<string, StreamCache>;   // sessionId/roomId -> StreamCache
  fanout: Map<string, StreamFanout>; // sessionId/roomId -> StreamFanout
  gateway: WsGateway;
  chat: ChatBroker;
  db: PrismaClient;
  redis: Redis;
}
