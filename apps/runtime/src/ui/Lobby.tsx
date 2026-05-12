import React from 'react';
import { Box, Text } from 'ink';
import type { LobbySession } from '../transport/protocol.js';
import { colors } from './colors.js';

interface Props {
  sessions: LobbySession[];
  selectedIndex?: number;
  shellPrompt?: string;
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

/**
 * Lobby browse screen matching figma frame 10:51.
 *
 * Shell prompt + `▮ open hans · N streams live` header, then a list of
 * rounded cards with name (cream bold), description (cream), stats (dim),
 * and tip total (ember bold) on the right. Footer hint in info teal.
 */
export function Lobby({
  sessions,
  selectedIndex,
  shellPrompt = '~/  $ han browse',
}: Props): React.JSX.Element {
  return (
    <Box flexDirection="column" paddingY={1} paddingX={2}>
      <Box>
        <Text color={colors.foreground}>{shellPrompt}</Text>
      </Box>
      <Box marginTop={1}>
        <Text color={colors.accent} bold>
          ▮ open hans · {sessions.length} streams live
        </Text>
      </Box>
      {sessions.length === 0 ? (
        <Box marginTop={2}>
          <Text color={colors.dim}>quiet for now — no streams live</Text>
        </Box>
      ) : (
        <Box flexDirection="column" marginTop={1}>
          {sessions.map((session, i) => (
            <LobbyCard key={session.id} session={session} selected={i === selectedIndex} />
          ))}
        </Box>
      )}
      <Box marginTop={1}>
        <Text color={colors.info}>$ han connect &lt;name&gt;</Text>
        <Text color={colors.dim}>{'   to enter'}</Text>
      </Box>
    </Box>
  );
}
