// The universal social unit in Han. Both chat-only and stream-rooms are
// Rooms; the only thing that differs is `kind` and which sub-features
// (PTY fanout, game queue) the room participates in.
//
// kind = 'channel': seeded persistent kanal (han-lobby, türkçe, …)
// kind = 'adhoc':   kullanıcı yarattığı geçici oda; idle TTL ile kapanır
// kind = 'stream':  bir yayının kendi odası; id == legacy sessionId

export type RoomKind = 'channel' | 'adhoc' | 'stream';

interface RoomBase {
  id: string;
  slug: string;
  title: string;
  createdAt: number;
  memberCount: number;
  /** ISO topic / one-line description shown in the rooms list. */
  description?: string;
  ownerWallet?: string;
}

export interface ChannelRoom extends RoomBase {
  kind: 'channel';
}

export interface AdhocRoom extends RoomBase {
  kind: 'adhoc';
  /** ms since epoch; the room is GC'd after this point if empty. */
  expiresAt?: number;
}

export interface StreamRoom extends RoomBase {
  kind: 'stream';
  streamerWallet: string;
  streamerName?: string;
  tool?: string;
  tipSol?: number;
  /** Legacy field — equals `id`, kept for backward-compatible clients. */
  code: string;
  startedAt: number;
}

export type Room = ChannelRoom | AdhocRoom | StreamRoom;

export function isStreamRoom(room: Room): room is StreamRoom {
  return room.kind === 'stream';
}

export function isAdhocRoom(room: Room): room is AdhocRoom {
  return room.kind === 'adhoc';
}

export function isChannelRoom(room: Room): room is ChannelRoom {
  return room.kind === 'channel';
}
