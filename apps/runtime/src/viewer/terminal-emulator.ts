import xtermHeadless from '@xterm/headless';
import type { Terminal as TerminalType } from '@xterm/headless';
import { BROADCAST_COLS, BROADCAST_ROWS } from '../transport/constants.js';

const { Terminal } = xtermHeadless;

export interface StyledRun {
  text: string;
  fg?: string;
  bg?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  inverse?: boolean;
  dim?: boolean;
}

export interface TerminalSnapshot {
  cols: number;
  rows: number;
  lines: StyledRun[][];
  cursorX: number;
  cursorY: number;
  rev: number;
}

const PALETTE_16: string[] = [
  '#000000', '#cc0000', '#4e9a06', '#c4a000',
  '#3465a4', '#75507b', '#06989a', '#d3d7cf',
  '#555753', '#ef2929', '#8ae234', '#fce94f',
  '#729fcf', '#ad7fa8', '#34e2e2', '#eeeeec',
];

function build256Palette(): string[] {
  const palette = [...PALETTE_16];
  const levels = [0, 95, 135, 175, 215, 255];
  for (let r = 0; r < 6; r++) {
    for (let g = 0; g < 6; g++) {
      for (let b = 0; b < 6; b++) {
        palette.push(
          `#${levels[r]!.toString(16).padStart(2, '0')}` +
            `${levels[g]!.toString(16).padStart(2, '0')}` +
            `${levels[b]!.toString(16).padStart(2, '0')}`,
        );
      }
    }
  }
  for (let i = 0; i < 24; i++) {
    const v = 8 + i * 10;
    const hex = v.toString(16).padStart(2, '0');
    palette.push(`#${hex}${hex}${hex}`);
  }
  return palette;
}

const PALETTE_256 = build256Palette();

function rgbInt(v: number): string {
  const r = (v >> 16) & 0xff;
  const g = (v >> 8) & 0xff;
  const b = v & 0xff;
  return (
    '#' +
    r.toString(16).padStart(2, '0') +
    g.toString(16).padStart(2, '0') +
    b.toString(16).padStart(2, '0')
  );
}

interface CellLike {
  getChars(): string;
  getFgColor(): number;
  getBgColor(): number;
  isFgDefault(): boolean;
  isBgDefault(): boolean;
  isFgRGB(): boolean;
  isBgRGB(): boolean;
  isFgPalette(): boolean;
  isBgPalette(): boolean;
  isBold(): number;
  isItalic(): number;
  isUnderline(): number;
  isInverse(): number;
  isDim(): number;
}

function cellAttrs(cell: CellLike): Omit<StyledRun, 'text'> {
  const out: Omit<StyledRun, 'text'> = {};
  if (!cell.isFgDefault()) {
    const v = cell.getFgColor();
    if (cell.isFgRGB()) out.fg = rgbInt(v);
    else if (cell.isFgPalette()) out.fg = PALETTE_256[v] ?? undefined;
  }
  if (!cell.isBgDefault()) {
    const v = cell.getBgColor();
    if (cell.isBgRGB()) out.bg = rgbInt(v);
    else if (cell.isBgPalette()) out.bg = PALETTE_256[v] ?? undefined;
  }
  if (cell.isBold()) out.bold = true;
  if (cell.isItalic()) out.italic = true;
  if (cell.isUnderline()) out.underline = true;
  if (cell.isInverse()) out.inverse = true;
  if (cell.isDim()) out.dim = true;
  return out;
}

function attrsEqual(a: Omit<StyledRun, 'text'>, b: Omit<StyledRun, 'text'>): boolean {
  return (
    a.fg === b.fg &&
    a.bg === b.bg &&
    a.bold === b.bold &&
    a.italic === b.italic &&
    a.underline === b.underline &&
    a.inverse === b.inverse &&
    a.dim === b.dim
  );
}

interface LineLike {
  getCell(x: number): CellLike | undefined;
}

function extractRuns(line: LineLike, cols: number): StyledRun[] {
  const runs: StyledRun[] = [];
  let current: StyledRun | null = null;
  for (let x = 0; x < cols; x++) {
    const cell = line.getCell(x);
    if (!cell) continue;
    let ch = cell.getChars();
    if (ch === '') ch = ' ';
    const attrs = cellAttrs(cell);
    if (current && attrsEqual(current, attrs)) {
      current.text += ch;
    } else {
      current = { ...attrs, text: ch };
      runs.push(current);
    }
  }
  return runs;
}

export class TerminalEmulator {
  readonly term: TerminalType;
  private rev = 0;

  constructor() {
    this.term = new Terminal({
      cols: BROADCAST_COLS,
      rows: BROADCAST_ROWS,
      allowProposedApi: true,
      scrollback: 0,
    });
  }

  write(chunk: string): void {
    this.term.write(chunk);
    this.rev++;
  }

  snapshot(): TerminalSnapshot {
    const buffer = this.term.buffer.active;
    const lines: StyledRun[][] = [];
    const baseY = buffer.baseY;
    for (let i = 0; i < this.term.rows; i++) {
      const line = buffer.getLine(baseY + i);
      if (!line) {
        lines.push([{ text: ' '.repeat(this.term.cols) }]);
        continue;
      }
      lines.push(extractRuns(line, this.term.cols));
    }
    return {
      cols: this.term.cols,
      rows: this.term.rows,
      lines,
      cursorX: buffer.cursorX,
      cursorY: buffer.cursorY,
      rev: this.rev,
    };
  }
}
