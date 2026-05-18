import React from 'react';
import { Box, Text } from 'ink';
import { colors } from './colors.js';
import type { TerminalSnapshot } from '../viewer/terminal-emulator.js';

interface Props {
  snapshot: TerminalSnapshot | null;
}

function isBlankSnapshot(s: TerminalSnapshot): boolean {
  for (const line of s.lines) {
    for (const run of line) {
      if (run.text.trim() !== '') return false;
    }
  }
  return true;
}

export function RawStream({ snapshot }: Props): React.JSX.Element {
  if (!snapshot || isBlankSnapshot(snapshot)) {
    return (
      <Box paddingY={1}>
        <Text color={colors.dim}>Waiting for stream...</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      {snapshot.lines.map((line, idx) => (
        <Box key={idx}>
          {line.map((run, ri) => (
            <Text
              key={ri}
              color={run.fg}
              backgroundColor={run.bg}
              bold={run.bold}
              italic={run.italic}
              underline={run.underline}
              inverse={run.inverse}
              dimColor={run.dim}
            >
              {run.text}
            </Text>
          ))}
        </Box>
      ))}
    </Box>
  );
}
