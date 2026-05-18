import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import { colors } from './colors.js';

const TRACK_LEN = 46;
const TICK_MS = 80;
const COUNTDOWN_SEC = 3;
const COUNTDOWN_TICKS = COUNTDOWN_SEC * Math.floor(1000 / TICK_MS);
const PHOTO_FINISH_TICKS = Math.floor(1600 / TICK_MS);
const HORSE_WIDTH = 2; // ascii horse is 2 cells (body + head)

const BET_PRESETS = [0.01, 0.05, 0.1, 0.25, 0.5, 1.0] as const;
const STARTING_BALANCE = 1.0;

type Phase = 'lobby' | 'countdown' | 'racing' | 'ended';

interface Horse {
  id: number;
  name: string;
  form: number;        // 0.55..1.0 — base average speed multiplier
  color: string;
  pos: number;
  finishTick?: number;
}

interface CommentaryEntry {
  tick: number;
  text: string;
  color?: string;
}

interface State {
  phase: Phase;
  horses: Horse[];
  pick: number;
  betIdx: number;
  balance: number;
  tick: number;
  countdown: number;
  winnerId?: number;
  leaderId?: number;
  commentary: CommentaryEntry[];
}

const ROSTER: Omit<Horse, 'pos' | 'id'>[] = [
  { name: 'claude',   form: 0.92, color: colors.accent },
  { name: 'gpt-5',    form: 0.88, color: colors.foreground },
  { name: 'cursor',   form: 0.85, color: colors.info },
  { name: 'windsurf', form: 0.83, color: colors.teal },
  { name: 'aider',    form: 0.78, color: colors.highlight },
  { name: 'gemini',   form: 0.74, color: colors.dim },
];

function makeHorses(): Horse[] {
  return ROSTER.map((h, i) => ({ ...h, id: i, pos: 0 }));
}

function initialState(prevBalance = STARTING_BALANCE): State {
  return {
    phase: 'lobby',
    horses: makeHorses(),
    pick: 0,
    betIdx: 1, // 0.05
    balance: prevBalance,
    tick: 0,
    countdown: COUNTDOWN_SEC,
    commentary: [],
  };
}

function odds(form: number): number {
  return (1 / form) * 1.8;
}

function fmtSol(amt: number): string {
  return `◎ ${amt.toFixed(3)}`;
}

// ascii horse — 2 cells wide, right-facing. body char cycles to fake a gallop.
const GALLOP_BODIES = ['─', '═', '≡', '═'];
const HORSE_HEAD = '►';

function horseBody(tick: number, offset = 0): string {
  return GALLOP_BODIES[Math.floor((tick + offset) / 2) % GALLOP_BODIES.length]!;
}

function pushCommentary(prev: CommentaryEntry[], entry: CommentaryEntry): CommentaryEntry[] {
  const next = [...prev, entry];
  return next.slice(-4);
}

interface Props {
  onQuit: () => void;
  focused?: boolean;
}

