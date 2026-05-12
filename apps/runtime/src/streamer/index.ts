import { WsClient } from '../transport/ws-client.js';
import { applyPrivacyFilter } from './privacy-filter.js';
import { PtySession } from './pty.js';
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

export async function startStreamer(opts: StreamerOptions): Promise<void> {
  const { hubUrl, walletAddress, command, streamerName, description } = opts;
  const tool = detectTool(command);

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

  // Step 6: Handle messages from hub
  ws.on('registered', (payload) => {
    const p = payload as Omit<Extract<HubToStreamer, { type: 'registered' }>, 'type'>;
    console.error(`\n[han] Session ready. Share this code: ${p.code}\n`);

    // Step 4: Start PTY
    const shell = command ?? process.env['SHELL'] ?? '/bin/bash';
    ptySession = new PtySession({
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
        console.error(`[streamer] PTY exited with code ${code}`);
        const endMsg: StreamerToHub = { type: 'stream_end' };
        ws.send(endMsg);
        ws.close();
        process.exit(code);
      },
    });

    if (command) {
      ptySession.write(`${command}\n`);
    }
  });

  ws.on('viewer_count', (payload) => {
    const p = payload as Omit<Extract<HubToStreamer, { type: 'viewer_count' }>, 'type'>;
    viewerCount = p.count;
    process.stderr.write(`\r[han] viewers: ${viewerCount}  `);
  });

  ws.on('new_tip', (payload) => {
    const p = payload as Omit<Extract<HubToStreamer, { type: 'new_tip' }>, 'type'>;
    console.error(`\n[han] Tip received: ${p.amount} SOL from ${p.from}\n`);
  });

  ws.on('chat_unread', (payload) => {
    const p = payload as Omit<Extract<HubToStreamer, { type: 'chat_unread' }>, 'type'>;
    if (p.count > 0) {
      process.stderr.write(`\r[han] ${p.count} unread chat messages  `);
    }
  });

  // Step 7: Handle process shutdown
  const shutdown = () => {
    const endMsg: StreamerToHub = { type: 'stream_end' };
    ws.send(endMsg);
    ptySession?.kill();
    ws.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

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
