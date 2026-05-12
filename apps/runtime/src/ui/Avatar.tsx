import React from 'react';
import { createHash } from 'node:crypto';
import { Box, Text } from 'ink';
import { colors } from './colors.js';

const SYMBOLS = ['◆', '▮', '◇', '✦', '▲', '●', '○', '◐'] as const;
const PALETTE = [
  colors.accent,
  colors.highlight,
  colors.info,
  colors.foreground,
] as const;

function hashPubkey(pubkey: string): Buffer {
  return createHash('sha256').update(pubkey).digest();
}

interface RenderedCell {
  symbol: string;
  color: string;
}

/**
 * Deterministic mapping from a Solana pubkey to a 3×3 ASCII avatar.
 * Same pubkey always yields the same grid; symmetric on the horizontal
 * axis (Figma 26:20-26:23 etc) so it reads as a "portrait".
 */
export function avatarCells(pubkey: string): RenderedCell[] {
  const hash = hashPubkey(pubkey);
  // 3 rows × 2 unique columns (mirrored), so we only need 6 nibble pairs
  const cells: RenderedCell[] = [];
  for (let row = 0; row < 3; row++) {
    const left = hash[row * 2] ?? 0;
    const center = hash[row * 2 + 1] ?? 0;
    const leftCell = {
      symbol: SYMBOLS[left % SYMBOLS.length] ?? SYMBOLS[0]!,
      color: PALETTE[left % PALETTE.length] ?? PALETTE[0]!,
    };
    const centerCell = {
      symbol: SYMBOLS[center % SYMBOLS.length] ?? SYMBOLS[0]!,
      color: PALETTE[center % PALETTE.length] ?? PALETTE[0]!,
    };
    cells.push(leftCell, centerCell, leftCell);
  }
  return cells;
}

interface AvatarProps {
  pubkey: string;
  spacing?: number;
}

/**
 * 3×3 ASCII avatar rendered as ink Text rows.
 */
export function Avatar({ pubkey, spacing = 1 }: AvatarProps): React.JSX.Element {
  const cells = avatarCells(pubkey);
  const rows: RenderedCell[][] = [];
  for (let r = 0; r < 3; r++) {
    rows.push(cells.slice(r * 3, r * 3 + 3));
  }
  const gap = ' '.repeat(spacing);

  return (
    <Box flexDirection="column">
      {rows.map((row, ri) => (
        <Box key={`avatar-row-${ri}`}>
          {row.map((cell, ci) => (
            <React.Fragment key={`avatar-cell-${ri}-${ci}`}>
              <Text color={cell.color} bold>
                {cell.symbol}
              </Text>
              {ci < row.length - 1 ? <Text>{gap}</Text> : null}
            </React.Fragment>
          ))}
        </Box>
      ))}
    </Box>
  );
}
