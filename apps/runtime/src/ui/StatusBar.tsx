import React from 'react';
import { Box, Text } from 'ink';
import { colors } from './colors.js';

export interface StatusBarMetrics {
  sessionCode?: string;
  isLive?: boolean;
  viewerCount?: number;
  tipUsdc?: number;
  chatUnread?: number;
  model?: string;
  spendUsd?: number;
  durationLabel?: string;

  tokensIn?: number;
  tokensOut?: number;
  filesTouched?: number;
  commandsRun?: number;
  peakViewers?: number;
}

interface Props {
  metrics: StatusBarMetrics;
  rich?: boolean;
  hint?: string;
}

function formatTokens(n: number): string {
  if (n < 1000) return `${n}`;
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}k`;
  return `${(n / 1_000_000).toFixed(1)}m`;
}

/**
 * Rich status bar matching figma frame 27:7.
 *
 * One-line mode shows the primary chips (host, live, viewers, tip, chat,
 * model, spend, duration). When `rich` is true, a dim second line surfaces
 * activity metrics (tokens, files, cmds, peak viewers) followed by an
 * optional hint like `press /stats`.
 */
export function StatusBar({ metrics, rich = false, hint }: Props): React.JSX.Element {
  const chips: React.ReactNode[] = [];

  chips.push(
    <Text key="brand" color={colors.foreground} bold>
      ▮ han
    </Text>
  );

  if (metrics.sessionCode) {
    chips.push(
      <Text key="code" color={colors.foreground}>
        {metrics.sessionCode}
      </Text>
    );
  }

  if (metrics.isLive != null) {
    chips.push(
      <Text key="live" color={metrics.isLive ? colors.success : colors.dim}>
        ◉ {metrics.isLive ? 'live' : 'offline'}
      </Text>
    );
  }

  if (metrics.viewerCount != null) {
    chips.push(
      <Text key="viewers" color={colors.foreground}>
        ◎ {metrics.viewerCount}
      </Text>
    );
  }

  if (metrics.tipUsdc != null && metrics.tipUsdc > 0) {
    chips.push(
      <Text key="tips" color={colors.foreground}>
        🔥 {metrics.tipUsdc.toFixed(2)} USDC
      </Text>
    );
  }

  if (metrics.chatUnread != null && metrics.chatUnread > 0) {
    chips.push(
      <Text key="chat" color={colors.accent}>
        💬 {metrics.chatUnread} new
      </Text>
    );
  }

  if (metrics.model) {
    chips.push(
      <Text key="model" color={colors.foreground}>
        ◆ {metrics.model}
      </Text>
    );
  }

  if (metrics.spendUsd != null) {
    chips.push(
      <Text key="spend" color={colors.foreground}>
        $ {metrics.spendUsd.toFixed(2)} spent
      </Text>
    );
  }

  if (metrics.durationLabel) {
    chips.push(
      <Text key="duration" color={colors.foreground}>
        ⏱ {metrics.durationLabel}
      </Text>
    );
  }

  const richParts: string[] = [];
  if (metrics.tokensIn != null) richParts.push(`${formatTokens(metrics.tokensIn)} tok in`);
  if (metrics.tokensOut != null) richParts.push(`${formatTokens(metrics.tokensOut)} out`);
  if (metrics.filesTouched != null) richParts.push(`${metrics.filesTouched} files touched`);
  if (metrics.commandsRun != null) richParts.push(`${metrics.commandsRun} cmds`);
  if (metrics.peakViewers != null) richParts.push(`peak ${metrics.peakViewers} viewers`);
  if (hint) richParts.push(hint);

  return (
    <Box flexDirection="column">
      <Box flexDirection="row" gap={2}>
        {chips}
      </Box>
      {rich && richParts.length > 0 ? (
        <Box>
          <Text color={colors.dim}>{richParts.join(' · ')}</Text>
        </Box>
      ) : null}
    </Box>
  );
}