export function HorseRace({ onQuit, focused = true }: Props): React.JSX.Element {
  const [state, setState] = useState<State>(() => initialState());
  const stateRef = useRef(state);
  stateRef.current = state;

  useInput(
    (input, key) => {
      const k = input?.toLowerCase();
      const cur = stateRef.current;
      if (k === 'q' || key.escape) {
        onQuit();
        return;
      }
      if (cur.phase === 'lobby') {
        const n = Number(input);
        if (Number.isInteger(n) && n >= 1 && n <= cur.horses.length) {
          setState((s) => ({ ...s, pick: n - 1 }));
          return;
        }
        if (key.upArrow) {
          setState((s) => ({ ...s, pick: Math.max(0, s.pick - 1) }));
          return;
        }
        if (key.downArrow) {
          setState((s) => ({ ...s, pick: Math.min(s.horses.length - 1, s.pick + 1) }));
          return;
        }
        if (input === '+' || input === '=' || key.rightArrow) {
          setState((s) => ({ ...s, betIdx: Math.min(BET_PRESETS.length - 1, s.betIdx + 1) }));
          return;
        }
        if (input === '-' || input === '_' || key.leftArrow) {
          setState((s) => ({ ...s, betIdx: Math.max(0, s.betIdx - 1) }));
          return;
        }
        if (key.return || input === ' ') {
          const bet = BET_PRESETS[cur.betIdx]!;
          if (cur.balance < bet) {
            setState((s) => ({
              ...s,
              commentary: pushCommentary(s.commentary, {
                tick: 0,
                text: 'insufficient balance',
                color: colors.error,
              }),
            }));
            return;
          }
          setState((s) => ({
            ...s,
            phase: 'countdown',
            tick: 0,
            countdown: COUNTDOWN_SEC,
            commentary: [{ tick: 0, text: 'they\'re lining up at the gate…', color: colors.dim }],
          }));
          return;
        }
      } else if (cur.phase === 'ended') {
        if (k === 'r') {
          setState((s) => initialState(s.balance));
        }
      }
    },
    { isActive: focused },
  );

  const tick = useCallback(() => {
    setState((prev) => {
      if (prev.phase === 'lobby' || prev.phase === 'ended') return prev;

      const next: State = { ...prev, tick: prev.tick + 1 };

      // countdown phase
      if (prev.phase === 'countdown') {
        const ticksPerSec = Math.floor(1000 / TICK_MS);
        const elapsedSec = Math.floor(next.tick / ticksPerSec);
        next.countdown = Math.max(0, COUNTDOWN_SEC - elapsedSec);
        if (next.tick === COUNTDOWN_TICKS) {
          next.phase = 'racing';
          next.countdown = 0;
          next.commentary = pushCommentary(prev.commentary, {
            tick: next.tick,
            text: 'they\'re off!',
            color: colors.accent,
          });
        }
        return next;
      }

      // racing — advance every horse
      const finishLine = TRACK_LEN - HORSE_WIDTH;
      const horses = prev.horses.map((h) => {
        if (h.finishTick !== undefined) return h;
        const base = h.form * 0.55;
        const jitter = Math.random() * h.form * 0.55;
        const burst = Math.random() < 0.05 ? Math.random() * h.form * 1.4 : 0;
        const delta = base + jitter + burst;
        const pos = Math.min(finishLine, h.pos + delta);
        const finishTick = pos >= finishLine ? next.tick : undefined;
        return { ...h, pos, finishTick };
      });
      next.horses = horses;

      // commentary — leader changes
      const sortedByPos = [...horses].sort((a, b) => b.pos - a.pos);
      const newLeader = sortedByPos[0]!;
      if (newLeader.id !== prev.leaderId && next.phase === 'racing') {
        // only emit leader change after the field has spread a bit
        if (newLeader.pos > 3) {
          next.leaderId = newLeader.id;
          next.commentary = pushCommentary(prev.commentary, {
            tick: next.tick,
            text: `${newLeader.name} takes the lead`,
            color: newLeader.color,
          });
        }
      } else {
        next.leaderId = prev.leaderId;
      }

      // commentary — burst spikes (heuristic: leader pulled away by >2 cells from #2 mid-race)
      if (
        next.tick > 20 &&
        next.tick % 18 === 0 &&
        sortedByPos[1] &&
        sortedByPos[0]!.pos - sortedByPos[1]!.pos > 4 &&
        sortedByPos[0]!.pos < finishLine - 4
      ) {
        next.commentary = pushCommentary(next.commentary, {
          tick: next.tick,
          text: `${sortedByPos[0]!.name} surges ahead!`,
          color: sortedByPos[0]!.color,
        });
      }

      // determine winner
      if (next.winnerId === undefined) {
        const finishers = horses.filter((h) => h.finishTick !== undefined);
        if (finishers.length > 0) {
          finishers.sort((a, b) => {
            const t = (a.finishTick ?? 0) - (b.finishTick ?? 0);
            if (t !== 0) return t;
            return a.id - b.id;
          });
          const winner = finishers[0]!;
          next.winnerId = winner.id;

          const runnerUp = horses
            .filter((h) => h.id !== winner.id && h.finishTick !== undefined)
            .sort((a, b) => (a.finishTick ?? 0) - (b.finishTick ?? 0))[0];

          if (runnerUp && (runnerUp.finishTick ?? 0) - (winner.finishTick ?? 0) <= 3) {
            next.commentary = pushCommentary(next.commentary, {
              tick: next.tick,
              text: 'photo finish!',
              color: colors.highlight,
            });
          }
          next.commentary = pushCommentary(next.commentary, {
            tick: next.tick,
            text: `${winner.name} wins it`,
            color: winner.color,
          });
        }
      }

      // settle game after photo-finish window
      if (
        next.winnerId !== undefined &&
        next.tick - (horses[next.winnerId]!.finishTick ?? 0) >= PHOTO_FINISH_TICKS
      ) {
        next.phase = 'ended';
        // settle balance
        const bet = BET_PRESETS[prev.betIdx]!;
        const won = next.winnerId === prev.pick;
        if (won) {
          const pick = horses[prev.pick]!;
          const payout = bet * odds(pick.form);
          next.balance = prev.balance - bet + payout;
        } else {
          next.balance = Math.max(0, prev.balance - bet);
        }
      }

      return next;
    });
  }, []);

  useEffect(() => {
    const id = setInterval(tick, TICK_MS);
    return () => clearInterval(id);
  }, [tick]);

  const bet = BET_PRESETS[state.betIdx]!;
  const pickedHorse = state.horses[state.pick]!;
  const youWon = state.winnerId !== undefined && state.winnerId === state.pick;

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Box marginBottom={1} justifyContent="space-between">
        <Box>
          <Text color={colors.accent} bold>
            ▮ at yarışı
          </Text>
          <Text color={colors.dim}>{'   '}pick · bet · race</Text>
        </Box>
        <Box>
          <Text color={colors.dim}>balance </Text>
          <Text color={colors.highlight} bold>
            {fmtSol(state.balance)} SOL
          </Text>
        </Box>
      </Box>

      {state.phase === 'lobby' ? (
        <Lobby horses={state.horses} pick={state.pick} bet={bet} betIdx={state.betIdx} />
      ) : (
        <Track state={state} />
      )}

      <Commentary entries={state.commentary} />

      <Box marginTop={1}>
        {state.phase === 'lobby' ? (
          <Text color={colors.dim}>
            [ 1-{state.horses.length} / ↑↓ ] horse{'  '}
            [ + - / ←→ ] bet{'  '}
            [ enter ] race{'  '}
            [ Q ] back
          </Text>
        ) : state.phase === 'countdown' ? (
          <Text color={colors.info} bold>
            riders set · {state.countdown > 0 ? state.countdown : 'GO'}
            <Text color={colors.dim}>
              {'   '}· {fmtSol(bet)} on <Text color={pickedHorse.color}>{pickedHorse.name}</Text> @ {odds(pickedHorse.form).toFixed(1)}x
            </Text>
          </Text>
        ) : state.phase === 'racing' ? (
          <Text color={colors.dim}>
            betting <Text color={colors.highlight}>{fmtSol(bet)}</Text> on{' '}
            <Text color={pickedHorse.color} bold>{pickedHorse.name}</Text>
            {' · payout '}
            <Text color={colors.highlight}>{fmtSol(bet * odds(pickedHorse.form))}</Text>
          </Text>
        ) : (
          <Result
            winner={state.horses[state.winnerId!]!}
            picked={pickedHorse}
            bet={bet}
            youWon={youWon}
            balance={state.balance}
          />
        )}
      </Box>
    </Box>
  );
}

