import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

interface AuthFile {
  token: string;
  wallet: string;
  hubUrl: string;
  handle?: string;
  email?: string;
  savedAt: string;
  expiresInSeconds?: number;
}

function defaultPath(): string {
  return join(homedir(), '.han', 'auth.json');
}

export function authPath(): string {
  return process.env['HAN_AUTH_PATH'] ?? defaultPath();
}

export function loadAuth(): AuthFile | null {
  const p = authPath();
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, 'utf-8')) as AuthFile;
  } catch {
    return null;
  }
}

export function saveAuth(auth: AuthFile): void {
  const p = authPath();
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, `${JSON.stringify(auth, null, 2)}\n`, { mode: 0o600 });
}

export function clearAuth(): void {
  const p = authPath();
  if (existsSync(p)) unlinkSync(p);
}
