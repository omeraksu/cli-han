import React from 'react';
import { Box, Text } from 'ink';
import type { FeedItem } from '../transport/protocol.js';
import { colors } from './colors.js';
import { SectionTitle } from './Layout.js';

interface Props {
  items: FeedItem[];
  maxItems?: number;
  streamerName?: string;
  duration?: string;
}

const ACTION_COLORS = [colors.success, colors.highlight, colors.info] as const;

/**
 * Broadcast feed matching figma frame 10:81 (left pane).
 *
 * `⟁` intent + cream headline, dim sub line, `▸` actions with rotating colors,
 * optional `⟁ next:` block at the bottom for the current focus.
 */
export function BroadcastFeed({
  items,
  maxItems = 5,
  streamerName,
  duration,
}: Props): React.JSX.Element {
  const visible = items.slice(-maxItems);
  const latest = visible[visible.length - 1];

  return (
    <Box flexDirection="column" flexGrow={1}>
      <SectionTitle
        label={streamerName ? `stream · ${streamerName}` : 'broadcast feed'}
        tail="feed"
      />

      {visible.length === 0 ? (
        <Box marginTop={1}>
          <Text color={colors.dim}>waiting for feed items…</Text>
        </Box>
      ) : (
        <Box flexDirection="column" marginTop={1}>
          {visible.slice(0, -1).map((item, idx) => (
            <FeedBlock key={`${item.ts}-${idx}`} item={item} />
          ))}
          {latest ? (
            <FeedBlock item={latest} duration={duration} showNext />
          ) : null}
        </Box>
      )}
    </Box>
  );
}

interface FeedBlockProps {
  item: FeedItem;
  duration?: string;
  showNext?: boolean;
}

function FeedBlock({ item, duration, showNext }: FeedBlockProps): React.JSX.Element {
  const subParts: string[] = [];
  if (duration) subParts.push(duration);
  if (item.mood) subParts.push(`in ${item.mood}`);
  const sub = subParts.join(' · ');

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text color={colors.foreground}>{`⟁ ${item.headline}`}</Text>
      {sub ? <Text color={colors.dim}>{`  ${sub}`}</Text> : null}
      {item.actions.map((action, ai) => (
        <Text key={`${item.ts}-action-${ai}`} color={ACTION_COLORS[ai % ACTION_COLORS.length]}>
          {`▸ ${action}`}
        </Text>
      ))}
      {showNext && item.current_focus ? (
        <Box flexDirection="column" marginTop={1}>
          <Text color={colors.foreground}>{`⟁ next: ${item.current_focus}`}</Text>
          {item.mood ? <Text color={colors.dim}>{`  mood: ${item.mood}`}</Text> : null}
        </Box>
      ) : null}
    </Box>
  );
}
