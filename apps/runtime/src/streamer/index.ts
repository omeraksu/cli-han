import React from 'react';
import { render } from 'ink';
import { WsClient } from '../transport/ws-client.js';
import { applyPrivacyFilter } from './privacy-filter.js';
import { PtySession } from './pty.js';
import { loadProfile, saveProfile } from './profile-store.js';
import { SetupWizard } from './SetupWizard.js';
import type {
  CreateSessionRequest,
  CreateSessionResponse,
  HubToStreamer,
  StreamerToHub,
} from '../transport/protocol.js';

export interface StreamerOptions {
  hubUrl: string;
  walletAddress: string;
  command?: string;
  streamerName?: string;
  description?: string;
}

function detectTool(command: string | undefined): string {
  if (!command) return 'shell';
  const head = command.trim().split(/\s+/)[0] ?? 'shell';
  return head.toLowerCase();
}

async function runFirstTimeSetup(
  pubkey: string,
): Promise<{ handle: string; bio?: string } | null> {
  return new Promise((resolve) => {
    let result: { handle: string; bio?: string } | null = null;
    const { waitUntilExit, unmount } = render(
      React.createElement(SetupWizard, {
        pubkey,
        onComplete: (profile) => {
          result = profile;
          unmount();
        },
        onCancel: () => {
          result = null;
          unmount();
        },
      }),
      { exitOnCtrlC: false },
    );
    waitUntilExit().then(() => resolve(result));
  });
}

export async function startStreamer(opts: StreamerOptions): Promise<void> {
  const { hubUrl, walletAddress, command } = opts;
  let streamerName = opts.streamerName;
  let description = opts.description;
  const tool = detectTool(command);

  // First-time setup wizard: only runs if no ~/.han/profile.json yet.
  const existingProfile = loadProfile();
  if (!existingProfile) {
    const result = await runFirstTimeSetup(walletAddress);
    if (!result) {
      console.error('[han] setup cancelled.');
      process.exit(0);
    }
    saveProfile({
      handle: result.handle,
      bio: result.bio,
      createdAt: new Date().toISOString(),
    });
    streamerName = streamerName ?? result.handle;
    description = description ?? result.bio;
    console.error(`[han] profile saved · welcome @${result.handle}`);
  } else {
    streamerName = streamerName ?? existingProfile.handle;
    description = description ?? existingProfile.bio;
  }

  // Step 1: POST /sessions to get sessionId
  let sessionId: string;
  try {
    const body: CreateSessionRequest = {
      streamerWallet: walletAddress,
      streamerName,
      description,
      tool,
    };
    const res = await fetch(`${hubUrl}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Hub returned ${res.status}: ${text}`);
    }

    const data = (await res.json()) as CreateSessionResponse;
    sessionId = data.sessionId;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[streamer] failed to register session: ${msg}`);
    process.exit(1);
  }

  // Step 2: Open WebSocket
  const wsUrl = hubUrl.replace(/^http/, 'ws');
  const ws = new WsClient(`${wsUrl}/ws`);

  let ptySession: PtySession | null = null;
  let viewerCount = 0;
  let tipTotalSol = 0;

  function stderrLine(line: string): void {
    // Emit on its own line so it never overwrites a shell prompt.
    process.stderr.write(`\n${line}\n`);
  }

  // Forward host terminal → PTY, and host terminal resize → PTY size.
  function wireStdin(pty: PtySession): void {
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    process.stdin.resume();
    process.stdin.on('data', (chunk: Buffer | string) => {
      pty.write(typeof chunk === 'string' ? chunk : chunk.toString());
    });
    process.stdout.on('resize', () => {
      const cols = process.stdout.columns ?? 80;
      const rows = process.stdout.rows ?? 24;
      pty.resize(cols, rows);
    });
  }

  // Step 6: Handle messages from hub
  ws.on('registered', (payload) => {
    const p = payload as Omit<Extract<HubToStreamer, { type: 'registered' }>, 'type'>;
    stderrLine(`\x1b[36m[han]\x1b[0m session ready · code: \x1b[1m${p.code}\x1b[0m`);
    stderrLine(`\x1b[2mtype here as normal · Ctrl+D to stop streaming\x1b[0m`);

    // Step 4: Start PTY (only if not already started)
    if (!ptySession) {
      const shell = command ?? process.env['SHELL'] ?? '/bin/zsh';
      const pty = new PtySession({
        shell: command ? undefined : shell,
        onData: (data) => {
          // Step 5: Apply privacy filter, send stream_chunk
          const filtered = applyPrivacyFilter(data);
          const msg: StreamerToHub = {
            type: 'stream_chunk',
            data: filtered,
            ts: Date.now(),
          };
          ws.send(msg);
        },
        onExit: (code) => {
          if (process.stdin.isTTY) {
            try {
              process.stdin.setRawMode(false);
            } catch {
              /* noop */
            }
          }
          stderrLine(`[han] session ended (exit ${code})`);
          const endMsg: StreamerToHub = { type: 'stream_end' };
          ws.send(endMsg);
          ws.close();
          process.exit(code);
        },
      });
      ptySession = pty;
      wireStdin(pty);

      if (command) {
        pty.write(`${command}\n`);
      }
    }
  });

  ws.on('viewer_count', (payload) => {
    const p = payload as Omit<Extract<HubToStreamer, { type: 'viewer_count' }>, 'type'>;
    if (p.count === viewerCount) return;
    viewerCount = p.count;
    stderrLine(
      `\x1b[2m[han]\x1b[0m ◎ ${viewerCount} viewer${viewerCount === 1 ? '' : 's'}`,
    );
  });

  ws.on('new_tip', (payload) => {
    const p = payload as Omit<Extract<HubToStreamer, { type: 'new_tip' }>, 'type'>;
    tipTotalSol += p.amount;
    stderrLine(
      `\x1b[33m🔥 +${p.amount} SOL from ${p.from.slice(0, 4)}…\x1b[0m  ·  total ${tipTotalSol.toFixed(3)} SOL`,
    );
  });

  ws.on('chat_unread', (payload) => {
    const p = payload as Omit<Extract<HubToStreamer, { type: 'chat_unread' }>, 'type'>;
    if (p.count > 0) {
      stderrLine(`\x1b[2m[han]\x1b[0m 💬 ${p.count} new chat`);
    }
  });

  // Step 7: Handle process shutdown
  const shutdown = () => {
    if (process.stdin.isTTY) {
      try {
        process.stdin.setRawMode(false);
      } catch {
        /* noop */
      }
    }
    const endMsg: StreamerToHub = { type: 'stream_end' };
    ws.send(endMsg);
    ptySession?.kill();
    ws.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  process.on('exit', () => {
    if (process.stdin.isTTY) {
      try {
        process.stdin.setRawMode(false);
      } catch {
        /* noop */
      }
    }
  });

  // Step 3: Connect and send register_streamer
  ws.connect();

  const registerMsg: StreamerToHub = {
    type: 'register_streamer',
    sessionId,
    walletAddress,
    streamerName,
    description,
    tool,
  };
  // Wait a tick for the ws open event before sending
  setTimeout(() => ws.send(registerMsg), 100);

  // Keep process alive
  await new Promise<void>(() => {
    // Intentionally never resolves; process exits via shutdown or PTY exit
  });
}
