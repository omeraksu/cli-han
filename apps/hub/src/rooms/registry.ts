import type { Redis } from 'ioredis';
import { randomBytes } from 'node:crypto';
import type { Room, RoomKind, StreamRoom, AdhocRoom } from './types.js';

const KEY_META_PREFIX = 'room:meta:';
const KEY_INDEX = 'room:index';
const KEY_HEARTBEAT_PREFIX = 'room:heartbeat:';

// channel rooms never expire; adhoc rooms get 24h, stream rooms 1h fallback
// (the actual stream-room TTL is driven by the heartbeat key in Faz 3).
const TTL_CHANNEL = 0;
const TTL_ADHOC_SECONDS = 86_400;
const TTL_STREAM_SECONDS = 3600;

const LAMPORTS_PER_SOL = 1_000_000_000;

function metaKey(roomId: string): string {
  return `${KEY_META_PREFIX}${roomId}`;
}

function heartbeatKey(roomId: string): string {
  return `${KEY_HEARTBEAT_PREFIX}${roomId}`;
}

function score(room: Room): number {
  // stream-rooms float to the top; the rest sort by createdAt
  if (room.kind === 'stream') return 1e15 + room.createdAt;
  return room.createdAt;
}

function ttlFor(kind: RoomKind): number {
  if (kind === 'channel') return TTL_CHANNEL;
  if (kind === 'adhoc') return TTL_ADHOC_SECONDS;
  return TTL_STREAM_SECONDS;
}

export interface CreateStreamRoomInput {
  id: string;
  streamerWallet: string;
  streamerName?: string;
  tool?: string;
  title?: string;
  description?: string;
}

export interface CreateAdhocRoomInput {
  title: string;
  description?: string;
  ownerWallet?: string;
}

export interface SeedChannelInput {
  id: string;
  slug: string;
  title: string;
  description?: string;
}

export class RoomRegistry {
  constructor(private redis: Redis) {}

  async seedChannel(input: SeedChannelInput): Promise<void> {
    const existing = await this.get(input.id);
    if (existing) return; // idempotent: don't overwrite a live channel
    const room: Room = {
      kind: 'channel',
      id: input.id,
      slug: input.slug,
      title: input.title,
      description: input.description,
      createdAt: Date.now(),
      memberCount: 0,
    };
    await this.write(room);
  }

  async createStreamRoom(input: CreateStreamRoomInput): Promise<StreamRoom> {
    const now = Date.now();
    const room: StreamRoom = {
      kind: 'stream',
      id: input.id,
      slug: `stream-${input.id}`,
      title: input.title ?? `${input.streamerName ?? input.streamerWallet.slice(0, 4)}'s stream`,
      description: input.description,
      streamerWallet: input.streamerWallet,
      streamerName: input.streamerName,
      tool: input.tool,
      code: input.id,
      createdAt: now,
      startedAt: now,
      memberCount: 0,
      tipSol: 0,
    };
    await this.write(room);
    return room;
  }

  async createAdhocRoom(input: CreateAdhocRoomInput): Promise<AdhocRoom> {
    const id = `adhoc-${randomBytes(4).toString('hex')}`;
    const slug = input.title
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || id;
    const room: AdhocRoom = {
      kind: 'adhoc',
      id,
      slug: `${slug}-${randomBytes(2).toString('hex')}`,
      title: input.title.slice(0, 128),
      description: input.description,
      ownerWallet: input.ownerWallet,
      createdAt: Date.now(),
      memberCount: 0,
      expiresAt: Date.now() + TTL_ADHOC_SECONDS * 1000,
    };
    await this.write(room);
    return room;
  }

  async get(id: string): Promise<Room | null> {
    const raw = await this.redis.get(metaKey(id));
    if (!raw) return null;
    try {
      return JSON.parse(raw) as Room;
    } catch {
      return null;
    }
  }

  async list(filter?: { kind?: RoomKind }): Promise<Room[]> {
    // High → low score; stream-rooms first, then channels and adhoc by recency.
    const ids = await this.redis.zrevrange(KEY_INDEX, 0, -1);
    if (ids.length === 0) return [];
    const pipeline = this.redis.pipeline();
    for (const id of ids) pipeline.get(metaKey(id));
    const results = await pipeline.exec();
    if (!results) return [];
    const rooms: Room[] = [];
    for (const [err, val] of results) {
      if (err || !val) continue;
      try {
        const room = JSON.parse(val as string) as Room;
        if (filter?.kind && room.kind !== filter.kind) continue;
        rooms.push(room);
      } catch {
        // skip corrupt
      }
    }
    return rooms;
  }

  async closeRoom(id: string): Promise<void> {
    await this.redis.del(metaKey(id));
    await this.redis.del(heartbeatKey(id));
    await this.redis.zrem(KEY_INDEX, id);
  }

  async update(
    id: string,
    mutator: (room: Room) => Room,
  ): Promise<Room | null> {
    const room = await this.get(id);
    if (!room) return null;
    const next = mutator(room);
    await this.write(next);
    return next;
  }

  async incrementMembers(id: string): Promise<void> {
    await this.update(id, (r) => ({ ...r, memberCount: r.memberCount + 1 }));
  }

  async decrementMembers(id: string): Promise<void> {
    await this.update(id, (r) => ({
      ...r,
      memberCount: Math.max(0, r.memberCount - 1),
    }));
  }

  async addTipLamports(id: string, lamports: number): Promise<number | null> {
    const updated = await this.update(id, (r) => {
      if (r.kind !== 'stream') return r;
      const current = r.tipSol ?? 0;
      return { ...r, tipSol: current + lamports / LAMPORTS_PER_SOL };
    });
    if (!updated || updated.kind !== 'stream') return null;
    return updated.tipSol ?? null;
  }

  /** Used by Faz 3 stream-lifecycle to detect orphaned stream-rooms. */
  async refreshStreamHeartbeat(id: string, ttlSeconds = 60): Promise<void> {
    await this.redis.set(heartbeatKey(id), '1', 'EX', ttlSeconds);
  }

  async hasStreamHeartbeat(id: string): Promise<boolean> {
    return (await this.redis.exists(heartbeatKey(id))) === 1;
  }

  private async write(room: Room): Promise<void> {
    const ttl = ttlFor(room.kind);
    const key = metaKey(room.id);
    if (ttl > 0) {
      await this.redis.set(key, JSON.stringify(room), 'EX', ttl);
    } else {
      await this.redis.set(key, JSON.stringify(room));
    }
    await this.redis.zadd(KEY_INDEX, score(room), room.id);
  }
}
