import type { Redis } from 'ioredis';

export interface LobbySession {
  id: string;
  streamerWallet: string;
  code: string;
  viewerCount: number;
  startedAt: number;
}

const KEY_PREFIX = 'lobby:session:';
const INDEX_KEY = 'lobby:index';
const TTL_SECONDS = 3600;

export class LobbyState {
  constructor(private redis: Redis) {}

  async addSession(session: LobbySession): Promise<void> {
    const key = `${KEY_PREFIX}${session.id}`;
    await this.redis.set(key, JSON.stringify(session), 'EX', TTL_SECONDS);
    await this.redis.zadd(INDEX_KEY, session.startedAt, session.id);
  }

  async removeSession(id: string): Promise<void> {
    await this.redis.del(`${KEY_PREFIX}${id}`);
    await this.redis.zrem(INDEX_KEY, id);
  }

  async getSnapshot(): Promise<LobbySession[]> {
    const ids = await this.redis.zrange(INDEX_KEY, 0, -1);
    if (ids.length === 0) return [];

    const pipeline = this.redis.pipeline();
    for (const id of ids) {
      pipeline.get(`${KEY_PREFIX}${id}`);
    }
    const results = await pipeline.exec();
    if (!results) return [];

    const sessions: LobbySession[] = [];
    for (const [err, val] of results) {
      if (err || !val) continue;
      try {
        sessions.push(JSON.parse(val as string) as LobbySession);
      } catch {
        // corrupted entry, skip
      }
    }
    return sessions;
  }

  async incrementViewers(id: string): Promise<void> {
    const key = `${KEY_PREFIX}${id}`;
    const raw = await this.redis.get(key);
    if (!raw) return;
    const session = JSON.parse(raw) as LobbySession;
    session.viewerCount += 1;
    await this.redis.set(key, JSON.stringify(session), 'EX', TTL_SECONDS);
  }

  async decrementViewers(id: string): Promise<void> {
    const key = `${KEY_PREFIX}${id}`;
    const raw = await this.redis.get(key);
    if (!raw) return;
    const session = JSON.parse(raw) as LobbySession;
    session.viewerCount = Math.max(0, session.viewerCount - 1);
    await this.redis.set(key, JSON.stringify(session), 'EX', TTL_SECONDS);
  }
}
