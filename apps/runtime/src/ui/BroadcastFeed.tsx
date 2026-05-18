import React from 'react';
import { Box, Text } from 'ink';
import type { FeedItem, SemanticEvent } from '../transport/protocol.js';
import { colors } from './colors.js';
import { SectionTitle } from './Layout.js';

interface Props {
  items: FeedItem[];
  semantic?: SemanticEvent[];
  maxItems?: number;
  streamerName?: string;
  duration?: string;
}

const ACTION_COLORS = [colors.success, colors.highlight, colors.info] as const;

/**
 * Broadcast feed.
 *
 * Two data sources:
 *  - `items` from the V1.5 summarizer (FeedItem with headline + actions)
 *  - `semantic` events emitted by the MCP transport (turn/tool_call/
 *    file_edit). Until the summarizer ships, semantic events drive the
 *    feed directly: the latest user turn becomes the `⟁` intent and
 *    subsequent tool calls / file edits show as `▸` actions.
 */
export function BroadcastFeed({
  items,
  semantic,
  maxItems = 5,
  streamerName,
  duration,
}: Props): React.JSX.Element {
  return (
    <Box flexDirection="column" flexGrow={1}>
      <SectionTitle
        label={streamerName ? `stream · ${streamerName}` : 'broadcast feed'}
        tail="feed"
      />

      {items.length > 0 ? (
        <SummaryView items={items} maxItems={maxItems} duration={duration} />
      ) : semantic && semantic.length > 0 ? (
        <SemanticView events={semantic.slice(-maxItems * 4)} />
      ) : (
        <Box marginTop={1}>
          <Text color={colors.dim}>waiting for feed items…</Text>
        </Box>
      )}
    </Box>
  );
}

function SummaryView({
  items,
  maxItems,
  duration,
}: {
  items: FeedItem[];
  maxItems: number;
  duration?: string;
}): React.JSX.Element {
  const visible = items.slice(-maxItems);
  const latest = visible[visible.length - 1];

  return (
    <Box flexDirection="column" marginTop={1}>
      {visible.slice(0, -1).map((item, idx) => (
        <FeedBlock key={`${item.ts}-${idx}`} item={item} />
      ))}
      {latest ? <FeedBlock item={latest} duration={duration} showNext /> : null}
    </Box>
  );
}

function FeedBlock({
  item,
  duration,
  showNext,
}: {
  item: FeedItem;
  duration?: string;
  showNext?: boolean;
}): React.JSX.Element {
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

function SemanticView({ events }: { events: SemanticEvent[] }): React.JSX.Element {
  // Group consecutive tool_calls / file_edits under the last `turn`
  // (or, if no turn has arrived yet, show them flat).
  type Block = { intent?: SemanticEvent & { type: 'turn' }; actions: SemanticEvent[] };
  const blocks: Block[] = [];
  let cur: Block | null = null;

  for (const event of events) {
    if (event.type === 'turn') {
      cur = { intent: event, actions: [] };
      blocks.push(cur);
    } else if (event.type === 'tool_call' || event.type === 'file_edit' || event.type === 'command_start' || event.type === 'command_end') {
      if (!cur) {
        cur = { actions: [] };
        blocks.push(cur);
      }
      cur.actions.push(event);
    }
  }

  return (
    <Box flexDirection="column" marginTop={1}>
      {blocks.slice(-5).map((block, bi) => (
        <Box key={`block-${bi}`} flexDirection="column" marginBottom={1}>
          {block.intent ? (
            <>
              <Text color={colors.foreground}>{`⟁ ${block.intent.role === 'user' ? 'asks' : 'replies'}: ${truncate(block.intent.content, 70)}`}</Text>
            </>
          ) : null}
          {block.actions.map((action, ai) => (
            <Text
              key={`block-${bi}-action-${ai}`}
              color={ACTION_COLORS[ai % ACTION_COLORS.length]}
            >
              {`▸ ${renderAction(action)}`}
            </Text>
          ))}
        </Box>
      ))}
    </Box>
  );
}

function renderAction(event: SemanticEvent): string {
  switch (event.type) {
    case 'tool_call':
      return event.argsSummary ? `${event.name} · ${event.argsSummary}` : event.name;
    case 'file_edit':
      return event.diffSummary ? `edited ${event.path} · ${event.diffSummary}` : `edited ${event.path}`;
    case 'command_start':
      return `ran ${event.command}`;
    case 'command_end':
      return event.exitCode === 0 ? 'done' : `exited ${event.exitCode}`;
    default:
      return '·';
  }
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + '…';
}
