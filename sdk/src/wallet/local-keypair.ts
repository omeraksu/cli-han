import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { WalletError } from '../errors.js';

export function loadLocalKeypair(path?: string): Keypair {
  const keyPath = path ?? join(homedir(), '.config', 'solana', 'id.json');
  try {
    const raw = readFileSync(keyPath, 'utf-8');
    const bytes = JSON.parse(raw) as number[];
    return Keypair.fromSecretKey(Uint8Array.from(bytes));
  } catch (err) {
    throw new WalletError(`Keypair yüklenemedi: ${keyPath}`, err);
  }
}

export async function getBalance(connection: Connection, pubkey: PublicKey): Promise<number> {
  return connection.getBalance(pubkey, 'confirmed');
}
