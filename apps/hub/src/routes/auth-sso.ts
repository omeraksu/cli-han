import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { randomBytes } from 'node:crypto';

import type { HubContext } from '../ws/context.js';
import { logger } from '../logger.js';

const evmAddress = z.string().regex(/^0x[a-fA-F0-9]{40}$/);

// Sprint 2 — auth scaffolding only. Real Google + GitHub OAuth callbacks land
// alongside the Next.js web layer in Sprint 5 (apps/web/api/auth/[provider]).
// The schema fields (Profile.email/ssoProvider/ssoSubject) and a dev-only
// upsert endpoint exist here so the rest of Sprint 2 can refer to "email
// identity" without waiting on the frontend.
const devLoginSchema = z.object({
  wallet: evmAddress.optional(),
  email: z.string().email().max(128),
  ssoProvider: z.enum(['google', 'github', 'dev']).default('dev'),
  ssoSubject: z.string().min(1).max(128).optional(),
  handle: z.string().regex(/^[a-z0-9_-]{3,32}$/i).optional(),
});

function deriveSubject(provider: string, email: string): string {
  return provider === 'dev' ? `dev:${email}` : email;
}

export async function authSsoRoutes(app: FastifyInstance, ctx: HubContext): Promise<void> {
  // POST /auth/dev-login — non-production stub. Resolves to a Profile by
  // (ssoProvider, ssoSubject) if known, else by wallet, else creates fresh.
  // Returns a 32-byte hex bearer token that web/cli clients can echo back on
  // subsequent requests once the auth middleware lands.
  app.post('/auth/dev-login', async (req, reply) => {
    if (process.env['NODE_ENV'] === 'production') {
      return reply.code(403).send({ error: 'dev-login disabled in production' });
    }
    const parsed = devLoginSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid body', details: parsed.error.flatten() });
    }
    const { wallet, email, ssoProvider } = parsed.data;
    const ssoSubject = parsed.data.ssoSubject ?? deriveSubject(ssoProvider, email);

    // Lookup chain: (provider, subject) → email → wallet → create
    let profile = await ctx.db.profile.findUnique({
      where: { ssoProvider_ssoSubject: { ssoProvider, ssoSubject } },
    });
    if (!profile) {
      profile = await ctx.db.profile.findUnique({ where: { email } });
    }
    if (!profile && wallet) {
      profile = await ctx.db.profile.findUnique({ where: { wallet } });
    }

    if (profile) {
      profile = await ctx.db.profile.update({
        where: { wallet: profile.wallet },
        data: {
          email,
          ssoProvider,
          ssoSubject,
          handle: parsed.data.handle ?? profile.handle,
        },
      });
    } else {
      const resolvedWallet =
        wallet ?? `0x${randomBytes(20).toString('hex')}`; // sso-only profile placeholder
      const handle = parsed.data.handle ?? email.split('@')[0]!.toLowerCase().slice(0, 32);
      profile = await ctx.db.profile.create({
        data: {
          wallet: resolvedWallet,
          handle,
          email,
          ssoProvider,
          ssoSubject,
        },
      });
    }

    const token = randomBytes(32).toString('hex');
    // Bearer token is sticky to (wallet, provider) for 7d. Redis is the
    // session store — middleware in Sprint 5 will check this key.
    await ctx.redis.set(`han:sso:${token}`, profile.wallet, 'EX', 60 * 60 * 24 * 7);

    logger.info(
      { wallet: profile.wallet, ssoProvider, ssoSubject, devLogin: true },
      'sso dev-login',
    );

    return reply.send({
      token,
      profile: {
        wallet: profile.wallet,
        handle: profile.handle,
        email: profile.email,
        ssoProvider: profile.ssoProvider,
      },
    });
  });

  // GET /auth/me — given a Bearer token, return the bound profile. Will
  // become the canonical "who am I" once real OAuth lands.
  app.get('/auth/me', async (req, reply) => {
    const header = req.headers.authorization ?? '';
    const match = /^Bearer\s+([0-9a-f]{64})$/i.exec(header);
    if (!match) return reply.code(401).send({ error: 'missing bearer token' });
    const token = match[1]!;

    const wallet = await ctx.redis.get(`han:sso:${token}`);
    if (!wallet) return reply.code(401).send({ error: 'invalid or expired token' });

    const profile = await ctx.db.profile.findUnique({
      where: { wallet },
      select: { wallet: true, handle: true, email: true, ssoProvider: true, bio: true },
    });
    if (!profile) return reply.code(404).send({ error: 'profile not found' });
    return reply.send(profile);
  });
}
