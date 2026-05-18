import React, { useState, useMemo } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import type { LobbySession } from '../transport/protocol.js';
import { colors } from './colors.js';

export type LobbySort = 'viewers' | 'tips' | 'newest';

interface Props {
  sessions: LobbySession[];
  selectedIndex?: number;
  shellPrompt?: string;
  /**
   * If true, attach keyboard navigation (↑↓ select, / filter, s sort,
   * ENTER connect). Defaults to false for static snapshot rendering.
   */
  interactive?: boolean;
  onSelect?: (session: LobbySession) => void;
}

function timeAgo(ts: number, now: number = Date.now()): string {
  const secs = Math.floor((now - ts) / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}min`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return remMins === 0 ? `${hours}h` : `${hours}h${remMins}min`;
}

function formatSol(n?: number): string {
  if (n == null || Number.isNaN(n)) return '0.0';
  if (n === 0) return '0.0';
  if (n < 0.01) return n.toFixed(3);
  return n.toFixed(2);
}

interface CardProps {
  session: LobbySession;
  selected?: boolean;
}

function LobbyCard({ session, selected }: CardProps): React.JSX.Element {
  const name = session.streamerName ?? session.code;
  const description = session.description ?? '—';
  const toolSuffix = session.tool ? ` · ${session.tool}` : '';
  const stats = `${session.viewerCount} viewers · ${timeAgo(session.startedAt)}${toolSuffix}`;
  const tip = `🔥 ${formatSol(session.tipSol)} SOL`;

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={selected ? colors.accent : colors.border}
      paddingX={1}
      marginBottom={1}
    >
      <Box justifyContent="space-between">
        <Text color={colors.foreground} bold>
          {name}
        </Text>
        <Text color={colors.accent} bold>
          {tip}
        </Text>
      </Box>
      <Text color={colors.foreground}>{description}</Text>
      <Text color={colors.dim}>{stats}</Text>
    </Box>
  );
}

function sortSessions(sessions: LobbySession[], sort: LobbySort): LobbySession[] {
  const copy = [...sessions];
  if (sort === 'viewers') {
    copy.sort((a, b) => b.viewerCount - a.viewerCount);
  } else if (sort === 'tips') {
    copy.sort((a, b) => (b.tipSol ?? 0) - (a.tipSol ?? 0));
  } else {
    copy.sort((a, b) => b.startedAt - a.startedAt);
  }
  return copy;
}

function matchesFilter(session: LobbySession, filter: string): boolean {
  if (!filter) return true;
  const needle = filter.toLowerCase();
  return (
    (session.streamerName ?? session.code).toLowerCase().includes(needle) ||
    (session.description ?? '').toLowerCase().includes(needle) ||
    (session.tool ?? '').toLowerCase().includes(needle)
  );
}

/**
 * Lobby browse screen matching figma frame 10:51.
 *
 * Shell prompt + `▮ open hans · N streams live` header, then a list of
 * rounded cards with name (cream bold), description (cream), stats (dim),
 * and tip total (ember bold) on the right. Footer hint in info teal.
 *
 * `interactive` mode adds keyboard nav: ↑↓ to move the cursor, ENTER to
 * connect, `/` to start a fuzzy filter, `s` to cycle sort, q/ESC to quit.
 */
export function Lobby({
  sessions,
  selectedIndex,
  shellPrompt = '~/  $ han browse',
  interactive = false,
  onSelect,
}: Props): React.JSX.Element {
  const [cursor, setCursor] = useState(selectedIndex ?? 0);
  const [sort, setSort] = useState<LobbySort>('newest');
  const [filter, setFilter] = useState('');
  const [filterMode, setFilterMode] = useState(false);
  const app = useApp();

  const visible = useMemo(
    () => sortSessions(sessions.filter((s) => matchesFilter(s, filter)), sort),
    [sessions, filter, sort],
  );

  useInput(
    (input, key) => {
      if (filterMode) {
        if (key.return || key.escape) {
          setFilterMode(false);
          return;
        }
        if (key.backspace || key.delete) {
          setFilter((s) => s.slice(0, -1));
          return;
        }
        if (input && !key.ctrl && !key.meta) {
          setFilter((s) => s + input);
        }
        return;
      }

      if (key.upArrow) {
        setCursor((c) => Math.max(0, c - 1));
        return;
      }
      if (key.downArrow) {
        setCursor((c) => Math.min(Math.max(visible.length - 1, 0), c + 1));
        return;
      }
      if (key.return) {
        const picked = visible[cursor];
        if (picked && onSelect) onSelect(picked);
        return;
      }
      if (input === '/') {
        setFilterMode(true);
        return;
      }
      if (input?.toLowerCase() === 's') {
        const cycle: LobbySort[] = ['newest', 'viewers', 'tips'];
        setSort((current) => cycle[(cycle.indexOf(current) + 1) % cycle.length] ?? 'newest');
        return;
      }
      if (input?.toLowerCase() === 'q' || key.escape) {
        app.exit();
      }
    },
    { isActive: interactive },
  );

  return (
    <Box flexDirection="column" paddingY={1} paddingX={2}>
      <Box>
        <Text color={colors.foreground}>{shellPrompt}</Text>
      </Box>
      <Box marginTop={1} justifyContent="space-between">
        <Text color={colors.accent} bold>
          ▮ open hans · {visible.length} of {sessions.length} live
        </Text>
        {interactive ? (
          <Text color={colors.dim}>
            sort: {sort}
            {filter ? ` · /${filter}` : ''}
          </Text>
        ) : null}
      </Box>
      {visible.length === 0 ? (
        <Box marginTop={2}>
          <Text color={colors.dim}>
            {sessions.length === 0 ? 'quiet for now — no streams live' : 'no match'}
          </Text>
        </Box>
      ) : (
        <Box flexDirection="column" marginTop={1}>
          {visible.map((session, i) => (
            <LobbyCard
              key={session.id}
              session={session}
              selected={interactive ? i === cursor : i === selectedIndex}
            />
          ))}
        </Box>
      )}
      {interactive ? (
        <Box marginTop={1}>
          {filterMode ? (
            <Text color={colors.accent} bold>
              / {filter}
              <Text inverse> </Text>{' '}
              <Text color={colors.dim}>ENTER to finish</Text>
            </Text>
          ) : (
            <Text color={colors.info}>
              [ ↑↓ ] nav  [ ENTER ] connect  [ / ] filter  [ S ] sort  [ Q ] quit
            </Text>
          )}
        </Box>
      ) : (
        <Box marginTop={1}>
          <Text color={colors.info}>$ han connect &lt;name&gt;</Text>
          <Text color={colors.dim}>{'   to enter'}</Text>
        </Box>
      )}
    </Box>
  );
}
