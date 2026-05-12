import { PublicKey } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import { HanClient } from './client.js';
import { EscrowError } from './errors.js';
import type { GameRoom, GameRoomStatus } from './types/game-room.js';

export interface TxResult {
  signature: string;
  slot?: number;
}

export interface CreateGameRoomParams {
  roomId: bigint;
  gameType: string; // max 32 chars, padded to [u8; 32]
  entryFee: bigint; // lamports
  maxPlayers: number;
}

function encodeGameType(s: string): number[] {
  const arr = new Uint8Array(32);
  const encoded = new TextEncoder().encode(s.slice(0, 32));
  arr.set(encoded);
  return Array.from(arr);
}

function roomIdToBN(roomId: bigint): BN {
  return new BN(roomId.toString());
}

export async function createGameRoom(
  client: HanClient,
  params: CreateGameRoomParams,
): Promise<TxResult> {
  try {
    const [roomPda] = client.findRoomPda(params.roomId);
    const [vaultPda] = client.findVaultPda(params.roomId);
    const [configPda] = client.findConfigPda();

    const sig = await client.program.methods
      .createGameRoom(
        roomIdToBN(params.roomId),
        encodeGameType(params.gameType),
        new BN(params.entryFee.toString()),
        params.maxPlayers,
      )
      .accountsStrict({
        room: roomPda,
        vault: vaultPda,
        config: configPda,
        host: client.wallet.publicKey,
        systemProgram: new PublicKey('11111111111111111111111111111111'),
      })
      .rpc();

    return { signature: sig };
  } catch (err) {
    throw new EscrowError('createGameRoom failed', err);
  }
}

export async function joinGame(
  client: HanClient,
  params: { roomId: bigint },
): Promise<TxResult> {
  try {
    const [roomPda] = client.findRoomPda(params.roomId);
    const [vaultPda] = client.findVaultPda(params.roomId);
    const [configPda] = client.findConfigPda();

    const sig = await client.program.methods
      .joinGame(roomIdToBN(params.roomId))
      .accountsStrict({
        room: roomPda,
        vault: vaultPda,
        config: configPda,
        player: client.wallet.publicKey,
        systemProgram: new PublicKey('11111111111111111111111111111111'),
      })
      .rpc();

    return { signature: sig };
  } catch (err) {
    throw new EscrowError('joinGame failed', err);
  }
}

export async function settleGame(
  client: HanClient,
  params: { roomId: bigint; winner: PublicKey },
): Promise<TxResult> {
  try {
    const [roomPda] = client.findRoomPda(params.roomId);
    const [vaultPda] = client.findVaultPda(params.roomId);
    const [configPda] = client.findConfigPda();

    const sig = await client.program.methods
      .settleGame(roomIdToBN(params.roomId), params.winner)
      .accountsStrict({
        room: roomPda,
        vault: vaultPda,
        config: configPda,
        winnerAccount: params.winner,
        authority: client.wallet.publicKey,
        systemProgram: new PublicKey('11111111111111111111111111111111'),
      })
      .rpc();

    return { signature: sig };
  } catch (err) {
    throw new EscrowError('settleGame failed', err);
  }
}

export async function cancelGame(
  client: HanClient,
  params: { roomId: bigint },
): Promise<TxResult> {
  try {
    const [roomPda] = client.findRoomPda(params.roomId);
    const [configPda] = client.findConfigPda();

    const sig = await client.program.methods
      .cancelGame(roomIdToBN(params.roomId))
      .accountsStrict({
        room: roomPda,
        config: configPda,
        host: client.wallet.publicKey,
      })
      .rpc();

    return { signature: sig };
  } catch (err) {
    throw new EscrowError('cancelGame failed', err);
  }
}

export async function claimRefund(
  client: HanClient,
  params: { roomId: bigint },
): Promise<TxResult> {
  try {
    const [roomPda] = client.findRoomPda(params.roomId);
    const [vaultPda] = client.findVaultPda(params.roomId);
    const [configPda] = client.findConfigPda();

    const sig = await client.program.methods
      .claimRefund(roomIdToBN(params.roomId))
      .accountsStrict({
        room: roomPda,
        vault: vaultPda,
        config: configPda,
        player: client.wallet.publicKey,
        systemProgram: new PublicKey('11111111111111111111111111111111'),
      })
      .rpc();

    return { signature: sig };
  } catch (err) {
    throw new EscrowError('claimRefund failed', err);
  }
}

export async function timeoutRefund(
  client: HanClient,
  params: { roomId: bigint },
): Promise<TxResult> {
  try {
    const [roomPda] = client.findRoomPda(params.roomId);
    const [vaultPda] = client.findVaultPda(params.roomId);
    const [configPda] = client.findConfigPda();

    const sig = await client.program.methods
      .timeoutRefund(roomIdToBN(params.roomId))
      .accountsStrict({
        room: roomPda,
        vault: vaultPda,
        config: configPda,
        player: client.wallet.publicKey,
        systemProgram: new PublicKey('11111111111111111111111111111111'),
      })
      .rpc();

    return { signature: sig };
  } catch (err) {
    throw new EscrowError('timeoutRefund failed', err);
  }
}

export async function getRoomState(
  client: HanClient,
  roomId: bigint,
): Promise<GameRoom | null> {
  try {
    const [roomPda] = client.findRoomPda(roomId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = await (client.program.account as any).gameRoom.fetchNullable(roomPda);
    if (!raw) return null;

    return {
      id: BigInt(raw.id.toString()),
      host: raw.host.toBase58(),
      gameType: Uint8Array.from(raw.gameType as number[]),
      entryFee: BigInt(raw.entryFee.toString()),
      maxPlayers: raw.maxPlayers as number,
      playerCount: raw.playerCount as number,
      players: (raw.players as PublicKey[]).map((p) => p.toBase58()),
      status: raw.status as GameRoomStatus,
      winner: raw.winner ? (raw.winner as PublicKey).toBase58() : null,
      createdAt: BigInt(raw.createdAt.toString()),
      refundClaimed: raw.refundClaimed as number,
      bump: raw.bump as number,
    };
  } catch (err) {
    throw new EscrowError('getRoomState failed', err);
  }
}
