import { writeFileSync } from 'node:fs';

import type { FrictionMap } from './analyzer.js';

interface EventRow {
  slug: string;
  title: string;
  organizerWallet: string;
  startsAt: Date;
  endsAt: Date | null;
}

// Brand foundation tokens (deck slide 02-03).
const BRAND = {
  ink: '#0E0E0E',
  ash: '#1A1816',
  smoke: '#2A2826',
  cream: '#EDE6D6',
  ember: '#E0633A',
  teal: '#5FA8A0',
  amber: '#E8C56B',
  monoFont: 'JetBrains Mono, ui-monospace, SFMono-Regular, monospace',
  bodyFont: 'Inter, system-ui, -apple-system, sans-serif',
} as const;

function fmtDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderHtml(event: EventRow, fm: FrictionMap): string {
  const patternsRows = fm.topPatterns
    .map(
      (p) => `
    <section class="pattern">
      <h3>${escapeHtml(p.pattern)}</h3>
      <div class="meta">${p.count} team affected · ${p.affectedTeams.length} session</div>
      <ul class="teams">${p.affectedTeams.map((t) => `<li>${escapeHtml(t)}</li>`).join('')}</ul>
      ${
        p.sampleQuotes.length > 0
          ? `<pre class="quotes">${p.sampleQuotes.map((q) => `> ${escapeHtml(q)}`).join('\n')}</pre>`
          : ''
      }
    </section>`,
    )
    .join('');

  const toolRows = Object.entries(fm.toolBreakdown)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([name, count]) => `<tr><td>${escapeHtml(name)}</td><td>${count}</td></tr>`)
    .join('');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Han · Build Corpus Report · ${escapeHtml(event.title)}</title>
<style>
  :root {
    --ink: ${BRAND.ink};
    --ash: ${BRAND.ash};
    --smoke: ${BRAND.smoke};
    --cream: ${BRAND.cream};
    --ember: ${BRAND.ember};
    --teal: ${BRAND.teal};
    --amber: ${BRAND.amber};
    --mono: ${BRAND.monoFont};
    --body: ${BRAND.bodyFont};
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 60px 80px;
    background: var(--ink);
    color: var(--cream);
    font-family: var(--body);
    font-size: 14px;
    line-height: 1.55;
  }
  .wm {
    font-family: var(--mono);
    font-size: 12px;
    opacity: 0.55;
    letter-spacing: 0.04em;
    margin-bottom: 8px;
  }
  h1 {
    font-family: var(--mono);
    font-size: 36px;
    font-weight: 600;
    margin: 0 0 8px 0;
    color: var(--cream);
  }
  h2 {
    font-family: var(--mono);
    font-size: 16px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--amber);
    margin: 48px 0 16px 0;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--smoke);
  }
  h3 {
    font-family: var(--mono);
    font-size: 18px;
    margin: 0 0 6px 0;
    color: var(--ember);
  }
  .subtitle { color: var(--teal); margin-bottom: 32px; font-family: var(--mono); }
  .stats {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 24px;
    margin: 32px 0;
  }
  .stat {
    background: var(--ash);
    border: 1px solid var(--smoke);
    padding: 20px 24px;
  }
  .stat .v { font-family: var(--mono); font-size: 28px; color: var(--cream); }
  .stat .k { font-size: 12px; opacity: 0.7; margin-top: 4px; }
  .pattern {
    background: var(--ash);
    border-left: 3px solid var(--ember);
    padding: 18px 24px;
    margin-bottom: 16px;
  }
  .pattern .meta { font-family: var(--mono); font-size: 12px; opacity: 0.7; margin-bottom: 10px; }
  .teams { list-style: none; padding: 0; margin: 0 0 12px 0; display: flex; flex-wrap: wrap; gap: 8px; }
  .teams li {
    font-family: var(--mono);
    font-size: 11px;
    background: var(--smoke);
    padding: 3px 10px;
    border-radius: 999px;
  }
  .quotes {
    font-family: var(--mono);
    font-size: 11px;
    color: var(--amber);
    background: var(--ink);
    padding: 10px 14px;
    border: 1px solid var(--smoke);
    overflow-x: auto;
    white-space: pre-wrap;
    margin: 0;
  }
  table { width: 100%; border-collapse: collapse; font-family: var(--mono); font-size: 13px; }
  td { padding: 6px 12px; border-bottom: 1px solid var(--smoke); }
  td:last-child { text-align: right; color: var(--teal); }
  footer {
    margin-top: 64px;
    font-family: var(--mono);
    font-size: 11px;
    opacity: 0.5;
    border-top: 1px solid var(--smoke);
    padding-top: 16px;
  }
  .badge {
    display: inline-block;
    font-family: var(--mono);
    font-size: 11px;
    padding: 3px 10px;
    background: ${fm.generatedBy === 'anthropic' ? BRAND.teal : BRAND.amber};
    color: ${BRAND.ink};
    border-radius: 2px;
    margin-left: 12px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
</style>
</head>
<body>
  <div class="wm">▮ han · build corpus report</div>
  <h1>${escapeHtml(event.title)} <span class="badge">${fm.generatedBy}</span></h1>
  <div class="subtitle">/ ${escapeHtml(event.slug)} · ${event.startsAt.toISOString().slice(0, 10)} → ${event.endsAt?.toISOString().slice(0, 10) ?? 'live'}</div>

  <h2>01 · the receipts</h2>
  <div class="stats">
    <div class="stat"><div class="v">${fm.totalTeams}</div><div class="k">teams</div></div>
    <div class="stat"><div class="v">${fm.totalSessions}</div><div class="k">sessions captured</div></div>
    <div class="stat"><div class="v">${fm.totalEvents}</div><div class="k">structured events</div></div>
    <div class="stat"><div class="v">${fmtDuration(fm.avgSessionDurationMs)}</div><div class="k">avg session</div></div>
  </div>

  <h2>02 · where the build hit friction</h2>
  ${
    fm.topPatterns.length === 0
      ? '<p style="opacity:0.7;font-style:italic">No friction patterns surfaced. Either the corpus is too thin, or the build went unusually smooth — both warrant a second look.</p>'
      : patternsRows
  }

  ${
    Object.keys(fm.toolBreakdown).length > 0
      ? `<h2>03 · tool calls observed</h2><table>${toolRows}</table>`
      : ''
  }

  <footer>
    Generated by Han · cli-han.dev · ${new Date().toISOString()}<br/>
    organizer: ${escapeHtml(event.organizerWallet)}<br/>
    This report compounds with every event you run on han.
  </footer>
</body>
</html>`;
}

export async function renderReportPdf(args: {
  event: EventRow;
  frictionMap: FrictionMap;
  pdfPath: string;
}): Promise<void> {
  const html = renderHtml(args.event, args.frictionMap);
  const htmlPath = args.pdfPath.replace(/\.pdf$/, '.html');
  writeFileSync(htmlPath, html, 'utf-8');

  // Real PDF conversion (puppeteer / @react-pdf/renderer) lands in Sprint 8.
  // For the MVP we ship the HTML at the .pdf path so the caller has a stable
  // download URL contract — the organizer can print-to-PDF from a browser.
  writeFileSync(args.pdfPath, html, 'utf-8');
}
