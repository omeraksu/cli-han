#!/usr/bin/env node
// Smoke test for Sprint 4: connect as a judge WS subscriber, count mosaic
// updates for a fixed window. Used in tandem with `han stream --event` runs
// to confirm the streamer → hub → mosaic fanout works end-to-end without
// spinning up ink.

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const WebSocket = require('ws') as typeof import('ws')['WebSocket'];
type RawData = import('ws').RawData;

const HUB_URL = process.env['HAN_HUB_URL'] ?? 'http://localhost:3001';
const EVENT_SLUG = process.env['EVENT_SLUG'] ?? '';
const WINDOW_MS = Number(process.env['WINDOW_MS'] ?? 8000);

if (!EVENT_SLUG) {
  console.error('EVENT_SLUG env required');
  process.exit(1);
}

const wsUrl = HUB_URL.replace(/^http/, 'ws') + '/ws';
const ws = new WebSocket(wsUrl);

let snapshot: unknown = null;
const updates: Array<{
  type: string; teamLabel?: string; sessionId?: string; lastActivity?: number; lastSnippet?: string;
}> = [];

ws.on('open', () => {
  ws.send(JSON.stringify({ type: 'mosaic_subscribe', eventSlug: EVENT_SLUG }));
});

ws.on('message', (raw: RawData) => {
  const msg = JSON.parse(raw.toString()) as { type: string; [key: string]: unknown };
  if (msg.type === 'mosaic_snapshot') {
    snapshot = msg;
    const tiles = (msg.tiles as unknown[]) ?? [];
    console.log(`[snapshot] ${EVENT_SLUG} tiles=${tiles.length}`);
  } else if (msg.type === 'mosaic_tile_update') {
    updates.push(msg as never);
  } else if (msg.type === 'error') {
    console.error(`[error] ${JSON.stringify(msg)}`);
    process.exit(1);
  }
});

setTimeout(() => {
  console.log(`\n[summary] ${WINDOW_MS}ms window`);
  console.log(`  snapshot received: ${snapshot ? 'yes' : 'no'}`);
  console.log(`  tile updates: ${updates.length}`);
  const byTeam = new Map<string, number>();
  for (const u of updates) {
    const k = u.teamLabel ?? '(unknown)';
    byTeam.set(k, (byTeam.get(k) ?? 0) + 1);
  }
  for (const [k, n] of [...byTeam.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${k.padEnd(20)} ${n} updates`);
  }
  ws.send(JSON.stringify({ type: 'mosaic_unsubscribe' }));
  ws.close();
  process.exit(0);
}, WINDOW_MS);
