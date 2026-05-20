export const HAN_HUB_URL = process.env.HAN_HUB_URL ?? 'http://localhost:3001';

export interface EventDetail {
  id: string;
  slug: string;
  title: string;
  organizerWallet: string;
  status: string;
  plan: string;
  startsAt: string;
  endsAt: string | null;
  brand?: { accent?: string; logo?: string } | null;
  members: Array<{ wallet: string; role: string; acceptedAt: string | null }>;
  teams: Array<{
    id: string;
    slug: string;
    name: string;
    _count: { members: number; submissions: number };
  }>;
  sessions: Array<{
    id: string;
    streamerWallet: string;
    teamLabel: string | null;
    startedAt: string;
    endedAt: string | null;
  }>;
  submissions: Array<{
    id: string;
    teamLabel: string;
    title: string;
    summary: string | null;
    repoUrl: string | null;
    demoUrl: string | null;
    anchorTxHash: string | null;
    submittedAt: string;
  }>;
  helpSignals: Array<{
    id: string;
    reason: string | null;
    openedAt: string;
    closedAt: string | null;
  }>;
}

export async function fetchEvent(slug: string): Promise<EventDetail | null> {
  try {
    const res = await fetch(`${HAN_HUB_URL}/events/${slug}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as EventDetail;
  } catch {
    return null;
  }
}
