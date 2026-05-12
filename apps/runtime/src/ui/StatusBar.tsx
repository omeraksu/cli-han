import React from 'react';
import { Box, Text } from 'ink';
import { colors } from './colors.js';

interface Props {
  viewerCount: number;
  mode: 'feed' | 'raw';
  chatUnread: number;
  sessionCode?: string;
}

export function StatusBar({ viewerCount, mode, chatUnread, sessionCode }: Props): React.JSX.Element {
  return (
    <Box borderStyle="single" borderColor={colors.primary} paddingX={1}>
      <Text color={colors.primary} bold>[HAN]</Text>
      {sessionCode != null && (
        <>
          <Text color={colors.dim}> session:</Text>
          <Text color={colors.secondary}>{sessionCode}</Text>
        </>
      )}
      <Text color={colors.dim}> | viewers:</Text>
      <Text color={colors.secondary}>{viewerCount}</Text>
      <Text color={colors.dim}> | mode:</Text>
      <Text color={mode === 'raw' ? colors.error : colors.success}>
        {mode.toUpperCase()}
      </Text>
      <Text color={colors.dim}> | chat:</Text>
      <Text color={chatUnread > 0 ? colors.primary : colors.dim}>
        {chatUnread} unread
      </Text>
    </Box>
  );
}