function Lobby({
  horses,
  pick,
  bet,
  betIdx,
}: {
  horses: Horse[];
  pick: number;
  bet: number;
  betIdx: number;
}): React.JSX.Element {
  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text color={colors.dim}>     name        odds   form</Text>
      </Box>
      {horses.map((h, i) => {
        const selected = i === pick;
        const cursor = selected ? '▶' : ' ';
        const formCells = Math.round(h.form * 10);
        const formBar = '▰'.repeat(formCells) + '▱'.repeat(10 - formCells);
        return (
          <Box key={h.id}>
            <Box width={2}>
              <Text color={selected ? colors.accent : colors.dim}>{cursor}</Text>
            </Box>
            <Box width={3}>
              <Text color={selected ? colors.accent : colors.dim}>{i + 1}.</Text>
            </Box>
            <Box width={12}>
              <Text color={h.color} bold={selected}>
                {h.name}
              </Text>
            </Box>
            <Box width={7}>
              <Text color={colors.highlight}>{odds(h.form).toFixed(1)}x</Text>
            </Box>
            <Text color={selected ? h.color : colors.smoke}>{formBar}</Text>
          </Box>
        );
      })}

      <Box marginTop={1}>
        <Text color={colors.dim}>bet </Text>
        {BET_PRESETS.map((amt, i) => {
          const sel = i === betIdx;
          return (
            <Text key={amt} color={sel ? colors.highlight : colors.dim} bold={sel}>
              {sel ? `[ ${amt.toFixed(2)} ]` : `  ${amt.toFixed(2)}  `}
            </Text>
          );
        })}
        <Text color={colors.dim}>{'   '}selected: </Text>
        <Text color={colors.highlight} bold>
          {fmtSol(bet)}
        </Text>
      </Box>
    </Box>
  );
}

