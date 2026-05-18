import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Box, Text, useInput } from 'ink';
import { colors } from './colors.js';

interface Nudge {
  label: string;
  short: string;
  lines: [string, string];
}

const NUDGES: Nudge[] = [
  {
    label: 'COMMIT',
    short: 'ship your next commit in 5 min',
    lines: ['"ship your next commit', ' in the next 5 minutes."'],
  },
  {
    label: 'STRETCH',
    short: 'stand up · 30 seconds',
    lines: ['"stand up from your chair', ' for 30 seconds."'],
  },
  {
    label: 'SIP',
    short: 'water or coffee break',
    lines: ['"grab water or coffee', ' before the next prompt."'],
  },
  {
    label: 'READ',
    short: 'skim one doc paragraph',
    lines: ['"skim one paragraph', ' of a doc you bookmarked."'],
  },
  {
    label: 'SHARE',
    short: 'paste a thought in the chat',
    lines: ['"paste a thought', ' into the chat."'],
  },
  {
    label: 'NUDGE',
    short: 'tip another builder · 0.01 SOL',
    lines: ['"tip another builder', ' 0.01 SOL right now."'],
  },
];

const SPIN_DURATION_MS = 1500;
const SPIN_TICK_MS = 80;
const SPIN_TICKS = Math.ceil(SPIN_DURATION_MS / SPIN_TICK_MS);

type Mode = 'idle' | 'spinning' | 'result' | 'wheel-info';

interface RouletteProps {
  onTip?: () => void;
  onShare?: (label: string) => void;
  onQuit?: () => void;
  focused?: boolean;
}

/**
 * Solo Roulette state machine matching figma 24:42 / 24:58 / 24:73 / 24:89.
 *
 * idle → spinning → result; wheel-info reachable from idle/result via [W].
 * No stake, no engine bağı — gameplay is just a 1.5s flicker before
 * landing on a random nudge from the 6-card wheel.
 */
export function Roulette({
  onTip,
  onShare,
  onQuit,
  focused = true,
}: RouletteProps): React.JSX.Element {
  const [mode, setMode] = useState<Mode>('idle');
  const [index, setIndex] = useState(0);
  const [spinTick, setSpinTick] = useState(0);
  const tickerRef = useRef<NodeJS.Timeout | null>(null);

  const stopSpin = useCallback(() => {
    if (tickerRef.current) {
      clearInterval(tickerRef.current);
      tickerRef.current = null;
    }
  }, []);

  const startSpin = useCallback(() => {
    if (mode === 'spinning') return;
    setMode('spinning');
    setSpinTick(0);
    let tick = 0;
    tickerRef.current = setInterval(() => {
      tick += 1;
      setSpinTick(tick);
      setIndex((i) => (i + 1) % NUDGES.length);
      if (tick >= SPIN_TICKS) {
        stopSpin();
        setIndex(Math.floor(Math.random() * NUDGES.length));
        setMode('result');
      }
    }, SPIN_TICK_MS);
  }, [mode, stopSpin]);

  useEffect(() => () => stopSpin(), [stopSpin]);

  useInput(
    (input, key) => {
      const lower = input?.toLowerCase();

      if (mode === 'spinning') {
        if (input === ' ' || key.return) {
          stopSpin();
          setIndex(Math.floor(Math.random() * NUDGES.length));
          setMode('result');
        }
        return;
      }

      if (mode === 'wheel-info') {
        if (lower === 'q' || key.escape || key.return || input === ' ') {
          setMode('idle');
        }
        return;
      }

      if (mode === 'idle') {
        if (input === ' ' || key.return || lower === 'r') {
          startSpin();
          return;
        }
        if (lower === 'w') {
          setMode('wheel-info');
          return;
        }
        if (lower === 'q' && onQuit) {
          onQuit();
        }
        return;
      }

      // mode === 'result'
      if (lower === 'r' || input === ' ') {
        startSpin();
        return;
      }
      if (lower === 't' && onTip) {
        onTip();
        return;
      }
      if (lower === 's' && onShare) {
        onShare(NUDGES[index]?.label ?? '');
        return;
      }
      if (lower === 'w') {
        setMode('wheel-info');
        return;
      }
      if (lower === 'q' && onQuit) {
        onQuit();
      }
    },
    { isActive: focused }
  );

  if (mode === 'wheel-info') {
    return <WheelInfo nudges={NUDGES} />;
  }

  const nudge = NUDGES[index] ?? NUDGES[0]!;

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Text color={colors.accent} bold>
        ▮ solo roulette{mode === 'spinning' ? ' · spinning' : mode === 'result' ? ' · result' : ''}
      </Text>
      {mode === 'idle' ? (
        <Box marginTop={1}>
          <Text color={colors.dim}>a quick spin between claude prompts.</Text>
        </Box>
      ) : null}

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
        {mode === 'idle' ? (
          <>
            <Box>
              <Text color={colors.dim} bold>
                ▮ ? ▮
              </Text>
            </Box>
            <Box marginTop={1}>
              <Text color={colors.foreground}>press SPACE to spin</Text>
            </Box>
          </>
        ) : null}

        {mode === 'spinning' ? (
          <SpinningWheel tick={spinTick} totalTicks={SPIN_TICKS} />
        ) : null}

        {mode === 'result' ? (
          <>
            <Box>
              <Text color={colors.highlight} bold>
                ✦ &nbsp;{nudge.label}&nbsp; ✦
              </Text>
            </Box>
            <Box marginTop={1} flexDirection="column" alignItems="center">
              <Text color={colors.foreground}>{nudge.lines[0]}</Text>
              <Text color={colors.foreground}>{nudge.lines[1]}</Text>
            </Box>
          </>
        ) : null}
      </Box>

      {mode === 'idle' ? (
        <>
          <Text color={colors.info}>[ SPACE ] spin</Text>
          <Text color={colors.info}>[ W ] see what's on the wheel</Text>
          <Text color={colors.dim}>[ Q ] back to hub</Text>
          <Box marginTop={2}>
            <Text color={colors.dim}>→ free · no stake · just a nudge</Text>
          </Box>
        </>
      ) : null}

      {mode === 'result' ? (
        <>
          <Text color={colors.info}>[ R ] spin again</Text>
          <Text color={colors.info}>[ T ] tip the host (0.05 SOL)</Text>
          <Text color={colors.info}>[ S ] share result in chat</Text>
          <Text color={colors.dim}>[ Q ] quit</Text>
        </>
      ) : null}

      {mode === 'spinning' ? (
        <Box marginTop={1}>
          <Text color={colors.dim}>press SPACE again to stop early</Text>
        </Box>
      ) : null}
    </Box>
  );
}

