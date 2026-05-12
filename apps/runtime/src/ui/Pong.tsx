import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import { colors } from './colors.js';

const FIELD_W = 50;
const FIELD_H = 18;
const PADDLE_H = 4;
const PADDLE_SPEED = 1.0;       // cells per tick
const BALL_VX_START = 0.55;
const BALL_VY_MAX = 0.5;
const TICK_MS = 50;             // 20 Hz — terminal frame budget
const WIN_SCORE = 5;
const CPU_REACTION = 0.55;      // 0..1 — fraction of paddle speed CPU can use
const CPU_DEADZONE = 1.2;

type Phase = 'countdown' | 'playing' | 'ended';

interface State {
  phase: Phase;
  countdown: number;
  ballX: number;
  ballY: number;
  vx: number;
  vy: number;
  paddleY: number;
  cpuY: number;
  scorePlayer: number;
  scoreCpu: number;
  winner?: 'player' | 'cpu';
  rev: number;
}

interface InputState {
  up: boolean;
  down: boolean;
}

function randomVy(): number {
  return (Math.random() * 2 - 1) * BALL_VY_MAX;
}

function initialState(serveTo: 'player' | 'cpu' = Math.random() < 0.5 ? 'player' : 'cpu'): State {
  return {
    phase: 'countdown',
    countdown: 3,
    ballX: FIELD_W / 2,
    ballY: FIELD_H / 2,
    vx: serveTo === 'player' ? -BALL_VX_START : BALL_VX_START,
    vy: randomVy(),
    paddleY: (FIELD_H - PADDLE_H) / 2,
    cpuY: (FIELD_H - PADDLE_H) / 2,
    scorePlayer: 0,
    scoreCpu: 0,
    rev: 0,
  };
}

interface PongProps {
  onQuit: () => void;
  focused?: boolean;
  playerName?: string;
}

export function Pong({ onQuit, focused = true, playerName = 'you' }: PongProps): React.JSX.Element {
  const [state, setState] = useState<State>(() => initialState());
  const stateRef = useRef(state);
  stateRef.current = state;
  const inputRef = useRef<InputState>({ up: false, down: false });

  useInput(
    (input, key) => {
      const k = input?.toLowerCase();
      if (k === 'q' || key.escape) {
        onQuit();
        return;
      }
      if (k === 'r' && stateRef.current.phase === 'ended') {
        setState(initialState());
        return;
      }
      if (k === 'w' || key.upArrow) {
        inputRef.current.up = true;
        inputRef.current.down = false;
        return;
      }
      if (k === 's' || key.downArrow) {
        inputRef.current.down = true;
        inputRef.current.up = false;
        return;
      }
      // Ink reports presses, not releases. Use space to stop the paddle.
      if (input === ' ') {
        inputRef.current.up = false;
        inputRef.current.down = false;
      }
    },
    { isActive: focused },
  );

  const tick = useCallback(() => {
    setState((prev) => {
      if (prev.phase === 'ended') return prev;
      const next: State = { ...prev, rev: prev.rev + 1 };

      // countdown
      if (prev.phase === 'countdown') {
        // run the countdown on every tick at 20Hz — 20 ticks = ~1s
        const countdownTicksPerSec = Math.floor(1000 / TICK_MS);
        if (prev.rev > 0 && prev.rev % countdownTicksPerSec === 0) {
          next.countdown = prev.countdown - 1;
          if (next.countdown <= 0) {
            next.phase = 'playing';
            next.countdown = 0;
          }
        }
        return next;
      }

      // player paddle
      const input = inputRef.current;
      if (input.up) next.paddleY = Math.max(0, prev.paddleY - PADDLE_SPEED);
      else if (input.down) next.paddleY = Math.min(FIELD_H - PADDLE_H, prev.paddleY + PADDLE_SPEED);

      // CPU paddle — chase ball center with reaction lag
      const cpuCenter = prev.cpuY + PADDLE_H / 2;
      const ballYTarget = prev.ballY;
      const diff = ballYTarget - cpuCenter;
      if (Math.abs(diff) > CPU_DEADZONE) {
        const move = Math.sign(diff) * PADDLE_SPEED * CPU_REACTION;
        next.cpuY = Math.max(0, Math.min(FIELD_H - PADDLE_H, prev.cpuY + move));
      }

      // ball
      let bx = prev.ballX + prev.vx;
      let by = prev.ballY + prev.vy;
      let vx = prev.vx;
      let vy = prev.vy;

      // top/bottom walls
      if (by <= 0) {
        by = 0;
        vy = Math.abs(vy);
      } else if (by >= FIELD_H - 1) {
        by = FIELD_H - 1;
        vy = -Math.abs(vy);
      }

      // left paddle collision (column 1 + 1 padding zone)
      if (bx <= 2 && vx < 0) {
        if (by >= next.paddleY && by <= next.paddleY + PADDLE_H - 1) {
          bx = 2;
          vx = Math.min(Math.abs(vx) * 1.05, 1.8);
          const hit = (by - (next.paddleY + PADDLE_H / 2)) / (PADDLE_H / 2);
          vy = hit * 0.55;
        }
      }
      // right paddle collision (column FIELD_W - 3)
      if (bx >= FIELD_W - 3 && vx > 0) {
        if (by >= next.cpuY && by <= next.cpuY + PADDLE_H - 1) {
          bx = FIELD_W - 3;
          vx = -Math.min(Math.abs(vx) * 1.05, 1.8);
          const hit = (by - (next.cpuY + PADDLE_H / 2)) / (PADDLE_H / 2);
          vy = hit * 0.55;
        }
      }

      // goals
      if (bx < 0) {
        next.scoreCpu = prev.scoreCpu + 1;
        if (next.scoreCpu >= WIN_SCORE) {
          next.phase = 'ended';
          next.winner = 'cpu';
        } else {
          next.phase = 'countdown';
          next.countdown = 2;
        }
        next.ballX = FIELD_W / 2;
        next.ballY = FIELD_H / 2;
        next.vx = BALL_VX_START;
        next.vy = randomVy();
        next.rev = 0;
        return next;
      }
      if (bx > FIELD_W - 1) {
        next.scorePlayer = prev.scorePlayer + 1;
        if (next.scorePlayer >= WIN_SCORE) {
          next.phase = 'ended';
          next.winner = 'player';
        } else {
          next.phase = 'countdown';
          next.countdown = 2;
        }
        next.ballX = FIELD_W / 2;
        next.ballY = FIELD_H / 2;
        next.vx = -BALL_VX_START;
        next.vy = randomVy();
        next.rev = 0;
        return next;
      }

      next.ballX = bx;
      next.ballY = by;
      next.vx = vx;
      next.vy = vy;
      return next;
    });
  }, []);

  useEffect(() => {
    const id = setInterval(tick, TICK_MS);
    return () => clearInterval(id);
  }, [tick]);

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Box marginBottom={1}>
        <Text color={colors.accent} bold>
          ▮ pong · solo
        </Text>
        <Text color={colors.dim}>{'   '}vs cpu · first to {WIN_SCORE}</Text>
      </Box>

      <ScoreRow
        playerName={playerName}
        scorePlayer={state.scorePlayer}
        scoreCpu={state.scoreCpu}
      />

      <Field state={state} />

      <Box marginTop={1}>
        {state.phase === 'countdown' ? (
          <Text color={colors.info}>
            get ready · {state.countdown > 0 ? state.countdown : 'GO'}
          </Text>
        ) : state.phase === 'ended' ? (
          <Text color={state.winner === 'player' ? colors.accent : colors.dim} bold>
            {state.winner === 'player' ? 'you win!' : 'cpu wins.'}
            <Text color={colors.dim}>{'   '}[ R ] rematch · [ Q ] back</Text>
          </Text>
        ) : (
          <Text color={colors.dim}>[ W / ↑ ] up · [ S / ↓ ] down · [ space ] stop · [ Q ] quit</Text>
        )}
      </Box>
    </Box>
  );
}