function Track({ state }: { state: State }): React.JSX.Element {
  const finishCol = TRACK_LEN - HORSE_WIDTH;
  const border = '─'.repeat(TRACK_LEN + 6);

  return (
    <Box flexDirection="column">
      <Text color={colors.smoke}>┌{border}┐</Text>
      {state.horses.map((h, idx) => (
        <Lane
          key={h.id}
          horse={h}
          idx={idx}
          tick={state.tick}
          finishCol={finishCol}
          isPick={state.pick === h.id}
          isWinner={state.winnerId === h.id}
          phase={state.phase}
        />
      ))}
      <Text color={colors.smoke}>└{border}┘</Text>
      <Box>
        <Text>{' '.repeat(6)}</Text>
        <Text color={colors.dim}>{'─'.repeat(TRACK_LEN - 2)}</Text>
        <Text color={colors.accent} bold>
          ▌
        </Text>
        <Text color={colors.foreground} bold>
          ▌
        </Text>
        <Text color={colors.dim}>  finish</Text>
      </Box>
    </Box>
  );
}

function Lane({
  horse,
  idx,
  tick,
  finishCol,
  isPick,
  isWinner,
  phase,
}: {
  horse: Horse;
  idx: number;
  tick: number;
  finishCol: number;
  isPick: boolean;
  isWinner: boolean;
  phase: Phase;
}): React.JSX.Element {
  const pos = Math.round(horse.pos);
  const aheadCells = Math.max(0, finishCol - pos);
  const marker = isWinner ? '★' : isPick ? '◆' : ' ';
  const lane = idx + 1;
  const showHorse = phase !== 'lobby';
  const body = horseBody(tick, idx);

  // dust trail: stronger near the horse, fades back
  const trail = renderTrail(pos);

  return (
    <Box>
      <Text color={colors.smoke}>│ </Text>
      <Box width={2}>
        <Text color={isWinner ? colors.highlight : isPick ? colors.accent : colors.dim}>
          {marker}
        </Text>
      </Box>
      <Box width={2}>
        <Text color={colors.dim}>{lane}</Text>
      </Box>
      <Text color={colors.smoke}>{trail}</Text>
      {showHorse ? (
        <Text color={horse.color} bold>
          {body}
          {HORSE_HEAD}
        </Text>
      ) : (
        <Text>  </Text>
      )}
      <Text>{' '.repeat(aheadCells)}</Text>
      <Text color={colors.smoke}> │ </Text>
      <Box width={10}>
        <Text color={horse.color} bold={isWinner}>
          {horse.name}
        </Text>
      </Box>
    </Box>
  );
}

function renderTrail(pos: number): string {
  if (pos <= 0) return '';
  // closest to horse: thicker dust. far back: faded.
  const chars: string[] = [];
  for (let i = 0; i < pos; i++) {
    const dist = pos - i;
    if (dist <= 1) chars.push(':');
    else if (dist <= 3) chars.push('.');
    else chars.push(' ');
  }
  return chars.join('');
}

function Commentary({ entries }: { entries: CommentaryEntry[] }): React.JSX.Element {
  if (entries.length === 0) {
    return <Box marginTop={1} />;
  }
  return (
    <Box flexDirection="column" marginTop={1}>
      {entries.map((e, i) => (
        <Text key={i} color={e.color ?? colors.dim}>
          › {e.text}
        </Text>
      ))}
    </Box>
  );
}

function Result({
  winner,
  picked,
  bet,
  youWon,
  balance,
}: {
  winner: Horse;
  picked: Horse;
  bet: number;
  youWon: boolean;
  balance: number;
}): React.JSX.Element {
  const payout = bet * odds(picked.form);
  return (
    <Box flexDirection="column">
      <Text color={youWon ? colors.accent : colors.dim} bold>
        {youWon
          ? `★ you win  +${fmtSol(payout - bet)} SOL`
          : `· ${winner.name} took it. you lose ${fmtSol(bet)} SOL`}
      </Text>
      <Box>
        <Text color={colors.dim}>new balance </Text>
        <Text color={colors.highlight} bold>
          {fmtSol(balance)} SOL
        </Text>
        <Text color={colors.dim}>   ·   [ R ] race again · [ Q ] back</Text>
      </Box>
    </Box>
  );
}
