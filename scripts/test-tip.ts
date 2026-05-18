#!/usr/bin/env node
// Quick smoke test: send a 0.001 AVAX tip via HanTipRouter on Fuji.
//
// Env required:
//   HAN_TIP_ROUTER_ADDRESS  0x...
//   STREAMER_ADDRESS         0x... (recipient)
//   HAN_WALLET_PATH          optional, default ~/.config/han-avax/wallet.json
//
// Usage: pnpm tip

import { createPublicClient, createWalletClient, fallback, http, getAddress, type Address } from 'viem';
import { avalancheFuji } from 'viem/chains';
import { loadLocalAccount, sendTipWithFee } from '@han/sdk/dist/index.js';

async function main() {
  const router = getAddress(process.env['HAN_TIP_ROUTER_ADDRESS']!) as Address;
  const streamer = getAddress(process.env['STREAMER_ADDRESS']!) as Address;
  const amountAvax = process.env['AMOUNT_AVAX'] ?? '0.001';

  const account = loadLocalAccount(process.env['HAN_WALLET_PATH']);
  const transport = fallback(
    [http(process.env['AVAX_RPC_URL'] ?? 'https://api.avax-test.network/ext/bc/C/rpc')],
    { rank: false },
  );
  const publicClient = createPublicClient({ chain: avalancheFuji, transport });
  const walletClient = createWalletClient({ account, chain: avalancheFuji, transport });

  console.log(`from   ${account.address}`);
  console.log(`to     ${streamer}`);
  console.log(`router ${router}`);
  console.log(`amount ${amountAvax} AVAX`);

  const result = await sendTipWithFee({
    publicClient,
    walletClient,
    router,
    streamer,
    amountAvax,
  });

  console.log('---');
  console.log(`hash         ${result.hash}`);
  console.log(`amount wei   ${result.amountWei}`);
  console.log(`fee wei      ${result.feeWei}`);
  console.log(`streamer wei ${result.streamerWei}`);
  console.log(`explorer     https://testnet.snowtrace.io/tx/${result.hash}`);
}

main().catch((err) => {
  console.error('test-tip failed:', err);
  process.exit(1);
});
