// Bear's own look, the grizzly bear suit (#7125, redrawn in #7169): no outline-ink fills,
// an outer suit that never drops below wood[1] so it stays off the road, two round ears on
// every hood, thick arms that keep their colour across the chest, silvertips on the shoulder
// hump, a tan belly from the front and only a stub tail behind. These pin the data in
// bandus.ts; how it reads on the road, and beside Satori and Rex, was judged by eye.

import { describe, expect, it } from 'vitest';
import type { DrawnDir } from '../src/art/kit.ts';
import { RAMPS } from '../src/art/palette.ts';
import type { Color } from '../src/art/palette.ts';
import { BANDUS } from '../src/art/survivors/bandus.ts';

const DIRS: readonly DrawnDir[] = [0, 1, 2, 6, 7];
const OUTLINE = new Set(['k', 'K']);
const INKS = new Set<Color>(RAMPS.ink);
/** Letters that fill the outside of the suit: the fur, the legs and the paws. */
const SUIT = 'vutrqpRQPgf';

function woodStep(color: Color | null | undefined): number {
  return (RAMPS.wood as readonly Color[]).indexOf(color as Color);
}

/** Runs of drawn pixels in one grid row. */
function runs(row: string): number[] {
  return row.split('.').filter((run) => run.length > 0).map((run) => run.length);
}

describe('Bear grizzly look (#7125, #7169)', () => {
  it('maps only the outline letters to ink, near and far', () => {
    for (const legend of [BANDUS.legend, BANDUS.farLegend]) {
      for (const [letter, color] of Object.entries(legend)) {
        const inked = color !== null && INKS.has(color);
        if (inked) expect(OUTLINE.has(letter), letter).toBe(true);
      }
    }
  });

  it('keeps every outside suit letter in wood at wood[1] or lighter, near and far', () => {
    for (const legend of [BANDUS.legend, BANDUS.farLegend]) {
      for (const letter of SUIT) expect(woodStep(legend[letter]), letter).toBeGreaterThanOrEqual(1);
    }
  });

  it('keeps each far paw letter in wood and never lighter than the near one', () => {
    for (const letter of 'gf') {
      const near = woodStep(BANDUS.legend[letter]);
      const far = woodStep(BANDUS.farLegend[letter]);
      expect(far, letter).toBeGreaterThanOrEqual(0);
      expect(far, letter).toBeLessThanOrEqual(near);
    }
  });

  it('puts two separate ears, each at least 2 px wide, on top of every hood', () => {
    for (const dir of DIRS) {
      const top = runs(BANDUS.heads[dir].rows[0]);
      expect(top.length, `head ${dir}`).toBe(2);
      for (const width of top) expect(width, `head ${dir}`).toBeGreaterThanOrEqual(2);
    }
  });

  it('keeps his full build with thick arms', () => {
    expect(BANDUS.spread).toBe(0);
    expect(BANDUS.shorter).toBeUndefined();
    expect(BANDUS.thick).toBe(true);
  });

  it('starts the sleeve and cuff on the wood ramp floor, so the rig does not darken them across the chest', () => {
    expect(BANDUS.sleeve[0]).toBe(RAMPS.wood[0]);
    expect(BANDUS.cuff[0]).toBe(RAMPS.wood[0]);
  });

  it('tips the shoulder hump with silvertip fur from behind', () => {
    expect(RAMPS.bone as readonly Color[]).toContain(BANDUS.legend.x);
    for (const dir of [6, 7] as const) expect(BANDUS.torsos[dir].rows[1], `torso ${dir}`).toMatch(/xx/);
  });

  it('shows the tan belly on every front torso', () => {
    for (const dir of [1, 2] as const) expect(BANDUS.torsos[dir].rows.join(''), `torso ${dir}`).toContain('z');
  });

  it('wears only a stub tail, no more than 4 px either way', () => {
    for (const dir of DIRS) {
      const tail = BANDUS.packs?.[dir];
      if (!tail) continue;
      expect(tail.rows.length, `tail ${dir}`).toBeLessThanOrEqual(4);
      expect(Math.max(...tail.rows.map((row) => row.length)), `tail ${dir}`).toBeLessThanOrEqual(4);
    }
  });
});
