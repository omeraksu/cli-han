import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { HubContext } from '../ws/context.js';
import type { StreamEvent } from '../stream/cache.js';
import { logger } from '../logger.js';
import { renderReportPdf } from './report-pdf.js';

export interface FrictionPattern {
  pattern: string;
  count: number;
  affectedTeams: string[];
  sampleQuotes: string[];
}

export interface FrictionMap {
  eventId: string;
  totalSessions: number;
  totalEvents: number;
  totalTeams: number;
  avgSessionDurationMs: number;
  topPatterns: FrictionPattern[];
  toolBreakdown: Record<string, number>;
  generatedBy: 'anthropic' | 'heuristic';
}

// Heuristic patterns we look for in PTY stdout — drops below a real analyzer
// but enough to demo the report shape when ANTHROPIC_API_KEY is unset.
const HEURISTIC_PATTERNS: Array<{ key: string; pattern: string; regex: RegExp }> = [
  {
    key: 'compile-error',
    pattern: 'Compile / build errors',
    regex: /\b(error\[?E?\d*\]?:|cannot find|undefined reference|expected|unresolved|type mismatch)/i,
  },
  {
    key: 'anchor-cpi',
    pattern: 'Anchor CPI context confusion',
    regex: /CpiContext|cross[- ]program|invoke\(|invoke_signed/i,
  },
  {
    key: 'wormhole-bridge',
    pattern: 'Wormhole SDK failures',
    regex: /wormhole.*(fail|error|reject)/i,
  },
  {
    key: 'wallet-signing',
    pattern: 'Wallet / signing rejected',
    regex: /signature.*(invalid|reject|fail)|wallet.*(reject|disconnect)/i,
  },
  {
    key: 'gas-estimation',
    pattern: 'Gas / fee estimation issues',
    regex: /gas.*(estimat|exceed|out of)|insufficient (funds|balance)/i,
  },
  {
    key: 'rpc-timeout',
    pattern: 'RPC timeout / rate-limit',
    regex: /(429|rate.?limit|timeout|ECONNRESET|ETIMEDOUT)/i,
  },
  {
    key: 'env-config',
    pattern: 'Env / config not loading',
    regex: /(\.env|environment|process\.env).*(undefined|missing|not (set|found|loaded))/i,
  },
];

interface SessionDigest {
  sessionId: string;
  teamLabel: string;
  durationMs: number;
  events: StreamEvent[];
  textBlob: string;
}

async function loadEventSessions(ctx: HubContext, eventId: string): Promise<SessionDigest[]> {
  const rows = await ctx.db.session.findMany({
    where: { eventId },
    select: { id: true, teamLabel: true, startedAt: true, endedAt: true },
  });

  const digests: SessionDigest[] = [];
  for (const row of rows) {
    const cache = ctx.cache.get(row.id);
    const events = cache?.getAll() ?? [];
    const textBlob = events
      .map((e) => {
        if (e.type === 'stdout') return e.data;
        if (e.type === 'command_start') return `$ ${e.command}`;
        if (e.type === 'tool_call') return `[tool] ${e.name} ${e.argsSummary ?? ''}`;
        if (e.type === 'file_edit') return `[edit] ${e.path} ${e.diffSummary ?? ''}`;
        if (e.type === 'turn') return `[${e.role}] ${e.content}`;
        return '';
      })
      .join('\n');
    const end = row.endedAt ?? new Date();
    digests.push({
      sessionId: row.id,
      teamLabel: row.teamLabel ?? row.id,
      durationMs: end.getTime() - row.startedAt.getTime(),
      events,
      textBlob,
    });
  }
  return digests;
}

function heuristicFrictionMap(eventId: string, sessions: SessionDigest[]): FrictionMap {
  const patternHits = new Map<
    string,
    { pattern: string; teams: Set<string>; quotes: string[] }
  >();
  const toolBreakdown: Record<string, number> = {};

  for (const s of sessions) {
    for (const ev of s.events) {
      if (ev.type === 'tool_call') {
        toolBreakdown[ev.name] = (toolBreakdown[ev.name] ?? 0) + 1;
      }
    }
    for (const { key, pattern, regex } of HEURISTIC_PATTERNS) {
      const m = s.textBlob.match(regex);
      if (!m) continue;
      const entry = patternHits.get(key) ?? { pattern, teams: new Set(), quotes: [] };
      entry.teams.add(s.teamLabel);
      if (entry.quotes.length < 3) {
        const around = s.textBlob.slice(
          Math.max(0, (m.index ?? 0) - 40),
          (m.index ?? 0) + (m[0]?.length ?? 0) + 80,
        );
        entry.quotes.push(around.replace(/\s+/g, ' ').trim());
      }
      patternHits.set(key, entry);
    }
  }

  const topPatterns: FrictionPattern[] = [...patternHits.values()]
    .map((e) => ({
      pattern: e.pattern,
      count: e.teams.size,
      affectedTeams: [...e.teams],
      sampleQuotes: e.quotes,
    }))
    .sort((a, b) => b.count - a.count);

  const avgDuration =
    sessions.length === 0
      ? 0
      : sessions.reduce((acc, s) => acc + s.durationMs, 0) / sessions.length;
  const totalEvents = sessions.reduce((acc, s) => acc + s.events.length, 0);

  return {
    eventId,
    totalSessions: sessions.length,
    totalEvents,
    totalTeams: new Set(sessions.map((s) => s.teamLabel)).size,
    avgSessionDurationMs: avgDuration,
    topPatterns,
    toolBreakdown,
    generatedBy: 'heuristic',
  };
}

async function anthropicFrictionMap(
  eventId: string,
  sessions: SessionDigest[],
  apiKey: string,
): Promise<FrictionMap | null> {
  // Minimal direct call to avoid pulling @anthropic-ai/sdk for the MVP. Build
  // a compact corpus summary, ask Claude Sonnet 4.6 for structured friction
  // patterns. If anything fails, caller falls back to heuristic.
  const corpus = sessions
    .map(
      (s) =>
        `### ${s.teamLabel} (${Math.round(s.durationMs / 1000)}s, ${s.events.length} events)\n${s.textBlob.slice(0, 4000)}`,
    )
    .join('\n\n');

  const prompt = `You are a DX analyst. Read this hackathon/workshop corpus of N team terminal sessions. Output strict JSON with keys:
- topPatterns: array of { pattern: string, count: number, affectedTeams: string[], sampleQuotes: string[] }
- summary: one paragraph
Focus on technical friction (SDK errors, compile loops, wallet/RPC, gas, env config). No prose outside JSON.

CORPUS:
${corpus.slice(0, 60_000)}`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) {
      logger.warn({ status: res.status }, 'anthropic call failed, falling back to heuristic');
      return null;
    }
    const json = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
    const text = json.content?.find((c) => c.type === 'text')?.text ?? '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]) as {
      topPatterns: FrictionPattern[];
    };

    const avgDuration =
      sessions.length === 0
        ? 0
        : sessions.reduce((acc, s) => acc + s.durationMs, 0) / sessions.length;

    return {
      eventId,
      totalSessions: sessions.length,
      totalEvents: sessions.reduce((acc, s) => acc + s.events.length, 0),
      totalTeams: new Set(sessions.map((s) => s.teamLabel)).size,
      avgSessionDurationMs: avgDuration,
      topPatterns: parsed.topPatterns ?? [],
      toolBreakdown: {},
      generatedBy: 'anthropic',
    };
  } catch (err) {
    logger.warn({ err }, 'anthropic call threw, falling back to heuristic');
    return null;
  }
}

