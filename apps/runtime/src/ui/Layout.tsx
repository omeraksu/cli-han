import React from 'react';
import { Box, Text, useStdout } from 'ink';
import { colors } from './colors.js';

const MAC_DOT_RED = '#FF5F56';
const MAC_DOT_YELLOW = '#FFBD2E';
const MAC_DOT_GREEN = '#27C93F';

interface ScreenProps {
  children: React.ReactNode;
}

/**
 * Full-screen wrapper. Sizes itself to the terminal's current rows/columns.
 * @example
 *   <Screen>
 *     <Titlebar title="~/  —  han viewer" />
 *     <SplitPane left={...} right={...} />
 *     <Footer>...</Footer>
 *   </Screen>
 */
export function Screen({ children }: ScreenProps): JSX.Element {
  const { stdout } = useStdout();
  const height = stdout?.rows ?? 24;
  const width = stdout?.columns ?? 80;
  return (
    <Box flexDirection="column" width={width} height={height}>
      {children}
    </Box>
  );
}

interface TitlebarProps {
  title: string;
}

/**
 * Mac-style title bar — three colored dots on the left, centered title.
 * Mirrors Figma `titlebar` frame (e.g. 10:82).
 */
export function Titlebar({ title }: TitlebarProps): JSX.Element {
  return (
    <Box
      flexDirection="row"
      paddingX={1}
      borderStyle="single"
      borderTop={false}
      borderLeft={false}
      borderRight={false}
      borderBottomColor={colors.border}
    >
      <Box width={8}>
        <Text color={MAC_DOT_RED}>●</Text>
        <Text> </Text>
        <Text color={MAC_DOT_YELLOW}>●</Text>
        <Text> </Text>
        <Text color={MAC_DOT_GREEN}>●</Text>
      </Box>
      <Box flexGrow={1} justifyContent="center">
        <Text color={colors.dim}>{title}</Text>
      </Box>
      <Box width={8} />
    </Box>
  );
}

interface SplitPaneProps {
  left: React.ReactNode;
  right: React.ReactNode;
  leftRatio?: number;
}

/**
 * Horizontal split with a single-column divider in between.
 * Default ratio matches Figma 04 (≈ 52/48).
 */
export function SplitPane({ left, right, leftRatio = 0.52 }: SplitPaneProps): JSX.Element {
  const { stdout } = useStdout();
  const columns = stdout?.columns ?? 80;
  const leftWidth = Math.max(20, Math.floor(columns * leftRatio));

  return (
    <Box flexDirection="row" flexGrow={1}>
      <Box flexDirection="column" width={leftWidth} paddingX={1} paddingY={1}>
        {left}
      </Box>
      <Box
        borderStyle="single"
        borderTop={false}
        borderBottom={false}
        borderRight={false}
        borderLeftColor={colors.border}
      />
      <Box flexDirection="column" flexGrow={1} paddingX={1} paddingY={1}>
        {right}
      </Box>
    </Box>
  );
}

interface FooterProps {
  children: React.ReactNode;
}

/**
 * Bottom slot — usually holds a StatusBar or command hint row.
 */
export function Footer({ children }: FooterProps): JSX.Element {
  return (
    <Box
      flexDirection="column"
      paddingX={1}
      borderStyle="single"
      borderBottom={false}
      borderLeft={false}
      borderRight={false}
      borderTopColor={colors.border}
    >
      {children}
    </Box>
  );
}

interface SectionTitleProps {
  label: string;
  tail?: string;
}

/**
 * Figma-style section heading like `─ stream · alice ──── feed ─`.
 * Renders the label in ember and pads with em-dashes up to the parent width.
 */
export function SectionTitle({ label, tail }: SectionTitleProps): JSX.Element {
  const left = '─ ';
  const middle = tail ? ` ${'─'.repeat(4)} ${tail} ` : ' ';
  const right = '─';
  return (
    <Box>
      <Text color={colors.accent} bold>
        {left}
        {label}
        {middle}
        {right}
      </Text>
    </Box>
  );
}
