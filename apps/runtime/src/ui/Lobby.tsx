import React from 'react';
import { Box, Text } from 'ink';
import type { LobbySession } from '../transport/protocol.js';
import { colors } from './colors.js';

interface Props {
  sessions: LobbySession[];
}

function timeAgo(startedAt: number): string {
  const secs = Math.floor((Date.now() - startedAt) / 1000);
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  return `${Math.floor(secs / 3600)}h ago`;
}

export function Lobby({ sessions }: Props): React.JSX.Element {
  if (sessions.length === 0) {
    return (
      <Box paddingY={1}>
        <Text color={colors.dim}>Su an aktif yayin yok.</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" paddingY={1}>
      <Text color={colors.primary} bold>Active Streams</Text>
      <Text> </Text>
      {sessions.map((s) => (
        <Box key={s.id} flexDirection="row" gap={2} paddingY={0}>
          <Text color={colors.secondary} bold>[{s.code}]</Text>
          <Text color={colors.dim}>viewers:</Text>
          <Text>{s.viewerCount}</Text>
          <Text color={colors.dim}>|</Text>
          <Text color={colors.dim}>{timeAgo(s.startedAt)}</Text>
        </Box>
      ))}
      <Text> </Text>
      <Text color={colors.dim}>Run: han connect {'<code>'}</Text>
    </Box>
  );
}
