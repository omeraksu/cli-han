import { describe, it, expect } from 'vitest';
import { avatarCells } from './Avatar.js';

describe('avatarCells', () => {
  it('is deterministic for the same pubkey', () => {
    const pk = '9mdvkieFVKursJ1rL2fCaxvNUuDkTznitSCk8u39RAZX';
    const a = avatarCells(pk);
    const b = avatarCells(pk);
    expect(a).toEqual(b);
  });

  it('differs across distinct pubkeys', () => {
    const a = avatarCells('9mdvkieFVKursJ1rL2fCaxvNUuDkTznitSCk8u39RAZX');
    const b = avatarCells('GBTmt5CgCFfnjbruroanitjMVF8LF1EjabdQvkGrTSir');
    // not every cell needs to differ, but the whole grid should
    expect(a).not.toEqual(b);
  });

  it('produces a horizontally symmetric grid', () => {
    const cells = avatarCells('43HZzxFiYNM2syXRskxZP3vHEABRyB3ZxriLzhe8xgJc');
    // for each row, column 0 should equal column 2
    for (let row = 0; row < 3; row++) {
      const left = cells[row * 3];
      const right = cells[row * 3 + 2];
      expect(left).toEqual(right);
    }
  });

  it('returns 9 cells', () => {
    const cells = avatarCells('anyPubkeyString');
    expect(cells).toHaveLength(9);
  });
});
