import Link from 'next/link';

// Landing page — deck slide 01 (title) condensed.
// The full deck story is captured across /event/[slug] for organizers.
export default function HomePage(): React.ReactElement {
  return (
    <main className="mx-auto max-w-6xl px-6 pt-24 pb-32">
      <div className="wm-mono text-xs text-dim mb-3">
        / HAN · B2B · events · hackathons · workshops · 2026
      </div>

      <h1 className="font-mono tracking-tightish text-cream text-6xl leading-[1.05] font-semibold">
        han
        <br />
        <span className="text-ember">for hackathons</span>
        <br />
        <span className="text-ember">&amp; workshops</span>
      </h1>

      <p className="mt-10 max-w-3xl text-2xl text-cream font-sans">
        The terminal-native event layer for AI-native builders.
      </p>
      <p className="mt-4 max-w-3xl text-lg text-dim">
        We run the event. The build corpus and the builder graph stay yours.
        N teams streaming. M judges watching. 1 organizer in control. All in
        the terminal, branded for you.
      </p>

      <div className="mt-12 grid sm:grid-cols-2 gap-4 max-w-4xl">
        <div className="rounded-sm border border-smoke bg-ash px-6 py-5">
          <div className="section-title">try it now</div>
          <code className="block mt-3 wm-mono text-cream text-lg">
            $ npm i -g cli-han
          </code>
          <code className="block mt-1 wm-mono text-cream text-lg">
            $ han stream
          </code>
        </div>
        <div className="rounded-sm border border-smoke bg-ash px-6 py-5">
          <div className="section-title">organizers</div>
          <p className="mt-3 text-sm text-dim">
            Workshop · $1.2k · 1 instructor + 50 students
          </p>
          <p className="mt-1 text-sm text-dim">
            Hackathon · $12k · unlimited teams + branded subdomain
          </p>
          <p className="mt-1 text-sm text-dim">
            Ecosystem partner · $80k+/yr · multi-event intelligence
          </p>
          <p className="mt-3 wm-mono text-xs text-teal">talk → omar@cli-han.dev</p>
        </div>
      </div>

      <div className="mt-16 border-t border-smoke pt-6 wm-mono text-xs text-dim flex flex-wrap gap-x-6 gap-y-2">
        <span>runs in any format · online · hybrid · in-person</span>
        <span className="text-teal">no venue, no problem</span>
      </div>

      <div className="mt-2 wm-mono text-xs text-dim">
        try a sample event:{' '}
        <Link href="/event/sprint4-pilot-truefinal-1779257781" className="text-amber hover:text-ember">
          /event/sprint4-pilot-truefinal-1779257781
        </Link>
      </div>
    </main>
  );
}