export async function generateCorpusReport(
  ctx: HubContext,
  eventId: string,
): Promise<{ frictionMap: FrictionMap; pdfPath: string }> {
  const event = await ctx.db.event.findUnique({ where: { id: eventId } });
  if (!event) throw new Error(`event ${eventId} not found`);

  const sessions = await loadEventSessions(ctx, eventId);

  const apiKey = process.env['ANTHROPIC_API_KEY'];
  let frictionMap: FrictionMap | null = null;
  if (apiKey) {
    frictionMap = await anthropicFrictionMap(eventId, sessions, apiKey);
  }
  if (!frictionMap) {
    frictionMap = heuristicFrictionMap(eventId, sessions);
  }

  const outDir = join(process.cwd(), 'corpus-reports');
  mkdirSync(outDir, { recursive: true });
  const pdfPath = join(outDir, `${event.slug}-${Date.now()}.pdf`);
  await renderReportPdf({ event, frictionMap, pdfPath });

  // Also write the raw friction map JSON next to the PDF for inspection
  writeFileSync(
    pdfPath.replace(/\.pdf$/, '.json'),
    JSON.stringify({ event: { slug: event.slug, title: event.title }, frictionMap }, null, 2),
  );

  logger.info({ eventId, pdfPath, generatedBy: frictionMap.generatedBy }, 'corpus report ready');
  return { frictionMap, pdfPath };
}
