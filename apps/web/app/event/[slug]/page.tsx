import { notFound } from 'next/navigation';
import { fetchEvent, HAN_HUB_URL } from '../../../lib/hub';
import { EventHallClient } from '../../../components/EventHallClient';

interface Params {
  params: Promise<{ slug: string }>;
}

export default async function EventHallPage({ params }: Params): Promise<React.ReactElement> {
  const { slug } = await params;
  const event = await fetchEvent(slug);
  if (!event) notFound();

  const accent = event.brand?.accent ?? '#E0633A';
  const planLabel: Record<string, string> = {
    workshop: 'workshop',
    hackathon: 'hackathon',
    ecosystem: 'ecosystem partner',
    'corpus-report': 'build corpus report',
  };

  return (
    <main className="mx-auto max-w-6xl px-6 pt-20 pb-32">
      <div className="wm-mono text-xs text-dim flex flex-wrap gap-x-4 mb-3">
        <span>/ {event.slug}</span>
        <span>·</span>
        <span style={{ color: accent }}>{planLabel[event.plan] ?? event.plan}</span>
        <span>·</span>
        <span>status: {event.status}</span>
      </div>

      <h1 className="font-mono text-5xl tracking-tightish text-cream font-semibold">
        {event.title}
      </h1>
      <p className="mt-4 text-dim wm-mono text-sm">
        {new Date(event.startsAt).toISOString().slice(0, 10)} →{' '}
        {event.endsAt ? new Date(event.endsAt).toISOString().slice(0, 10) : 'live'}
        {'  ·  '}
        organizer: {event.organizerWallet.slice(0, 10)}…
      </p>

      {/* Stats bar — live polled */}
      <EventHallClient slug={event.slug} hubUrl={HAN_HUB_URL} initial={event} />

      {/* Teams */}
      <section className="mt-12">
        <h2 className="section-title">teams enrolled</h2>
        {event.teams.length === 0 ? (
          <p className="mt-4 text-dim">No teams yet. Organizer is still inviting.</p>
        ) : (
          <div className="mt-4 grid sm:grid-cols-2 md:grid-cols-3 gap-3">
            {event.teams.map((t) => (
              <div
                key={t.id}
                className="rounded-sm border border-smoke bg-ash px-5 py-4"
              >
                <div className="wm-mono text-xs text-dim">{t.slug}</div>
                <div className="font-mono text-cream text-lg mt-1">{t.name}</div>
                <div className="wm-mono text-xs text-teal mt-3">
                  {t._count.members} members · {t._count.submissions} submissions
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Live sessions */}
      <section className="mt-12">
        <h2 className="section-title">live lobby</h2>
        {event.sessions.length === 0 ? (
          <p className="mt-4 text-dim">No live streams. Builders connect with `han stream --event {event.slug} --team &lt;slug&gt;`.</p>
        ) : (
          <ul className="mt-4 divide-y divide-smoke border border-smoke rounded-sm bg-ash">
            {event.sessions.slice(0, 12).map((s) => (
              <li key={s.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <span
                    className={`wm-mono text-xs mr-3 ${
                      s.endedAt ? 'text-dim' : 'text-teal'
                    }`}
                  >
                    {s.endedAt ? '○ ended' : '● live'}
                  </span>
                  <span className="font-mono text-cream">{s.teamLabel ?? s.id}</span>
                </div>
                <span className="wm-mono text-xs text-dim">
                  {s.streamerWallet.slice(0, 10)}…  ·  {new Date(s.startedAt).toLocaleTimeString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Submissions */}
      <section className="mt-12">
        <h2 className="section-title">submission archive</h2>
        {event.submissions.length === 0 ? (
          <p className="mt-4 text-dim">No submissions yet.</p>
        ) : (
          <div className="mt-4 grid md:grid-cols-2 gap-4">
            {event.submissions.map((s) => (
              <article
                key={s.id}
                className="rounded-sm border border-smoke bg-ash px-5 py-5"
              >
                <div className="wm-mono text-xs text-dim">{s.teamLabel}</div>
                <h3 className="font-mono text-cream text-xl mt-1">{s.title}</h3>
                {s.summary ? (
                  <p className="mt-3 text-sm text-cream">{s.summary}</p>
                ) : null}
                <div className="mt-3 wm-mono text-xs flex flex-wrap gap-x-4 gap-y-1 text-teal">
                  {s.repoUrl ? (
                    <a href={s.repoUrl} className="hover:text-ember">
                      repo →
                    </a>
                  ) : null}
                  {s.demoUrl ? (
                    <a href={s.demoUrl} className="hover:text-ember">
                      demo →
                    </a>
                  ) : null}
                  {s.anchorTxHash ? (
                    <span className="text-amber">
                      anchor: {s.anchorTxHash.slice(0, 10)}…
                    </span>
                  ) : (
                    <span className="text-dim">anchor: pending (sprint 6)</span>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Help signals */}
      {event.helpSignals.filter((h) => !h.closedAt).length > 0 ? (
        <section className="mt-12">
          <h2 className="section-title text-ember">open help signals</h2>
          <ul className="mt-4 divide-y divide-smoke border border-ember rounded-sm bg-ash">
            {event.helpSignals
              .filter((h) => !h.closedAt)
              .slice(0, 6)
              .map((h) => (
                <li key={h.id} className="px-5 py-3 wm-mono text-xs flex justify-between">
                  <span className="text-ember">! {h.reason ?? '(no reason)'}</span>
                  <span className="text-dim">
                    {new Date(h.openedAt).toLocaleTimeString()}
                  </span>
                </li>
              ))}
          </ul>
        </section>
      ) : null}

      <footer className="mt-24 border-t border-smoke pt-6 wm-mono text-xs text-dim">
        Powered by Han · cli-han.dev · The build corpus and the builder graph stay yours.
      </footer>
    </main>
  );
}
