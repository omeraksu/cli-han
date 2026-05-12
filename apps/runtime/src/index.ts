#!/usr/bin/env node
import 'dotenv/config';
import { program } from 'commander';

const HUB_URL = process.env['HAN_HUB_URL'] ?? 'http://localhost:3000';
const WALLET = process.env['WALLET_ADDRESS'] ?? 'demo-wallet';
const HANDLE = process.env['HAN_HANDLE'];
const DESCRIPTION = process.env['HAN_DESCRIPTION'];

program.name('han').version('0.1.0');

program
  .command('stream [command]')
  .description('AI tool session yayinla')
  .action(async (command?: string) => {
    const { startStreamer } = await import('./streamer/index.js');
    await startStreamer({
      hubUrl: HUB_URL,
      walletAddress: WALLET,
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
    const { render } = await import('ink');
    const { Lobby } = await import('./ui/Lobby.js');
    const React = await import('react');
    const sessions = await fetchLobby(HUB_URL);
    render(React.default.createElement(Lobby, { sessions }));
  });

program
  .command('connect <code>')
  .description('Yayina baglan')
  .action(async (code: string) => {
    const { startViewer } = await import('./viewer/index.js');
    await startViewer({ hubUrl: HUB_URL, sessionId: code, walletAddress: WALLET });
  });

program.parse();
