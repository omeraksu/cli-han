import type { PrismaClient } from '@prisma/client';

export interface UpsertResult {
  handle: string;
  /** True if the requested handle was taken and we returned a different one. */
  collision: boolean;
  /** When `collision`, this is the handle that was actually persisted. */
  suggested?: string;
}

const MAX_SUFFIX_TRIES = 12;

function sanitizeHandle(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32) || 'anon';
}

/**
 * Upserts a profile row keyed by wallet. If the wallet already has a profile,
 * the handle is refreshed (last writer wins for the same wallet). If a
 * different wallet has reserved the requested handle, we suffix `-N` until a
 * free slot is found and return `collision: true` so the client can show a
 * "your handle was renamed" toast.
 */
export async function upsertProfile(
  db: PrismaClient,
  wallet: string,
  requestedHandle: string,
  bio?: string,
): Promise<UpsertResult> {
  const requested = sanitizeHandle(requestedHandle);

  const existingByWallet = await db.profile.findUnique({ where: { wallet } });
  if (existingByWallet && existingByWallet.handle === requested) {
    return { handle: requested, collision: false };
  }

  // Check whether the requested handle is taken by another wallet.
  const owner = await db.profile.findUnique({ where: { handle: requested } });
  if (!owner || owner.wallet === wallet) {
    await db.profile.upsert({
      where: { wallet },
      update: { handle: requested, ...(bio !== undefined ? { bio } : {}) },
      create: { wallet, handle: requested, ...(bio !== undefined ? { bio } : {}) },
    });
    return { handle: requested, collision: false };
  }

  // Suffix sweep — pick the lowest free `name-N`.
  for (let i = 2; i < MAX_SUFFIX_TRIES + 2; i++) {
    const candidate = `${requested}-${i}`.slice(0, 32);
    const taken = await db.profile.findUnique({ where: { handle: candidate } });
    if (!taken) {
      await db.profile.upsert({
        where: { wallet },
        update: { handle: candidate, ...(bio !== undefined ? { bio } : {}) },
        create: { wallet, handle: candidate, ...(bio !== undefined ? { bio } : {}) },
      });
      return { handle: candidate, collision: true, suggested: candidate };
    }
  }

  // Last resort — wallet-suffixed handle (effectively unique).
  const fallback = `${requested}-${wallet.slice(0, 4).toLowerCase()}`.slice(0, 32);
  await db.profile.upsert({
    where: { wallet },
    update: { handle: fallback, ...(bio !== undefined ? { bio } : {}) },
    create: { wallet, handle: fallback, ...(bio !== undefined ? { bio } : {}) },
  });
  return { handle: fallback, collision: true, suggested: fallback };
}
