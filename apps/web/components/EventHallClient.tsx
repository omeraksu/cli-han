'use client';

import { useEffect, useState } from 'react';
import type { EventDetail } from '../lib/hub';

interface Props {
  slug: string;
  hubUrl: string;
  initial: EventDetail;
}

// Re-fetches /events/:slug every 5s. Sprint 8 swaps this for a WS feed but
// polling is enough for the public hall (organizer/sponsor view).
export function EventHallClient({ slug, hubUrl, initial }: Props): React.ReactElement {
  const [event, setEvent] = useState<EventDetail>(initial);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch(`${hubUrl}/events/${slug}`);
        if (!res.ok) return;
        const next = (await res.json()) as EventDetail;
        if (!cancelled) setEvent(next);
      } catch {
        /* swallow; will retry next tick */
      }
    };
    const interval = setInterval(tick, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [hubUrl, slug]);

  const liveNow = event.sessions.filter((s) => !s.endedAt).length;
  const totalSessions = event.sessions.length;
  const teams = event.teams.length;
  const subs = event.submissions.length;
  const openHelp = event.helpSignals.filter((h) => !h.closedAt).length;

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 py-6 border-y border-smoke">
      <div className="px-2">
        <div className="font-mono text-5xl font-semibold text-cream">{liveNow}</div>
        <div className="wm-mono text-xs text-dim mt-1">live streams now</div>
      </div>
      <div className="px-2">
        <div className="font-mono text-5xl font-semibold text-cream">{totalSessions}</div>
        <div className="wm-mono text-xs text-dim mt-1">sessions captured</div>
      </div>
      <div className="px-2">
        <div className="font-mono text-5xl font-semibold text-teal">{teams}</div>
        <div className="wm-mono text-xs text-dim mt-1">teams enrolled</div>
      </div>
      <div className="px-2">
        <div className="font-mono text-5xl font-semibold text-amber">{subs}</div>
        <div className="wm-mono text-xs text-dim mt-1">submissions</div>
      </div>
      <div className="px-2">
        <div className={`font-mono text-5xl font-semibold ${openHelp > 0 ? 'text-ember' : 'text-dim'}`}>
          {openHelp}
        </div>
        <div className="wm-mono text-xs text-dim mt-1">help signals open</div>
      </div>
    </div>
  );
}
