import { loadAuth } from '../auth/token-store.js';

interface MeEventRow {
  role: string;
  accepted: boolean;
  invitedBy: string | null;
  invitedAt: string;
  event: {
    id: string;
    slug: string;
    title: string;
    status: string;
    plan: string;
    startsAt: string;
    endsAt: string | null;
    organizerWallet: string;
  };
}

function requireAuth() {
  const auth = loadAuth();
  if (!auth) {
    console.error('[events] login gerek — `han login` calistir');
    process.exit(1);
  }
  return auth;
}

export interface CommonArgs { hubUrl: string }

export async function runEventsList(args: CommonArgs): Promise<void> {
  const auth = requireAuth();
  const res = await fetch(`${args.hubUrl}/me/events`, {
    headers: { Authorization: `Bearer ${auth.token}` },
  });
  if (!res.ok) {
    console.error(`[events] /me/events ${res.status}: ${await res.text()}`);
    process.exit(1);
  }
  const rows = (await res.json()) as MeEventRow[];
  if (rows.length === 0) {
    console.log('[events] hic event yok. Organizer seni davet edince burada gorunur.');
    return;
  }
  console.log(`\n  ${rows.length} event\n`);
  for (const r of rows) {
    const mark = r.accepted ? '\x1b[32m✓\x1b[0m' : '\x1b[33m·\x1b[0m';
    console.log(`  ${mark} \x1b[1m${r.event.slug}\x1b[0m  ${r.event.title}`);
    console.log(`      role: ${r.role}  plan: ${r.event.plan}  status: ${r.event.status}` + (r.accepted ? '' : '  \x1b[33m(pending invite)\x1b[0m'));
  }
  console.log('');
}

export async function runEventsJoin(args: CommonArgs & { slug: string }): Promise<void> {
  const auth = requireAuth();
  const res = await fetch(`${args.hubUrl}/events/${args.slug}/accept`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${auth.token}` },
  });
  if (!res.ok) {
    console.error(`[events] /events/${args.slug}/accept ${res.status}: ${await res.text()}`);
    process.exit(1);
  }
  const row = (await res.json()) as { role: string; acceptedAt: string };
  console.log(`[events] ${args.slug} kabul edildi · role=${row.role}`);
}

export async function runWorkshopStub(args: CommonArgs & { action: string; slug?: string }): Promise<void> {
  const auth = loadAuth();
  if (!auth) {
    console.error('[workshop] login gerek — `han login` calistir');
    process.exit(1);
  }
  if (args.action !== 'start') {
    console.error(`[workshop] bilinmeyen aksiyon: ${args.action}. Su an sadece 'start' destekleniyor`);
    process.exit(1);
  }
  if (!args.slug) {
    console.error('[workshop] event slug gerek: han workshop start <slug>');
    process.exit(1);
  }
  // Sprint 4 brings the actual split-pane PTY layout. For now we just confirm
  // the event exists and the user is the instructor.
  const res = await fetch(`${args.hubUrl}/events/${args.slug}`, {
    headers: { Authorization: `Bearer ${auth.token}` },
  });
  if (!res.ok) {
    console.error(`[workshop] event bulunamadi: ${args.slug}`);
    process.exit(1);
  }
  const ev = (await res.json()) as { slug: string; title: string; status: string };
  console.log(`\n  \x1b[1mworkshop start · ${ev.slug}\x1b[0m  ${ev.title}`);
  console.log(`  status: ${ev.status}`);
  console.log('  \x1b[33m[Sprint 4 UI]\x1b[0m instructor split-pane mosaic henuz hazir degil');
  console.log('  Builder olarak streaming icin: `han stream --event ' + ev.slug + ' --team <slug>`\n');
}

export async function runWatchStub(args: CommonArgs & { eventSlug?: string }): Promise<void> {
  const auth = loadAuth();
  if (!auth) {
    console.error('[watch] login gerek — `han login` calistir');
    process.exit(1);
  }
  if (!args.eventSlug) {
    console.error('[watch] event slug gerek: han watch --event <slug>');
    process.exit(1);
  }
  const res = await fetch(`${args.hubUrl}/events/${args.eventSlug}`, {
    headers: { Authorization: `Bearer ${auth.token}` },
  });
  if (!res.ok) {
    console.error(`[watch] event bulunamadi: ${args.eventSlug}`);
    process.exit(1);
  }
  const ev = (await res.json()) as {
    slug: string; title: string; status: string;
    teams: Array<{ slug: string; name: string; _count: { members: number; submissions: number } }>;
    sessions: Array<{ id: string; teamLabel: string | null; endedAt: string | null }>;
    helpSignals: Array<{ id: string; reason: string | null; openedAt: string }>;
  };
  console.log(`\n  \x1b[1mwatch · ${ev.slug}\x1b[0m  ${ev.title}`);
  console.log(`  status: ${ev.status}  ·  teams: ${ev.teams.length}  ·  sessions: ${ev.sessions.length}  ·  help: ${ev.helpSignals.length}\n`);
  for (const t of ev.teams) {
    console.log(`  • ${t.slug.padEnd(16)} members: ${t._count.members}  subs: ${t._count.submissions}`);
  }
  if (ev.helpSignals.length > 0) {
    console.log('\n  \x1b[31mopen help signals:\x1b[0m');
    for (const h of ev.helpSignals) {
      console.log(`    ! ${h.reason ?? '(no reason)'}  · ${new Date(h.openedAt).toISOString()}`);
    }
  }
  console.log('\n  \x1b[33m[Sprint 4 UI]\x1b[0m mosaic grid + AI summary feed henuz hazir degil\n');
}
