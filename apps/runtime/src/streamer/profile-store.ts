import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';

export interface SavedProfile {
  handle: string;
  bio?: string;
  createdAt: string;
}

const HAN_DIR = join(homedir(), '.han');
const PROFILE_PATH = join(HAN_DIR, 'profile.json');

export function profilePath(): string {
  return PROFILE_PATH;
}

export function loadProfile(): SavedProfile | null {
  try {
    if (!existsSync(PROFILE_PATH)) return null;
    const raw = readFileSync(PROFILE_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as SavedProfile;
    if (typeof parsed.handle !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveProfile(profile: SavedProfile): void {
  mkdirSync(dirname(PROFILE_PATH), { recursive: true });
  writeFileSync(PROFILE_PATH, `${JSON.stringify(profile, null, 2)}\n`, { mode: 0o600 });
}
