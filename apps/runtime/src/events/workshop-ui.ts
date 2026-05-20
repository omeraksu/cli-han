import { loadAuth } from '../auth/token-store.js';
import { WsClient } from '../transport/ws-client.js';
import type {
  WorkshopLesson,
  WorkshopStudentTile,
} from '../streamer/WorkshopMode.js';
import type { MosaicSnapshot, MosaicTile } from '../viewer/MosaicView.js';

interface StartArgs {
  hubUrl: string;
  eventSlug: string;
}

export async function startWorkshopUi(args: StartArgs): Promise<void> {
  const auth = loadAuth();
  if (!auth) {
    console.error('[workshop] login gerek — `han login` calistir');
    process.exit(1);
  }

  const evRes = await fetch(`${args.hubUrl}/events/${args.eventSlug}`, {
    headers: { Authorization: `Bearer ${auth.token}` },
  });
  if (!evRes.ok) {
    console.error(`[workshop] event bulunamadi: ${args.eventSlug}`);
    process.exit(1);
  }
  const ev = (await evRes.json()) as { slug: string; title: string };

  const wsUrl = args.hubUrl.replace(/^http/, 'ws');
  const ws = new WsClient(`${wsUrl}/ws`);

  const tileListeners: Array<(t: WorkshopStudentTile) => void> = [];
  const lessonListeners: Array<(l: WorkshopLesson) => void> = [];

  // We piggyback on the mosaic stream to populate the right-pane student
  // tiles — instructor needs the same per-team activity feed a judge gets.
  ws.on('mosaic_snapshot', (payload) => {
    const snap = payload as MosaicSnapshot;
    for (const t of snap.tiles) {
      for (const cb of tileListeners) cb(t as WorkshopStudentTile);
    }
  });
  ws.on('mosaic_tile_update', (payload) => {
    const tile = payload as MosaicTile;
    for (const cb of tileListeners) cb(tile as WorkshopStudentTile);
  });
  ws.on('workshop_lesson', (payload) => {
    const lesson = payload as WorkshopLesson;
    for (const cb of lessonListeners) cb(lesson);
  });

  ws.connect();
  await new Promise((r) => setTimeout(r, 200));
  ws.send({ type: 'mosaic_subscribe', eventSlug: args.eventSlug });
  ws.send({ type: 'workshop_join', eventSlug: args.eventSlug });

  const { render } = await import('ink');
  const React = await import('react');
  const { WorkshopMode } = await import('../streamer/WorkshopMode.js');

  const { waitUntilExit, unmount } = render(
    React.default.createElement(WorkshopMode, {
      eventSlug: ev.slug,
      eventTitle: ev.title,
      subscribeTiles: (cb: (next: WorkshopStudentTile) => void) => {
        tileListeners.push(cb);
        return () => {
          const i = tileListeners.indexOf(cb);
          if (i >= 0) tileListeners.splice(i, 1);
        };
      },
      subscribeLesson: (cb: (l: WorkshopLesson) => void) => {
        lessonListeners.push(cb);
        return () => {
          const i = lessonListeners.indexOf(cb);
          if (i >= 0) lessonListeners.splice(i, 1);
        };
      },
      publishCursor: (lesson: string, cursor?: string, note?: string) => {
        ws.send({
          type: 'workshop_cursor',
          eventSlug: args.eventSlug,
          lesson,
          cursor,
          note,
        });
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
