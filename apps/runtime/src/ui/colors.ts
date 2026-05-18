/**
 * Han brand color palette.
 *
 * Source: Figma brand page (`figma.com/design/VhDHQJG33eRrXZz2BZBjFL`, frame 3:11).
 * Spec: `.claude/docs/figma-spec.md`.
 */

export const tokens = {
  ink: '#0E0E0E',
  ash: '#1A1816',
  smoke: '#2A2826',
  cream: '#EDE6D6',
  ember: '#E0633A',
  teal: '#5FA8A0',
  amber: '#E8C56B',
} as const;

const dimCream = '#7A7268';

export const colors = {
  ink: tokens.ink,
  ash: tokens.ash,
  smoke: tokens.smoke,
  cream: tokens.cream,
  ember: tokens.ember,
  teal: tokens.teal,
  amber: tokens.amber,

  background: tokens.ink,
  surface: tokens.ash,
  border: tokens.smoke,
  foreground: tokens.cream,
  accent: tokens.ember,
  info: tokens.teal,
  highlight: tokens.amber,

  primary: tokens.ember,
  secondary: tokens.teal,
  dim: dimCream,
  error: tokens.ember,
  success: tokens.teal,
} as const;

export type ColorToken = keyof typeof colors;
