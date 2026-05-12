import React from 'react';
import { Box, Text } from 'ink';
import type { FeedItem } from '../transport/protocol.js';
import { colors } from './colors.js';

interface Props {
  items: FeedItem[];
  maxItems?: number;
}

const MOOD_EMOJI: Record<string, string> = {
  stuck: '😤',
  coding: '💻',
  thinking: '🤔',
  debugging: '🐛',
  testing: '🧪',
  reviewing: '👀',
  shipping: '🚀',
};

function moodEmoji(mood: string): string {
  return MOOD_EMOJI[mood.toLowerCase()] ?? '⚡';
}

export function BroadcastFeed({ items, maxItems = 5 }: Props): React.JSX.Element {
  const visible = items.slice(-maxItems);

  if (visible.length === 0) {
    return (
      <Box paddingY={1}>
        <Text color={colors.dim}>Waiting for feed items...</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" paddingY={1}>
      <Text color={colors.primary} bold>Broadcast Feed</Text>
      <Text> </Text>
      {visible.map((item, idx) => (
        <Box key={idx} flexDirection="column" marginBottom={1}>
          <Box flexDirection="row" gap={1}>
            <Text color={colors.dim}>[{new Date(item.ts).toLocaleTimeString()}]</Text>
            <Text>{moodEmoji(item.mood)}</Text>
            <Text color={colors.secondary} bold>{item.headline}</Text>
          </Box>
          {item.actions.length > 0 && (
            <Text color={colors.dim}>  {item.actions.join(' · ')}</Text>
          )}
          <Text color={colors.dim}>  Focus: {item.current_focus}</Text>
        </Box>
      ))}
    </Box>
  );
}
