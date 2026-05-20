import React, { useEffect, useMemo, useState } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import { colors } from '../ui/colors.js';

export interface WorkshopLesson {
  lesson: string;
  cursor?: string;
  note?: string;
  ts: number;
}

export interface WorkshopStudentTile {
  sessionId: string;
  teamLabel: string;
  lastActivity: number;
  lastSnippet?: string;
  helpOpen?: boolean;
}

interface Props {
  eventSlug: string;
  eventTitle: string;
  /** Subscribe to live student tile updates. Returns unsubscribe. */
  subscribeTiles: (cb: (next: WorkshopStudentTile) => void) => () => void;
  /** Subscribe to incoming workshop_lesson messages (other instructors). */
  subscribeLesson: (cb: (lesson: WorkshopLesson) => void) => () => void;
  /** Push a lesson cursor as instructor. */
  publishCursor: (lesson: string, cursor?: string, note?: string) => void;
  onExit?: () => void;
}

function ageLabel(ts: number, now: number = Date.now()): string {
  const s = Math.floor((now - ts) / 1000);
  if (s < 5) return 'in sync';
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m`;
}

const STUDENT_TILE_W = 26;

export function WorkshopMode({
  eventSlug,
  eventTitle,
  subscribeTiles,
  subscribeLesson,
  publishCursor,
  onExit,
}: Props): React.ReactElement {
  const { exit } = useApp();
  const [tiles, setTiles] = useState<WorkshopStudentTile[]>([]);
  const [lesson, setLesson] = useState<WorkshopLesson | null>(null);
  const [now, setNow] = useState<number>(Date.now());
  const [inputBuf, setInputBuf] = useState('');
  const [lessonCounter, setLessonCounter] = useState(1);

  useEffect(() => {
    const off = subscribeTiles((next) => {
      setTiles((prev) => {
        const idx = prev.findIndex((t) => t.sessionId === next.sessionId);
        if (idx === -1) return [...prev, next];
        const merged = [...prev];
        merged[idx] = { ...merged[idx]!, ...next };
        return merged;
      });
    });
    return off;
  }, [subscribeTiles]);

  useEffect(() => {
    const off = subscribeLesson((l) => setLesson(l));
    return off;
  }, [subscribeLesson]);

  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);

  useInput((input, key) => {
    if (key.escape || (input === 'q' && inputBuf === '')) {
      onExit?.();
      exit();
      return;
    }
    if (key.return) {
      const text = inputBuf.trim();
      if (text.length > 0) {
        const lessonId = `lesson-${lessonCounter}`;
        publishCursor(lessonId, text);
        setLessonCounter((n) => n + 1);
      }
      setInputBuf('');
      return;
    }
    if (key.backspace || key.delete) {
      setInputBuf((b) => b.slice(0, -1));
      return;
    }
    if (input && !key.ctrl && !key.meta) {
      setInputBuf((b) => b + input);
    }
  });

  const liveCount = useMemo(
    () => tiles.filter((t) => now - t.lastActivity < 30_000).length,
    [tiles, now],
  );
  const helpCount = useMemo(() => tiles.filter((t) => t.helpOpen).length, [tiles]);

  return (
    <Box flexDirection="row" minHeight={20}>
      {/* Left: instructor panel */}
      <Box flexDirection="column" width={48} borderStyle="single" borderColor={colors.smoke} paddingX={1} paddingY={1} marginRight={1}>
        <Text color={colors.amber} bold>
          ~/{eventSlug}
        </Text>
        <Text color={colors.dim}>instructor : you</Text>
        <Box marginTop={1}>
          <Text color={colors.cream}>{eventTitle}</Text>
        </Box>
        <Box marginTop={1}>
          <Text color={colors.dim}>
            {liveCount}/{tiles.length} students live  ·  {helpCount} help
          </Text>
        </Box>
        <Box marginTop={1} flexDirection="column">
          <Text color={colors.dim}>last cursor:</Text>
          {lesson ? (
            <Box flexDirection="column" marginTop={0}>
              <Text color={colors.teal}>▮ {lesson.lesson}</Text>
              {lesson.cursor ? <Text color={colors.cream}>{lesson.cursor}</Text> : null}
              {lesson.note ? <Text color={colors.dim}>{lesson.note}</Text> : null}
            </Box>
          ) : (
            <Text color={colors.dim}>(no cursor sent yet)</Text>
          )}
        </Box>
        <Box marginTop={1} flexDirection="column">
          <Text color={colors.dim}>publish new cursor (ENTER):</Text>
          <Box>
            <Text color={colors.ember}>{'>'} </Text>
            <Text color={colors.cream}>{inputBuf}</Text>
            <Text color={colors.ember}>_</Text>
          </Box>
        </Box>
        <Box marginTop={1}>
          <Text color={colors.dim}>q / esc to exit</Text>
        </Box>
      </Box>

      {/* Right: student tile grid */}
      <Box flexDirection="column" flexGrow={1}>
        <Box marginBottom={1}>
          <Text color={colors.cream} bold>
            student tiles
          </Text>
          <Text color={colors.dim}>  (live in sync · stale &gt; 30s)</Text>
        </Box>
        {tiles.length === 0 ? (
          <Text color={colors.dim}>(no students joined yet — waiting…)</Text>
        ) : (
          <Box flexDirection="row" flexWrap="wrap">
            {tiles.map((t) => {
              const stale = now - t.lastActivity > 30_000;
              return (
                <Box
                  key={t.sessionId}
                  width={STUDENT_TILE_W}
                  flexDirection="column"
                  borderStyle="single"
                  borderColor={t.helpOpen ? colors.ember : stale ? colors.smoke : colors.teal}
                  paddingX={1}
                  marginRight={1}
                  marginBottom={1}
                >
                  <Box>
                    <Text color={colors.cream} bold>
                      {t.teamLabel.padEnd(14).slice(0, 14)}
                    </Text>
                    {t.helpOpen ? (
                      <Text color={colors.ember}> ●</Text>
                    ) : (
                      <Text color={colors.dim}> {ageLabel(t.lastActivity, now)}</Text>
                    )}
                  </Box>
                  <Text color={stale ? colors.dim : colors.amber}>
                    {(t.lastSnippet ?? '(idle)').slice(0, STUDENT_TILE_W - 4)}
                  </Text>
                </Box>
              );
            })}
          </Box>
        )}
      </Box>
    </Box>
  );
}
