import React from 'react';
import { render } from 'ink';
import type { PrivateKeyAccount } from 'viem';
import { WsClient } from '../transport/ws-client.js';
import { applyPrivacyFilter } from './privacy-filter.js';
import { PtySession } from './pty.js';
import { loadProfile, saveProfile } from './profile-store.js';
import { SetupWizard } from './SetupWizard.js';
import type {
  CreateSessionRequest,
  CreateSessionResponse,
  HubToStreamer,
  RequestNonceResponse,
  StreamerToHub,
} from '../transport/protocol.js';

export interface StreamerOptions {
  hubUrl: string;
  account: PrivateKeyAccount;
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
  const { hubUrl, account, command } = opts;
  const walletAddress = account.address;
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

  // Step 1: signed handshake — fetch nonce, sign it, POST /sessions
  let sessionId: string;
  let wsToken: string;
  try {
    const nonceRes = await fetch(`${hubUrl}/sessions/nonce`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet: walletAddress }),
    });
    if (!nonceRes.ok) {
      throw new Error(`Hub /sessions/nonce returned ${nonceRes.status}: ${await nonceRes.text()}`);
    }
    const { nonce, message } = (await nonceRes.json()) as RequestNonceResponse;
    const signMessage = message ?? `Han login\nnonce: ${nonce}`;
    const signature = await account.signMessage({ message: signMessage });

    const body: CreateSessionRequest = {
      streamerWallet: walletAddress,
      nonce,
      signature,
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
    wsToken = data.wsToken;
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
  let tipTotalAvax = 0;

  function stderrLine(line: string): void {
    // Emit on its own line so it never overwrites a shell prompt.
    process.stderr.write(`\n${line}\n`);
  }

  // Forward host terminal → PTY. The PTY is pinned to the broadcast
  // grid (BROADCAST_COLS × BROADCAST_ROWS), so we deliberately do not
  // forward host resize events.
  function wireStdin(pty: PtySession): void {
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    process.stdin.resume();
    process.stdin.on('data', (chunk: Buffer | string) => {
      pty.write(typeof chunk === 'string' ? chunk : chunk.toString());
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
    tipTotalAvax += p.amount;
    stderrLine(
      `\x1b[33m🔥 +${p.amount} AVAX from ${p.from.slice(0, 6)}…\x1b[0m  ·  total ${tipTotalAvax.toFixed(4)} AVAX`,
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
    wsToken,
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