interface SpinningWheelProps {
  tick: number;
  totalTicks: number;
}

function SpinningWheel({ tick, totalTicks }: SpinningWheelProps): React.JSX.Element {
  const symbols = ['▮', '◆', '◇'];
  const row = Array.from({ length: 9 }).map(
    (_, i) => symbols[(i + tick) % symbols.length]
  );
  const progress = Math.min(1, tick / totalTicks);
  const totalCells = 24;
  const filled = Math.floor(progress * totalCells);
  const bar = `${'█'.repeat(filled)}${'░'.repeat(totalCells - filled)}`;

  return (
    <>
      <Box>
        <Text color={colors.foreground} bold>
          {row.join(' ')}
        </Text>
      </Box>
      <Box marginTop={1}>
        <Text color={colors.dim}>spinning…</Text>
      </Box>
      <Box marginTop={1}>
        <Text color={colors.accent}>{bar}</Text>
      </Box>
      <Box>
        <Text color={colors.dim}>{progress > 0.6 ? 'slowing down…' : ''}</Text>
      </Box>
    </>
  );
}

interface WheelInfoProps {
  nudges: Nudge[];
}

function WheelInfo({ nudges }: WheelInfoProps): React.JSX.Element {
  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Text color={colors.accent} bold>
        ▮ what's on the wheel?
      </Text>
      <Box marginTop={1} marginBottom={1}>
        <Text color={colors.dim}>{nudges.length} nudges. equal weights.</Text>
      </Box>
      {nudges.map((n) => (
        <Box key={n.label}>
          <Text color={colors.highlight} bold>
            ✦{' '}
          </Text>
          <Text color={colors.foreground} bold>
            {n.label.padEnd(10)}
          </Text>
          <Text color={colors.dim}>{n.short}</Text>
        </Box>
      ))}
      <Box marginTop={2}>
        <Text color={colors.dim}>customizable in V2 · bring your own wheel</Text>
      </Box>
      <Box marginTop={1}>
        <Text color={colors.info}>[ ENTER / Q ] back to roulette</Text>
      </Box>
    </Box>
  );
}
