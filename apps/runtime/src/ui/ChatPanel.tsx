import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { colors } from './colors.js';
import { SectionTitle } from './Layout.js';

export interface ChatMessage {
  id: string;
  user: string;
  text: string;
  ts: number;
}

export interface RateLimitState {
  remaining: number;
  resetAt: number;
}

interface ChatPanelProps {
  messages: ChatMessage[];
  onSend?: (text: string) => void;
  rateLimit?: RateLimitState;
  focused?: boolean;
  maxVisible?: number;
}

function formatAge(ts: number, now: number = Date.now()): string {
  const seconds = Math.floor((now - ts) / 1000);
  if (seconds < 30) return 'now';
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h`;
}

/**
 * Chat panel matching figma frame 10:81 (right pane).
 *
 * User+age line in teal bold, message body in cream with 2-space indent,
 * cursor row at the bottom (`>` ember + inverse space block).
 */
export function ChatPanel({
  messages,
  onSend,
  rateLimit,
  focused = true,
  maxVisible = 12,
}: ChatPanelProps): JSX.Element {
  const [draft, setDraft] = useState('');
  const visible = messages.slice(-maxVisible);
  const rateLimited = rateLimit ? rateLimit.remaining <= 0 && rateLimit.resetAt > Date.now() : false;

  useInput(
    (input, key) => {
      if (!onSend || rateLimited) return;
      if (key.return) {
        const text = draft.trim();
        if (text) {
          onSend(text);
          setDraft('');
        }
        return;
      }
      if (key.backspace || key.delete) {
        setDraft((d) => d.slice(0, -1));
        return;
      }
      if (input && !key.ctrl && !key.meta && !key.escape) {
        setDraft((d) => d + input);
      }
    },
    { isActive: focused }
  );

  return (
    <Box flexDirection="column" flexGrow={1}>
      <SectionTitle label="chat" />
      <Box flexDirection="column" flexGrow={1} marginTop={1}>
        {visible.length === 0 ? (
          <Text color={colors.dim}>quiet for now…</Text>
        ) : (
          visible.map((m) => (
            <Box key={m.id} flexDirection="column" marginBottom={1}>
              <Box>
                <Text color={colors.info} bold>
                  {m.user}
                </Text>
                <Text color={colors.dim}>{`  ${formatAge(m.ts)}`}</Text>
              </Box>
              <Text color={colors.foreground}>{`  ${m.text}`}</Text>
            </Box>
          ))
        )}
      </Box>
      <Box marginTop={1}>
        {rateLimited && rateLimit ? (
          <Text color={colors.dim}>
            rate limited — wait{' '}
            {Math.max(0, Math.ceil((rateLimit.resetAt - Date.now()) / 1000))}s
          </Text>
        ) : (
          <>
            <Text color={colors.accent} bold>
              {'>'}
            </Text>
            <Text color={colors.foreground}>{` ${draft}`}</Text>
            {focused ? (
              <Text color={colors.foreground} inverse>
                {' '}
              </Text>
            ) : null}
          </>
        )}
      </Box>
    </Box>
  );
}
