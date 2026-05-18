import type { Address } from 'viem';

export interface GameRoom {
  id: bigint;
  host: Address;
  gameType: `0x${string}`;
  entryFee: bigint;
  maxPlayers: number;
  playerCount: number;
  players: Address[];
  status: GameRoomStatus;
  winner: Address | null;
  createdAt: bigint;
  refundClaimedBitmap: number;
}

export const GameRoomStatus = {
  Filling: 1,
  Ready: 2,
  Finished: 4,
  Settled: 5,
  Cancelled: 6,
  TimedOut: 7,
} as const;

export type GameRoomStatus = (typeof GameRoomStatus)[keyof typeof GameRoomStatus];
