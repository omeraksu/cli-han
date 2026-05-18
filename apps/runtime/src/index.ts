#!/usr/bin/env node
import 'dotenv/config';
import { program } from 'commander';
import {
  createAndSaveLocalAccount,
  defaultWalletPath,
  loadLocalAccount,
  walletExists,
} from '@han/sdk/dist/index.js';

const HUB_URL = process.env['HAN_HUB_URL'] ?? 'http://localhost:3000';
const WALLET_PATH = process.env['HAN_WALLET_PATH'];
const HANDLE = process.env['HAN_HANDLE'];
const DESCRIPTION = process.env['HAN_DESCRIPTION'];

program.name('han').version('0.1.0');

function ensureWalletOrExit(path?: string) {
  const resolved = path ?? defaultWalletPath();
  if (!walletExists(resolved)) {
    if (process.env['HAN_AUTO_CREATE_WALLET'] === '1') {
      const { account, path: created } = createAndSaveLocalAccount(resolved);
      console.error(`[han] new wallet created at ${created}`);
      console.error(`[han] address: ${account.address}`);
      console.error(`[han] fund with Fuji AVAX: https://faucet.avax.network/`);
      return loadLocalAccount(created);
    }
    console.error(`[han] no wallet at ${resolved}`);
    console.error(`[han] run \`HAN_AUTO_CREATE_WALLET=1 han stream\` to generate one`);
    process.exit(1);
  }
  return loadLocalAccount(resolved);
}

program
  .command('stream [command]')
  .description('AI tool session yayinla')
  .action(async (command?: string) => {
    const { startStreamer } = await import('./streamer/index.js');
    const account = ensureWalletOrExit(WALLET_PATH);
    await startStreamer({
      hubUrl: HUB_URL,
      account,
      command,
      streamerName: HANDLE,
      description: DESCRIPTION,
    });
  });

program
  .command('browse')
  .description('Aktif yayinlari listele')
  .action(async () => {
    const { fetchLobby } = await import('./viewer/lobby.js');
    const { startViewer } = await import('./viewer/index.js');
    const { render } = await import('ink');
    const { Lobby } = await import('./ui/Lobby.js');
    const React = await import('react');
    const sessions = await fetchLobby(HUB_URL);
    const { waitUntilExit, unmount } = render(
      React.default.createElement(Lobby, {
        sessions,
        interactive: true,
        onSelect: (session: { id: string }) => {
          unmount();
          startViewer({
            hubUrl: HUB_URL,
            sessionId: session.id,
            walletAddress: process.env['WALLET_ADDRESS'] ?? '0x0000000000000000000000000000000000000000',
            handle: HANDLE,
          });
        },
      }),
    );
    await waitUntilExit();
  });

program
  .command('connect <code>')
  .description('Yayina baglan')
  .action(async (code: string) => {
    const { startViewer } = await import('./viewer/index.js');
    await startViewer({
      hubUrl: HUB_URL,
      sessionId: code,
      walletAddress: process.env['WALLET_ADDRESS'] ?? '0x0000000000000000000000000000000000000000',
      handle: HANDLE,
    });
  });

program.parse();
