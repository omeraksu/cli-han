import type { FastifyRequest } from 'fastify';
import type { HubContext } from '../ws/context.js';

/** Resolves the wallet bound to a Bearer token, or null if absent/expired. */
export async function resolveBearerWallet(
  req: FastifyRequest,
  ctx: HubContext,
): Promise<string | null> {
  const header = req.headers.authorization ?? '';
  const match = /^Bearer\s+([0-9a-f]{64})$/i.exec(header);
  if (!match) return null;
  const token = match[1]!;
  const wallet = await ctx.redis.get(`han:sso:${token}`);
  return wallet;
}
