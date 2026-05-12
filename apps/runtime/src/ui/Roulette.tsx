import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Box, Text, useInput } from 'ink';
import { colors } from './colors.js';

interface Dare {
  label: string;
  lines: [string, string];
}

const DARES: Dare[] = [
  { label: 'COMMIT', lines: ['"make your next commit', ' in the next 5 minutes"'] },
  { label: 'PUSH', lines: ['"push your branch', ' before the next prompt"'] },
  { label: 'BREAK', lines: ['"step away from the keyboard', ' for 5 minutes"'] },
  { label: 'WATER', lines: ['"drink a glass of water', ' before next prompt"'] },
  { label: 'DOCS', lines: ['"write a one-line comment', ' above that function"'] },
  { label: 'TEST', lines: ['"write one assertion', ' in the next 2 minutes"'] },
  { label: 'REFACTOR', lines: ['"rename one variable', ' for clarity"'] },
  { label: 'SHARE', lines: ['"post a screenshot', ' of what you just made"'] },
];

interface RouletteProps {
  onTip?: () => void;
  onQuit?: () => void;
  focused?: boolean;
}

/**
 * Solo roulette canvas matching figma frame 10:111.
 *
 * Static dare cards with a brief spin animation. No stake, no escrow —
 * V1 is a fun screen while the AI thinks. Game engine (multiplayer
 * variants) ships in V2 per ADR 2026-05-12-game-decoupled-ui.
 */
export function Roulette({ onTip, onQuit, focused = true }: RouletteProps): React.JSX.Element {
  const [index, setIndex] = useState(() => Math.floor(Math.random() * DARES.length));
  const [spinning, setSpinning] = useState(false);
  const tickerRef = useRef<NodeJS.Timeout | null>(null);

  const stopSpin = useCallback(() => {
    if (tickerRef.current) {
      clearInterval(tickerRef.current);
      tickerRef.current = null;
    }
    setSpinning(false);
  }, []);

  const spin = useCallback(() => {
    if (spinning) return;
    setSpinning(true);
    tickerRef.current = setInterval(() => {
      setIndex((i) => (i + 1) % DARES.length);
    }, 80);
    setTimeout(() => {
      stopSpin();
      setIndex(Math.floor(Math.random() * DARES.length));
    }, 1500);
  }, [spinning, stopSpin]);

  useEffect(() => () => stopSpin(), [stopSpin]);

  useInput(
    (input) => {
      const lower = input?.toLowerCase();
      if (lower === 'r') {
        spin();
        return;
      }
      if (lower === 't' && onTip) {
        onTip();
        return;
      }
      if (lower === 'q' && onQuit) {
        onQuit();
      }
    },
    { isActive: focused }
  );

  const dare = DARES[index] ?? DARES[0]!;

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Text color={colors.accent} bold>
        ▮ han · solo roulette
      </Text>
      <Box marginTop={1}>
        <Text color={colors.dim}>spin while claude is thinking.</Text>
      </Box>

      <Box
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        borderStyle="round"
        borderColor={colors.border}
        paddingX={4}
        paddingY={2}
        marginTop={2}
        marginBottom={2}
      >
        <Box>
          <Text color={colors.highlight} bold>
            ✦ &nbsp;{dare.label}&nbsp; ✦
          </Text>
        </Box>
        <Box marginTop={1} flexDirection="column" alignItems="center">
          <Text color={colors.foreground}>{dare.lines[0]}</Text>
          <Text color={colors.foreground}>{dare.lines[1]}</Text>
        </Box>
      </Box>

      <Text color={colors.info}>[ R ] spin again</Text>
      <Text color={colors.info}>[ T ] tip the host</Text>
      <Text color={colors.dim}>[ Q ] quit</Text>

      <Box marginTop={2}>
        <Text color={colors.dim}>→ free spin · no stake · just for fun</Text>
      </Box>
    </Box>
  );
}
