import React, { useEffect, useMemo, useState } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import { colors } from '../ui/colors.js';

export interface MosaicTile {
  sessionId: string;
  teamLabel: string;
  streamerWallet: string;
  lastActivity: number;
  lastSnippet?: string;
  helpOpen?: boolean;
}

export interface MosaicTeam {
  id: string;
  slug: string;
  name: string;
}

export interface MosaicSnapshot {
  eventId: string;
  eventSlug: string;
  title: string;
  teams: MosaicTeam[];
  tiles: MosaicTile[];
}

interface Props {
  initial: MosaicSnapshot;
  /** Subscribe to live tile updates. Returns unsubscribe. */
  subscribe: (cb: (next: MosaicTile) => void) => () => void;
  onExit?: () => void;
}

function ageLabel(ts: number, now: number = Date.now()): string {
  const s = Math.floor((now - ts) / 1000);
  if (s < 5) return 'now';
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h`;
}

function applyTileUpdate(tiles: MosaicTile[], next: MosaicTile): MosaicTile[] {
  const idx = tiles.findIndex((t) => t.sessionId === next.sessionId);
  if (idx === -1) return [next, ...tiles];
  const merged = [...tiles];
  merged[idx] = { ...merged[idx]!, ...next };
  return merged;
}

const TILE_W = 36;

export function MosaicView({ initial, subscribe, onExit }: Props): React.ReactElement {
  const { exit } = useApp();
  const [tiles, setTiles] = useState<MosaicTile[]>(initial.tiles);
  const [now, setNow] = useState<number>(Date.now());
  const [focusIdx, setFocusIdx] = useState(0);

  useEffect(() => {
    const off = subscribe((next) => {
      setTiles((prev) => applyTileUpdate(prev, next));
    });
    return off;
  }, [subscribe]);

  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);

  useInput((input, key) => {
    if (input === 'q' || key.escape) {
      onExit?.();
      exit();
      return;
    }
    if (key.leftArrow) setFocusIdx((i) => Math.max(0, i - 1));
    if (key.rightArrow) setFocusIdx((i) => Math.min(tiles.length - 1, i + 1));
    if (key.upArrow) setFocusIdx((i) => Math.max(0, i - 3));
    if (key.downArrow) setFocusIdx((i) => Math.min(tiles.length - 1, i + 3));
  });

  const liveCount = useMemo(
    () => tiles.filter((t) => now - t.lastActivity < 30_000).length,
    [tiles, now],
  );
  const helpCount = useMemo(() => tiles.filter((t) => t.helpOpen).length, [tiles]);

  // 3-column grid layout — matches deck slide 06 ("the mosaic").
  const rows: MosaicTile[][] = [];
  for (let i = 0; i < tiles.length; i += 3) rows.push(tiles.slice(i, i + 3));

  return (
    <Box flexDirection="column">
      <Box paddingX={1} paddingY={1}>
        <Text color={colors.dim}>/ </Text>
        <Text color={colors.amber} bold>
          watch · {initial.eventSlug}
        </Text>
        <Text color={colors.dim}>  ·  </Text>
        <Text color={colors.cream}>{initial.title}</Text>
      </Box>

      <Box paddingX={1} marginBottom={1}>
        <Text color={colors.teal}>{liveCount}</Text>
        <Text color={colors.dim}> live  ·  </Text>
        <Text color={helpCount > 0 ? colors.ember : colors.dim}>{helpCount}</Text>
        <Text color={colors.dim}> help open  ·  </Text>
        <Text color={colors.cream}>{tiles.length}</Text>
        <Text color={colors.dim}> tiles  ·  </Text>
        <Text color={colors.dim}>{initial.teams.length} teams enrolled</Text>
      </Box>

      {tiles.length === 0 ? (
        <Box paddingX={1}>
          <Text color={colors.dim}>(no live streams yet — waiting…)</Text>
        </Box>
      ) : (
        rows.map((row, ri) => (
          <Box key={ri} flexDirection="row" paddingX={1}>
            {row.map((tile) => {
              const i = ri * 3 + row.indexOf(tile);
              const focused = i === focusIdx;
              const age = ageLabel(tile.lastActivity, now);
              const stale = now - tile.lastActivity > 30_000;
              return (
                <Box
                  key={tile.sessionId}
                  width={TILE_W}
                  flexDirection="column"
                  borderStyle={focused ? 'double' : 'single'}
                  borderColor={focused ? colors.ember : stale ? colors.smoke : colors.teal}
                  paddingX={1}
                  marginRight={1}
                >
                  <Box>
                    <Text color={colors.cream} bold>
                      {tile.teamLabel.padEnd(20).slice(0, 20)}
                    </Text>
                    {tile.helpOpen ? (
                      <Text color={colors.ember} bold>
                        {' '}● help
                      </Text>
                    ) : (
                      <Text color={colors.dim}> · {age}</Text>
                    )}
                  </Box>
                  <Text color={colors.dim}>
                    {tile.streamerWallet.slice(0, 10)}…
                  </Text>
                  <Text color={stale ? colors.dim : colors.amber}>
                    {(tile.lastSnippet ?? '(idle)').slice(0, TILE_W - 4)}
                  </Text>
                </Box>
              );
            })}
          </Box>
        ))
      )}

      <Box paddingX={1} marginTop={1}>
        <Text color={colors.dim}>← → ↑ ↓ navigate · q / esc to exit</Text>
      </Box>
    </Box>
  );
}
