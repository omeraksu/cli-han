#!/usr/bin/env node
import 'dotenv/config';
import { Connection, PublicKey } from '@solana/web3.js';
import { loadLocalKeypair } from '../sdk/src/wallet/local-keypair.js';
import { sendTip } from '../sdk/src/tip.js';

async function main(): Promise<void> {
  const rpcUrl = process.env['SOLANA_RPC_URL'] ?? 'https://api.devnet.solana.com';
  const conn = new Connection(rpcUrl, 'confirmed');
  const from = loadLocalKeypair();
  // Default: self-tip for testing. Pass a pubkey as first arg to tip someone else.
  const to = new PublicKey(process.argv[2] ?? from.publicKey.toBase58());

  console.log('Sending tip from:', from.publicKey.toBase58());
  console.log('Sending tip to:  ', to.toBase58());
  console.log('Amount:           0.001 SOL');

  const sig = await sendTip(conn, from, to, 0.001, 'Han test tip');
  console.log('Tip TX:', sig);
  console.log('Explorer:', `https://explorer.solana.com/tx/${sig}?cluster=devnet`);
}

main().catch(console.error);
