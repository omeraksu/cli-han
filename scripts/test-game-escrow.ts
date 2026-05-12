#!/usr/bin/env node
// Devnet game escrow flow: create -> join -> settle
// Two wallets required. If only one keypair is available, two ephemeral keypairs
// are generated and funded via airdrop.

import 'dotenv/config';
import { Connection, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { loadLocalKeypair } from '../sdk/src/wallet/local-keypair.js';
import { HanClient } from '../sdk/src/client.js';
import {
  createGameRoom,
  joinGame,
  settleGame,
  getRoomState,
} from '../sdk/src/escrow.js';

async function airdrop(conn: Connection, kp: Keypair, sol: number): Promise<void> {
  const sig = await conn.requestAirdrop(kp.publicKey, sol * LAMPORTS_PER_SOL);
  await conn.confirmTransaction(sig, 'confirmed');
  console.log(`Airdropped ${sol} SOL to ${kp.publicKey.toBase58()}`);
}

async function main(): Promise<void> {
  const rpcUrl = process.env['SOLANA_RPC_URL'] ?? 'https://api.devnet.solana.com';
  const conn = new Connection(rpcUrl, 'confirmed');

  // Use local keypair as host, generate a fresh player keypair
  let host: Keypair;
  try {
    host = loadLocalKeypair();
  } catch {
    host = Keypair.generate();
    await airdrop(conn, host, 1);
  }

  const player = Keypair.generate();
  await airdrop(conn, player, 1);

  const roomId = BigInt(Date.now()); // unique room ID from timestamp
  const entryFee = BigInt(10_000); // 0.00001 SOL

  console.log('\n--- create_game_room ---');
  const hostClient = new HanClient({ connection: conn, wallet: host });
  const createResult = await createGameRoom(hostClient, {
    roomId,
    gameType: 'pong',
    entryFee,
    maxPlayers: 2,
  });
  console.log('create TX:', createResult.signature);

  let room = await getRoomState(hostClient, roomId);
  console.log('Room status after create:', room?.status); // should be 1 (Filling)

  console.log('\n--- join_game ---');
  const playerClient = new HanClient({ connection: conn, wallet: player });
  const joinResult = await joinGame(playerClient, { roomId });
  console.log('join TX:', joinResult.signature);

  room = await getRoomState(hostClient, roomId);
  console.log('Room status after join:', room?.status); // should be 2 (Ready)

  console.log('\n--- settle_game ---');
  // Only config authority can settle. Hub authority keypair needed.
  // Using host as authority here only works if host === config authority.
  const settleResult = await settleGame(hostClient, {
    roomId,
    winner: player.publicKey,
  });
  console.log('settle TX:', settleResult.signature);

  room = await getRoomState(hostClient, roomId);
  console.log('Room status after settle:', room?.status); // should be 5 (Settled)
  console.log('Winner:', room?.winner);
}

main().catch(console.error);
