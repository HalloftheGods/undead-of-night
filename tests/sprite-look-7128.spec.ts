// Kai's look (#7128): round glasses drawn as rims with the eyes showing through, and
// dark-brown hair that keeps an edge against the outline instead of outline ink.
// These checks pin the grid shapes only; how the sprite reads is judged by eye on the
// contact sheets, not here.

import { describe, expect, it } from 'vitest';
import { RAMPS } from '../src/art/palette.ts';
import type { Color } from '../src/art/palette.ts';
import { SOL } from '../src/art/survivors/sol.ts';

const INKS = new Set<Color>(RAMPS.ink);
/** Letters that draw outline ink in Kai's grids: the glasses rims and the pupils. */
const OUTLINE = new Set(['k', 'K']);
/** Heads that face the viewer and wear the glasses: E, SE and S. */
const FACE_DIRS = [0, 1, 2] as const;
/** Most outline-ink pixels a face head may carry (the old masks had 10 to 14). */
const MAX_FACE_INK = 8;

function inkCount(rows: readonly string[]): number {
  let n = 0;
  for (const row of rows) for (const letter of row) n += OUTLINE.has(letter) ? 1 : 0;
  return n;
}

describe('Kai glasses (#7128)', () => {
  it('keeps every face head under the ink budget', () => {
    for (const dir of FACE_DIRS) expect(inkCount(SOL.heads[dir].rows), `head ${dir}`).toBeLessThanOrEqual(MAX_FACE_INK);
  });

  it('never runs three outline pixels side by side across a face', () => {
    for (const dir of FACE_DIRS) for (const row of SOL.heads[dir].rows) expect(row, `head ${dir}`).not.toMatch(/[kK]{3}/);
  });

  it('shows each eye as a pupil with a lit glint to its left', () => {
    for (const dir of FACE_DIRS) {
      const glints = SOL.heads[dir].rows.join('|').match(/lk/g) ?? [];
      expect(glints.length, `head ${dir}`).toBeGreaterThanOrEqual(dir === 0 ? 1 : 2);
    }
  });
});

describe('Kai hair (#7128)', () => {
  it('maps no hair letter to outline ink, near or far', () => {
    for (const letter of ['h', 'i', 'j']) {
      // A letter the legend leaves out or blanks is not ink either.
      expect(INKS.has(SOL.legend[letter] ?? -1), `legend ${letter}`).toBe(false);
      expect(INKS.has(SOL.farLegend[letter] ?? -1), `far ${letter}`).toBe(false);
    }
  });
});
