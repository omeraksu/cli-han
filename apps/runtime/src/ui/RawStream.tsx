import React from 'react';
import { Box, Text } from 'ink';
import { colors } from './colors.js';

interface Props {
  lines: string[];
  maxLines?: number;
}

export function RawStream({ lines, maxLines = 20 }: Props): React.JSX.Element {
  const visible = lines.slice(-maxLines);

  if (visible.length === 0) {
    return (
      <Box paddingY={1}>
        <Text color={colors.dim}>Waiting for raw stream...</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" paddingY={0}>
      {visible.map((line, idx) => (
        <Text key={idx}>{line}</Text>
      ))}
    </Box>
  );
}
