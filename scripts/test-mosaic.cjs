#!/usr/bin/env node
// CommonJS variant of test-mosaic.ts — Node --experimental-strip-types still
// chokes on ws's CJS exports through some import paths, so this is a fallback
// the smoke flow can rely on while the runtime CLI handles the real flow.
const WebSocket = require('ws');

const HUB_URL = process.env['HAN_HUB_URL'] || 'http://localhost:3001';
const EVENT_SLUG = process.env['EVENT_SLUG'] || '';
const WINDOW_MS = Number(process.env['WINDOW_MS'] || 8000);

if (!EVENT_SLUG) {
  console.error('EVENT_SLUG env required');
  process.exit(1);
}

const wsUrl = HUB_URL.replace(/^http/, 'ws') + '/ws';
console.log(`[debug] connecting to ${wsUrl} with event slug "${EVENT_SLUG}"`);
const ws = new WebSocket(wsUrl);

let snapshot = null;
const updates = [];

ws.on('open', () => {
  ws.send(JSON.stringify({ type: 'mosaic_subscribe', eventSlug: EVENT_SLUG }));
});

ws.on('message', (raw) => {
  const msg = JSON.parse(raw.toString());
  if (msg.type === 'mosaic_snapshot') {
    snapshot = msg;
    console.log(`[snapshot] ${EVENT_SLUG} tiles=${(msg.tiles || []).length} teams=${(msg.teams || []).length}`);
  } else if (msg.type === 'mosaic_tile_update') {
    updates.push(msg);
  } else if (msg.type === 'error') {
    console.error(`[error] ${JSON.stringify(msg)}`);
    process.exit(1);
  }
});

ws.on('error', (e) => console.error('[ws error]', e.message));

setTimeout(() => {
  console.log(`\n[summary] ${WINDOW_MS}ms window`);
  console.log(`  snapshot received: ${snapshot ? 'yes' : 'no'}`);
  console.log(`  tile updates: ${updates.length}`);
  const byTeam = new Map();
  for (const u of updates) {
    const k = u.teamLabel || '(unknown)';
    byTeam.set(k, (byTeam.get(k) || 0) + 1);
  }
  for (const [k, n] of [...byTeam.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${k.padEnd(20)} ${n} updates`);
    const last = updates.filter((u) => u.teamLabel === k).slice(-1)[0];
    if (last && last.lastSnippet) {
      console.log(`      latest: ${last.lastSnippet.slice(0, 60)}`);
    }
  }
  ws.send(JSON.stringify({ type: 'mosaic_unsubscribe' }));
  ws.close();
  process.exit(0);
}, WINDOW_MS);
