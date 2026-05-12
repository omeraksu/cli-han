export interface GameRoom {
  id: bigint;
  host: string; // base58
  gameType: Uint8Array; // [u8; 32]
  entryFee: bigint;
  maxPlayers: number;
  playerCount: number;
  players: string[]; // base58[]
  status: GameRoomStatus;
  winner: string | null;
  createdAt: bigint;
  refundClaimed: number; // bitmap
  bump: number;
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
