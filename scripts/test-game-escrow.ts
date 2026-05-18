#!/usr/bin/env node
// Smoke test: create a game room, join with another player, settle to host.
//
// Env required:
//   HAN_CONTRACT_ADDRESS  0x...
//   AUTHORITY_PRIVATE_KEY 0x... (hub authority key with settle permission)
//   HOST_WALLET_PATH      path to host wallet.json
//   PLAYER_WALLET_PATH    path to second player wallet.json
//   AVAX_RPC_URL          optional
//
// Usage: pnpm escrow

import {
  createPublicClient,
  createWalletClient,
  fallback,
  getAddress,
  http,
  parseEther,
  stringToHex,
  type Address,
} from 'viem';
import { avalancheFuji } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { hanAbi, loadLocalAccount } from '@han/sdk/dist/index.js';

const ROOM_ID = BigInt(Date.now());
const ENTRY_FEE = parseEther('0.001');

async function main() {
  const han = getAddress(process.env['HAN_CONTRACT_ADDRESS']!) as Address;
  const authority = privateKeyToAccount(process.env['AUTHORITY_PRIVATE_KEY']! as `0x${string}`);
  const host = loadLocalAccount(process.env['HOST_WALLET_PATH']);
  const player = loadLocalAccount(process.env['PLAYER_WALLET_PATH']);

  const transport = fallback(
    [http(process.env['AVAX_RPC_URL'] ?? 'https://api.avax-test.network/ext/bc/C/rpc')],
    { rank: false },
  );
  const publicClient = createPublicClient({ chain: avalancheFuji, transport });
  const hostWallet = createWalletClient({ account: host, chain: avalancheFuji, transport });
  const playerWallet = createWalletClient({ account: player, chain: avalancheFuji, transport });
  const authorityWallet = createWalletClient({ account: authority, chain: avalancheFuji, transport });

  console.log(`room ${ROOM_ID}, entry ${ENTRY_FEE} wei`);

  const createHash = await hostWallet.writeContract({
    address: han,
    abi: hanAbi,
    functionName: 'createGameRoom',
    args: [ROOM_ID, stringToHex('pong', { size: 32 }), ENTRY_FEE, 2],
    value: ENTRY_FEE,
  });
  await publicClient.waitForTransactionReceipt({ hash: createHash });
  console.log(`create ${createHash}`);

  const joinHash = await playerWallet.writeContract({
    address: han,
    abi: hanAbi,
    functionName: 'joinGame',
    args: [ROOM_ID],
    value: ENTRY_FEE,
  });
  await publicClient.waitForTransactionReceipt({ hash: joinHash });
  console.log(`join   ${joinHash}`);

  const settleHash = await authorityWallet.writeContract({
    address: han,
    abi: hanAbi,
    functionName: 'settleGame',
    args: [ROOM_ID, host.address],
  });
  await publicClient.waitForTransactionReceipt({ hash: settleHash });
  console.log(`settle ${settleHash}`);
  console.log(`explorer https://testnet.snowtrace.io/tx/${settleHash}`);
}

main().catch((err) => {
  console.error('test-game-escrow failed:', err);
  process.exit(1);
});
