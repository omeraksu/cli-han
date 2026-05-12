import type { Redis } from 'ioredis';

export interface LobbySession {
  id: string;
  streamerWallet: string;
  code: string;
  viewerCount: number;
  startedAt: number;
  streamerName?: string;
  description?: string;
  tool?: string;
  tipSol?: number;
}

const KEY_PREFIX = 'lobby:session:';
const INDEX_KEY = 'lobby:index';
const TTL_SECONDS = 3600;
const LAMPORTS_PER_SOL = 1_000_000_000;

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

  async getSession(id: string): Promise<LobbySession | null> {
    const raw = await this.redis.get(`${KEY_PREFIX}${id}`);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as LobbySession;
    } catch {
      return null;
    }
  }

  async incrementViewers(id: string): Promise<void> {
    await this.updateSession(id, (s) => {
      s.viewerCount += 1;
      return s;
    });
  }

  async decrementViewers(id: string): Promise<void> {
    await this.updateSession(id, (s) => {
      s.viewerCount = Math.max(0, s.viewerCount - 1);
      return s;
    });
  }

  /**
   * Adds a tip in lamports and updates the session's running total in SOL.
   * Returns the new SOL total, or null if the session was not found.
   */
  async addTipLamports(id: string, lamports: number): Promise<number | null> {
    let newTotal: number | null = null;
    await this.updateSession(id, (s) => {
      const current = s.tipSol ?? 0;
      newTotal = current + lamports / LAMPORTS_PER_SOL;
      s.tipSol = newTotal;
      return s;
    });
    return newTotal;
  }

  private async updateSession(
    id: string,
    mutator: (session: LobbySession) => LobbySession
  ): Promise<void> {
    const key = `${KEY_PREFIX}${id}`;
    const raw = await this.redis.get(key);
    if (!raw) return;
    let session: LobbySession;
    try {
      session = JSON.parse(raw) as LobbySession;
    } catch {
      return;
    }
    const next = mutator(session);
    await this.redis.set(key, JSON.stringify(next), 'EX', TTL_SECONDS);
  }
}
