import * as readline from 'readline';
import { WsClient } from '../transport/ws-client.js';
import type { HubToViewer, ViewerToHub } from '../transport/protocol.js';

export interface ViewerOptions {
  hubUrl: string;
  sessionId: string;
  walletAddress?: string;
}

export async function startViewer(opts: ViewerOptions): Promise<void> {
  const { hubUrl, sessionId } = opts;

  const wsUrl = hubUrl.replace(/^http/, 'ws');
  const ws = new WsClient(`${wsUrl}/ws`);

  let currentMode: 'feed' | 'raw' = 'feed';
  const rawLines: string[] = [];

  // Step 3: Handle feed_item
  ws.on('feed_item', (payload) => {
    const p = payload as Omit<Extract<HubToViewer, { type: 'feed_item' }>, 'type'>;
    const item = p.item;
    if (currentMode !== 'feed') return;

    console.log(`\n[${new Date(item.ts).toLocaleTimeString()}] ${item.headline}`);
    if (item.actions.length > 0) {
      console.log(`  Actions: ${item.actions.join(', ')}`);
    }
    console.log(`  Focus: ${item.current_focus} | Mood: ${item.mood}`);
  });

  // Step 4: Handle raw_chunk
  ws.on('raw_chunk', (payload) => {
    const p = payload as Omit<Extract<HubToViewer, { type: 'raw_chunk' }>, 'type'>;
    if (currentMode !== 'raw') return;

    process.stdout.write(p.data);
    rawLines.push(...p.data.split('\n'));
  });

  // Step 5: Handle chat_msg
  ws.on('chat_msg', (payload) => {
    const p = payload as Omit<Extract<HubToViewer, { type: 'chat_msg' }>, 'type'>;
    const time = new Date(p.ts).toLocaleTimeString();
    process.stderr.write(`\n[chat ${time}] ${p.from}: ${p.content}\n`);
  });

  // Handle snapshot (lobby info)
  ws.on('snapshot', (payload) => {
    const p = payload as Omit<Extract<HubToViewer, { type: 'snapshot' }>, 'type'>;
    console.log(`[viewer] lobby has ${p.sessions.length} active sessions`);
  });

  ws.connect();

  // Step 2: Send join after connect
  setTimeout(() => {
    const joinMsg: ViewerToHub = { type: 'join', sessionId };
    ws.send(joinMsg);
    console.error(`[viewer] joined session ${sessionId} (mode: feed)`);
    console.error('[viewer] type /raw to switch to raw mode, /feed to switch back');
  }, 100);

  // Step 6: /raw command via stdin
  if (process.stdin.isTTY) {
    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(false);
  }

  const rl = readline.createInterface({ input: process.stdin });

  rl.on('line', (line) => {
    const trimmed = line.trim();

    if (trimmed === '/raw') {
      currentMode = 'raw';
      const msg: ViewerToHub = { type: 'switch_mode', mode: 'raw' };
      ws.send(msg);
      console.error('[viewer] switched to raw mode');
    } else if (trimmed === '/feed') {
      currentMode = 'feed';
      const msg: ViewerToHub = { type: 'switch_mode', mode: 'feed' };
      ws.send(msg);
      console.error('[viewer] switched to feed mode');
    } else if (trimmed.startsWith('/chat ')) {
      const content = trimmed.slice(6);
      const msg: ViewerToHub = { type: 'chat_send', content };
      ws.send(msg);
    }
  });

  const shutdown = () => {
    ws.close();
    rl.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  await new Promise<void>(() => {
    // Never resolves; process exits via shutdown
  });
}
