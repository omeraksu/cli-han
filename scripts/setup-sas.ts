#!/usr/bin/env node
// Setup SAS credential and schema PDAs for Han attestation.
// Run once after anchor deploy: npx tsx scripts/setup-sas.ts

import 'dotenv/config';
import { loadLocalKeypair } from '../sdk/src/wallet/local-keypair.js';
import { FailoverConnection } from '../sdk/src/rpc-client.js';

async function main(): Promise<void> {
  const keypair = loadLocalKeypair(process.env['HUB_AUTHORITY_KEYPAIR_PATH']);
  const rpcUrl = process.env['SOLANA_RPC_URL'];
  if (!rpcUrl) throw new Error('SOLANA_RPC_URL env not set');

  const rpc = new FailoverConnection([
    { url: rpcUrl, name: 'primary', priority: 1 },
    ...(process.env['HELIUS_RPC_URL']
      ? [{ url: process.env['HELIUS_RPC_URL'], name: 'helius', priority: 2 }]
      : []),
  ]);

  const conn = rpc.getConnection();

  console.log('Hub authority:', keypair.publicKey.toBase58());
  console.log('RPC:', conn.rpcEndpoint);
  console.log('');
  console.log('TODO: sas-lib kurulduktan sonra credential + schema PDA yarat.');
  console.log('Gerekli env: SAS_CREDENTIAL_PDA, SAS_SCHEMA_PDA .env\'e yazılacak.');
  console.log('');
  console.log('Schema: game_result v1');
  console.log('  fields: winner, game_type, score, player_count, room_id, timestamp');
  console.log('  nonce: roomId.toString() (BigInt-safe, Number() kullanma)');

  // Placeholder — sas-lib hazır olduğunda implement et:
  //
  // import { getCreateCredentialInstruction, getCreateSchemaInstruction } from 'sas-lib';
  //
  // const credentialIx = getCreateCredentialInstruction({ authority: keypair.publicKey, ... });
  // const schemaIx = getCreateSchemaInstruction({ ... fields ... });
  // ... send transactions, print PDAs, write to .env
}

main().catch(console.error);
