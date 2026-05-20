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
  if (args.action !== 'start') {
    console.error(`[workshop] bilinmeyen aksiyon: ${args.action}. Su an sadece 'start' destekleniyor`);
    process.exit(1);
  }
  if (!args.slug) {
    console.error('[workshop] event slug gerek: han workshop start <slug>');
    process.exit(1);
  }
  const { startWorkshopUi } = await import('./workshop-ui.js');
  await startWorkshopUi({ hubUrl: args.hubUrl, eventSlug: args.slug });
}

export async function runWatchStub(args: CommonArgs & { eventSlug?: string }): Promise<void> {
  if (!args.eventSlug) {
    console.error('[watch] event slug gerek: han watch --event <slug>');
    process.exit(1);
  }
  const { startMosaicUi } = await import('./mosaic-ui.js');
  await startMosaicUi({ hubUrl: args.hubUrl, eventSlug: args.eventSlug });
}
