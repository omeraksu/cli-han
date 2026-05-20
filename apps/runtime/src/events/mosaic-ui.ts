import { loadAuth } from '../auth/token-store.js';
import { WsClient } from '../transport/ws-client.js';
import type { MosaicSnapshot, MosaicTile } from '../viewer/MosaicView.js';

interface StartArgs {
  hubUrl: string;
  eventSlug: string;
}

export async function startMosaicUi(args: StartArgs): Promise<void> {
  const auth = loadAuth();
  if (!auth) {
    console.error('[watch] login gerek — `han login` calistir');
    process.exit(1);
  }

  // Pre-flight: confirm event exists with HTTP, so we can fail fast if the
  // slug is wrong without spinning up ink.
  const evRes = await fetch(`${args.hubUrl}/events/${args.eventSlug}`, {
    headers: { Authorization: `Bearer ${auth.token}` },
  });
  if (!evRes.ok) {
    console.error(`[watch] event bulunamadi: ${args.eventSlug}`);
    process.exit(1);
  }

  const wsUrl = args.hubUrl.replace(/^http/, 'ws');
  const ws = new WsClient(`${wsUrl}/ws`);

  let snapshotPromiseResolve: ((s: MosaicSnapshot) => void) | null = null;
  const snapshotPromise = new Promise<MosaicSnapshot>((resolve) => {
    snapshotPromiseResolve = resolve;
  });

  const tileListeners: Array<(t: MosaicTile) => void> = [];

  ws.on('mosaic_snapshot', (payload) => {
    const snap = payload as MosaicSnapshot;
    snapshotPromiseResolve?.(snap);
    snapshotPromiseResolve = null;
  });

  ws.on('mosaic_tile_update', (payload) => {
    const tile = payload as MosaicTile;
    for (const cb of tileListeners) cb(tile);
  });

  ws.connect();
  // Tiny delay to let the WS open before sending subscribe. Sprint 8 will move
  // subscribe to an on-open hook inside WsClient.
  await new Promise((r) => setTimeout(r, 200));
  ws.send({ type: 'mosaic_subscribe', eventSlug: args.eventSlug });

  const snapshot = await Promise.race([
    snapshotPromise,
    new Promise<never>((_, rej) =>
      setTimeout(() => rej(new Error('mosaic_subscribe timed out')), 5000),
    ),
  ]);

  const { render } = await import('ink');
  const React = await import('react');
  const { MosaicView } = await import('../viewer/MosaicView.js');

  const { waitUntilExit, unmount } = render(
    React.default.createElement(MosaicView, {
      initial: snapshot,
      subscribe: (cb: (next: MosaicTile) => void) => {
        tileListeners.push(cb);
        return () => {
          const i = tileListeners.indexOf(cb);
          if (i >= 0) tileListeners.splice(i, 1);
        };
      },
      onExit: () => {
        try {
          ws.send({ type: 'mosaic_unsubscribe' });
        } catch {
          /* noop */
        }
        ws.close();
        unmount();
      },
    }),
  );

  await waitUntilExit();
}
