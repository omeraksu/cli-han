#!/usr/bin/env node
// Run with: pnpm --filter @han/scripts tip
// or:       cd scripts && node --env-file=../.env --experimental-strip-types --no-warnings test-tip.ts
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
// Direct paths so we don't traverse client.js / anchor-CJS named exports.
import { loadLocalKeypair } from '@han/sdk/dist/wallet/local-keypair.js';
import { sendTipWithFee } from '@han/sdk/dist/tip.js';

async function main(): Promise<void> {
  const rpcUrl = process.env['SOLANA_RPC_URL'] ?? 'https://api.devnet.solana.com';
  const feeCollectorEnv = process.env['FEE_COLLECTOR_PUBKEY'];
  if (!feeCollectorEnv) {
    throw new Error('FEE_COLLECTOR_PUBKEY env not set');
  }

  const conn = new Connection(rpcUrl, 'confirmed');
  const viewer = loadLocalKeypair();
  const streamer = new PublicKey(process.argv[2] ?? viewer.publicKey.toBase58());
  const feeCollector = new PublicKey(feeCollectorEnv);
  const amountSol = Number(process.argv[3] ?? 0.005);

  console.log('RPC:           ', rpcUrl);
  console.log('Viewer:        ', viewer.publicKey.toBase58());
  console.log('Streamer:      ', streamer.toBase58());
  console.log('Fee collector: ', feeCollector.toBase58());
  console.log('Amount:        ', `${amountSol} SOL`);

  const balanceBefore = await conn.getBalance(feeCollector, 'confirmed');
  console.log('Fee balance before:', balanceBefore / LAMPORTS_PER_SOL, 'SOL');

  const result = await sendTipWithFee({
    connection: conn,
    viewer,
    streamer,
    feeCollector,
    amountSol,
    memo: 'Han test tip with fee',
  });

  console.log('');
  console.log('✓ Signature:  ', result.signature);
  console.log('  Fee:        ', result.feeLamports, 'lamports', `(${result.feeLamports / LAMPORTS_PER_SOL} SOL)`);
  console.log('  To streamer:', result.streamerLamports, 'lamports', `(${result.streamerLamports / LAMPORTS_PER_SOL} SOL)`);
  console.log('  Explorer:   ', `https://explorer.solana.com/tx/${result.signature}?cluster=devnet`);

  const balanceAfter = await conn.getBalance(feeCollector, 'confirmed');
  const delta = balanceAfter - balanceBefore;
  console.log('Fee balance after:', balanceAfter / LAMPORTS_PER_SOL, 'SOL');
  console.log('Delta:            ', delta, 'lamports');
  if (Math.abs(delta - result.feeLamports) <= 1) {
    console.log('✓ Fee collector balance updated by expected amount');
  } else {
    console.error(`✗ Expected delta ${result.feeLamports}, got ${delta}`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