function ScoreRow({
  playerName,
  scorePlayer,
  scoreCpu,
}: {
  playerName: string;
  scorePlayer: number;
  scoreCpu: number;
}): React.JSX.Element {
  return (
    <Box marginBottom={1}>
      <Box width={Math.floor(FIELD_W / 2) + 2}>
        <Text color={colors.foreground}>{playerName}</Text>
        <Text color={colors.dim}>{'  '}</Text>
        <Text color={colors.accent} bold>
          {scorePlayer}
        </Text>
      </Box>
      <Box width={Math.ceil(FIELD_W / 2)} justifyContent="flex-end">
        <Text color={colors.accent} bold>
          {scoreCpu}
        </Text>
        <Text color={colors.dim}>{'  '}</Text>
        <Text color={colors.foreground}>cpu</Text>
      </Box>
    </Box>
  );
}

function Field({ state }: { state: State }): React.JSX.Element {
  const rows: React.JSX.Element[] = [];
  const ballX = Math.round(state.ballX);
  const ballY = Math.round(state.ballY);
  const paddleYTop = Math.round(state.paddleY);
  const cpuYTop = Math.round(state.cpuY);

  for (let y = 0; y < FIELD_H; y++) {
    const cells: React.JSX.Element[] = [];
    for (let x = 0; x < FIELD_W; x++) {
      let ch = ' ';
      let color: string | undefined = undefined;
      let bold = false;

      // dividing line, dashed
      if (x === Math.floor(FIELD_W / 2) && y % 2 === 0) {
        ch = '┊';
        color = colors.smoke;
      }
      // paddles
      if (x === 1 && y >= paddleYTop && y < paddleYTop + PADDLE_H) {
        ch = '█';
        color = colors.accent;
      }
      if (x === FIELD_W - 2 && y >= cpuYTop && y < cpuYTop + PADDLE_H) {
        ch = '█';
        color = colors.foreground;
      }
      // ball
      if (x === ballX && y === ballY && state.phase !== 'ended') {
        ch = '●';
        color = colors.highlight;
        bold = true;
      }
      cells.push(
        <Text key={x} color={color} bold={bold}>
          {ch}
        </Text>,
      );
    }
    rows.push(
      <Box key={y}>
        <Text color={colors.smoke}>│</Text>
        {cells}
        <Text color={colors.smoke}>│</Text>
      </Box>,
    );
  }

  const border = '─'.repeat(FIELD_W);
  return (
    <Box flexDirection="column">
      <Text color={colors.smoke}>┌{border}┐</Text>
      {rows}
      <Text color={colors.smoke}>└{border}┘</Text>
    </Box>
  );
}
