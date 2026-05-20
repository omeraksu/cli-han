import { loadLocalAccount, defaultWalletPath } from '@han/sdk/dist/index.js';
import { saveAuth } from './token-store.js';

interface NonceResponse {
  nonce: string;
  message?: string;
  expiresAt: number;
}

interface WalletLoginResponse {
  token: string;
  profile: { wallet: string; handle: string; email?: string; ssoProvider?: string };
  expiresInSeconds?: number;
}

export interface RunWalletLoginArgs {
  hubUrl: string;
  walletPath?: string;
  handle?: string;
}

export async function runWalletLogin(args: RunWalletLoginArgs): Promise<void> {
  const wp = args.walletPath ?? defaultWalletPath();
  const account = loadLocalAccount(wp);

  const nonceRes = await fetch(`${args.hubUrl}/sessions/nonce`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ wallet: account.address }),
  });
  if (!nonceRes.ok) {
    console.error(`[login] hub /sessions/nonce ${nonceRes.status}: ${await nonceRes.text()}`);
    process.exit(1);
  }
  const { nonce, message } = (await nonceRes.json()) as NonceResponse;
  const msg = message ?? `Han login\nnonce: ${nonce}`;
  const signature = await account.signMessage({ message: msg });

  const loginRes = await fetch(`${args.hubUrl}/auth/wallet-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      wallet: account.address,
      nonce,
      signature,
      handle: args.handle,
    }),
  });
  if (!loginRes.ok) {
    console.error(`[login] hub /auth/wallet-login ${loginRes.status}: ${await loginRes.text()}`);
    process.exit(1);
  }
  const data = (await loginRes.json()) as WalletLoginResponse;

  saveAuth({
    token: data.token,
    wallet: data.profile.wallet,
    hubUrl: args.hubUrl,
    handle: data.profile.handle,
    email: data.profile.email,
    savedAt: new Date().toISOString(),
    expiresInSeconds: data.expiresInSeconds,
  });

  console.log(`[login] ok · ${data.profile.handle} (${data.profile.wallet})`);
  console.log(`[login] token saved · expires in ~${Math.round((data.expiresInSeconds ?? 0) / 86400)} days`);
}
