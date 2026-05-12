import type { LobbyState } from '../lobby/state.js';
import type { StreamCache } from '../stream/cache.js';
import type { StreamFanout } from '../stream/fanout.js';
import type { WsGateway } from './gateway.js';
import type { ChatBroker } from '../chat/broker.js';
import type { PrismaClient } from '@prisma/client';

export interface HubContext {
  lobby: LobbyState;
  cache: Map<string, StreamCache>;   // sessionId -> StreamCache
  fanout: Map<string, StreamFanout>; // sessionId -> StreamFanout
  gateway: WsGateway;
  chat: ChatBroker;
  db: PrismaClient;
}
