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
  .option('--event <slug>', 'Event slug — bu yayini bir event corpus\'una bagla')
  .option('--team <label>', 'Event icinde takim etiketi (orn. team-fener)')
  .action(async (command: string | undefined, opts: { event?: string; team?: string }) => {
    const { startStreamer } = await import('./streamer/index.js');
    const account = ensureWalletOrExit(WALLET_PATH);
    await startStreamer({
      hubUrl: HUB_URL,
      account,
      command,
      streamerName: HANDLE,
      description: DESCRIPTION,
      eventSlug: opts.event ?? process.env['HAN_EVENT'],
      teamLabel: opts.team ?? process.env['HAN_TEAM'],
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

program
  .command('login')
  .description('Cuzdanini imzala, hub bearer token al')
  .option('--handle <name>', 'Profile handle (yoksa cuzdan kisaltmasi)')
  .action(async (opts: { handle?: string }) => {
    const { runWalletLogin } = await import('./auth/login.js');
    await runWalletLogin({ hubUrl: HUB_URL, walletPath: WALLET_PATH, handle: opts.handle ?? HANDLE });
  });

const events = program.command('events').description('Event komutlari (organizer/judge/builder)');

events
  .command('list')
  .description('Uye oldugun event\'leri listele')
  .action(async () => {
    const { runEventsList } = await import('./events/commands.js');
    await runEventsList({ hubUrl: HUB_URL });
  });

events
  .command('join <slug>')
  .description('Pending bir event davetini kabul et')
  .action(async (slug: string) => {
    const { runEventsJoin } = await import('./events/commands.js');
    await runEventsJoin({ hubUrl: HUB_URL, slug });
  });

program
  .command('profile <action>')
  .description('Profile actions (attest)')
  .option('--event <slug>', 'Event slug')
  .option('--role <role>', 'organizer/judge/mentor/instructor/builder/spectator')
  .action(async (action: string, opts: { event?: string; role?: string }) => {
    if (action !== 'attest') {
      console.error(`[profile] bilinmeyen aksiyon: ${action}. Su an sadece 'attest' destekleniyor`);
      process.exit(1);
    }
    if (!opts.event) {
      console.error('[profile] --event <slug> gerek');
      process.exit(1);
    }
    const role = (opts.role ?? 'builder') as
      | 'organizer' | 'judge' | 'mentor' | 'instructor' | 'builder' | 'spectator';
    const { runAttest } = await import('./events/attest.js');
    await runAttest({ hubUrl: HUB_URL, walletPath: WALLET_PATH, eventSlug: opts.event, role });
  });

program
  .command('workshop <action> [slug]')
  .description('Workshop modu — Sprint 4 UI ile gelecek')
  .action(async (action: string, slug?: string) => {
    const { runWorkshopStub } = await import('./events/commands.js');
    await runWorkshopStub({ hubUrl: HUB_URL, action, slug });
  });

program
  .command('watch')
  .description('Judge mosaic — Sprint 4 UI ile gelecek')
  .option('--event <slug>', 'Event slug')
  .action(async (opts: { event?: string }) => {
    const { runWatchStub } = await import('./events/commands.js');
    await runWatchStub({ hubUrl: HUB_URL, eventSlug: opts.event });
  });

program.parse();
