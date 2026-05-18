import type { Redis } from 'ioredis';

export interface ChatMessage {
  id: string;
  /** Generic room identifier — for stream-rooms equals legacy sessionId. */
  roomId: string;
  connId: string;
  from: string;
  content: string;
  ts: number;
}

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 10_000;
const HISTORY_KEY_PREFIX = 'chat:history:';
const HISTORY_MAX = 100;

export class ChatBroker {
  private rateLimits: Map<string, RateLimitEntry> = new Map();

  constructor(private redis: Redis) {}

  checkRateLimit(connId: string): boolean {
    const now = Date.now();
    const entry = this.rateLimits.get(connId);

    if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
      this.rateLimits.set(connId, { count: 1, windowStart: now });
      return true;
    }

    if (entry.count >= RATE_LIMIT_MAX) {
      return false;
    }

    entry.count += 1;
    return true;
  }

  async publish(
    roomId: string,
    connId: string,
    from: string,
    content: string,
  ): Promise<ChatMessage> {
    const msg: ChatMessage = {
      id: crypto.randomUUID(),
      roomId,
      connId,
      from,
      content,
      ts: Date.now(),
    };

    const key = `${HISTORY_KEY_PREFIX}${roomId}`;
    await this.redis.rpush(key, JSON.stringify(msg));
    await this.redis.ltrim(key, -HISTORY_MAX, -1);
    await this.redis.expire(key, 3600);

    return msg;
  }

  async getHistory(roomId: string): Promise<ChatMessage[]> {
    const key = `${HISTORY_KEY_PREFIX}${roomId}`;
    const items = await this.redis.lrange(key, 0, -1);
    return items.map((item) => {
      const parsed = JSON.parse(item) as ChatMessage & { sessionId?: string };
      // Backward compat: old entries serialized `sessionId`.
      if (!parsed.roomId && parsed.sessionId) parsed.roomId = parsed.sessionId;
      return parsed;
    });
  }

  clearRateLimit(connId: string): void {
    this.rateLimits.delete(connId);
  }
}
