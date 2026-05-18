import { stringToHex, type Address, type Hex } from 'viem';

import { HanClient } from './client.js';
import { EscrowError } from './errors.js';
import { hanAbi } from './abi.js';
import { type GameRoom, type GameRoomStatus } from './types/game-room.js';

export interface TxResult {
  hash: Hex;
}

export interface CreateGameRoomParams {
  roomId: bigint;
  gameType: string;
  entryFee: bigint;
  maxPlayers: number;
}

function encodeGameType(s: string): `0x${string}` {
  return stringToHex(s.slice(0, 32), { size: 32 });
}

function requireWallet(client: HanClient): NonNullable<HanClient['walletClient']> {
  if (!client.walletClient) throw new EscrowError('HanClient is read-only (no walletClient)');
  return client.walletClient;
}

export async function createGameRoom(
  client: HanClient,
  params: CreateGameRoomParams,
): Promise<TxResult> {
  const wallet = requireWallet(client);
  try {
    const hash = await wallet.writeContract({
      address: client.han.address,
      abi: hanAbi,
      functionName: 'createGameRoom',
      args: [params.roomId, encodeGameType(params.gameType), params.entryFee, params.maxPlayers],
      value: params.entryFee,
      account: wallet.account!,
      chain: wallet.chain,
    });
    await client.publicClient.waitForTransactionReceipt({ hash });
    return { hash };
  } catch (err) {
    throw new EscrowError('createGameRoom failed', err);
  }
}

export async function joinGame(
  client: HanClient,
  params: { roomId: bigint; entryFee: bigint },
): Promise<TxResult> {
  const wallet = requireWallet(client);
  try {
    const hash = await wallet.writeContract({
      address: client.han.address,
      abi: hanAbi,
      functionName: 'joinGame',
      args: [params.roomId],
      value: params.entryFee,
      account: wallet.account!,
      chain: wallet.chain,
    });
    await client.publicClient.waitForTransactionReceipt({ hash });
    return { hash };
  } catch (err) {
    throw new EscrowError('joinGame failed', err);
  }
}

export async function settleGame(
  client: HanClient,
  params: { roomId: bigint; winner: Address },
): Promise<TxResult> {
  const wallet = requireWallet(client);
  try {
    const hash = await wallet.writeContract({
      address: client.han.address,
      abi: hanAbi,
      functionName: 'settleGame',
      args: [params.roomId, params.winner],
      account: wallet.account!,
      chain: wallet.chain,
    });
    await client.publicClient.waitForTransactionReceipt({ hash });
    return { hash };
  } catch (err) {
    throw new EscrowError('settleGame failed', err);
  }
}

export async function cancelGame(
  client: HanClient,
  params: { roomId: bigint },
): Promise<TxResult> {
  const wallet = requireWallet(client);
  try {
    const hash = await wallet.writeContract({
      address: client.han.address,
      abi: hanAbi,
      functionName: 'cancelGame',
      args: [params.roomId],
      account: wallet.account!,
      chain: wallet.chain,
    });
    await client.publicClient.waitForTransactionReceipt({ hash });
    return { hash };
  } catch (err) {
    throw new EscrowError('cancelGame failed', err);
  }
}

export async function claimRefund(
  client: HanClient,
  params: { roomId: bigint },
): Promise<TxResult> {
  const wallet = requireWallet(client);
  try {
    const hash = await wallet.writeContract({
      address: client.han.address,
      abi: hanAbi,
      functionName: 'claimRefund',
      args: [params.roomId],
      account: wallet.account!,
      chain: wallet.chain,
    });
    await client.publicClient.waitForTransactionReceipt({ hash });
    return { hash };
  } catch (err) {
    throw new EscrowError('claimRefund failed', err);
  }
}

export async function timeoutRefund(
  client: HanClient,
  params: { roomId: bigint },
): Promise<TxResult> {
  const wallet = requireWallet(client);
  try {
    const hash = await wallet.writeContract({
      address: client.han.address,
      abi: hanAbi,
      functionName: 'timeoutRefund',
      args: [params.roomId],
      account: wallet.account!,
      chain: wallet.chain,
    });
    await client.publicClient.waitForTransactionReceipt({ hash });
    return { hash };
  } catch (err) {
    throw new EscrowError('timeoutRefund failed', err);
  }
}

export async function getRoomState(
  client: HanClient,
  roomId: bigint,
): Promise<GameRoom | null> {
  try {
    const result = (await client.publicClient.readContract({
      address: client.han.address,
      abi: hanAbi,
      functionName: 'getRoom',
      args: [roomId],
    })) as readonly [
      Address,
      `0x${string}`,
      bigint,
      number,
      number,
      number,
      number,
      bigint,
      Address,
    ];
    const [host, gameType, entryFee, maxPlayers, playerCount, status, refundBitmap, createdAt, winner] =
      result;

    if (host === '0x0000000000000000000000000000000000000000' && playerCount === 0) {
      return null;
    }

    const players = (await client.publicClient.readContract({
      address: client.han.address,
      abi: hanAbi,
      functionName: 'getPlayers',
      args: [roomId],
    })) as Address[];

    return {
      id: roomId,
      host,
      gameType,
      entryFee,
      maxPlayers,
      playerCount,
      players,
      status: status as GameRoomStatus,
      winner: winner === '0x0000000000000000000000000000000000000000' ? null : winner,
      createdAt,
      refundClaimedBitmap: refundBitmap,
    };
  } catch (err) {
    throw new EscrowError('getRoomState failed', err);
  }
}
