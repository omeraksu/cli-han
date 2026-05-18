import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { homedir } from 'os';
import { dirname, join } from 'path';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import type { Hex, PrivateKeyAccount, PublicClient } from 'viem';

import { WalletError } from '../errors.js';

interface WalletFile {
  privateKey: Hex;
}

export function defaultWalletPath(): string {
  return join(homedir(), '.config', 'han-avax', 'wallet.json');
}

export function loadLocalAccount(path?: string): PrivateKeyAccount {
  const keyPath = path ?? defaultWalletPath();
  try {
    const raw = readFileSync(keyPath, 'utf-8');
    const parsed = JSON.parse(raw) as WalletFile;
    if (!parsed.privateKey || !parsed.privateKey.startsWith('0x')) {
      throw new Error('wallet.json missing valid hex privateKey field');
    }
    return privateKeyToAccount(parsed.privateKey);
  } catch (err) {
    throw new WalletError(`Wallet yüklenemedi: ${keyPath}`, err);
  }
}

export function createAndSaveLocalAccount(path?: string): {
  account: PrivateKeyAccount;
  path: string;
} {
  const keyPath = path ?? defaultWalletPath();
  try {
    mkdirSync(dirname(keyPath), { recursive: true });
    const privateKey = generatePrivateKey();
    const file: WalletFile = { privateKey };
    writeFileSync(keyPath, JSON.stringify(file, null, 2), { mode: 0o600 });
    return { account: privateKeyToAccount(privateKey), path: keyPath };
  } catch (err) {
    throw new WalletError(`Wallet oluşturulamadı: ${keyPath}`, err);
  }
}

export function walletExists(path?: string): boolean {
  return existsSync(path ?? defaultWalletPath());
}

export async function getBalance(publicClient: PublicClient, address: Hex): Promise<bigint> {
  return publicClient.getBalance({ address });
}
