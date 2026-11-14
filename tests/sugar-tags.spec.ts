import { describe, expect, it } from 'vitest';
import { CANDIES, CANDY_SEC, FULL_SIZE_SEC } from '../shared/candy.ts';
import type { CandyId } from '../shared/protocol.ts';
import { FONT_HEIGHT } from '../src/engine/bitmap-font.ts';
import { FloatingTexts } from '../src/engine/floating-texts.ts';
import { SUGAR_WARN_SEC, sugarTags } from '../src/engine/sugar-tags.ts';
import type { KeepOut } from '../src/engine/sugar-tags.ts';

function eater(sugar: { id: CandyId; left: number; total?: number }[], status: 'alive' | 'downed' | 'dead' = 'alive') {
  return { status, sugar };
}

describe('the candy timer over a head', () => {
  it('shows nothing without candy working', () => {
    expect(sugarTags({ status: 'alive' }, 0)).toEqual([]);
  });

  it('names the stat and the whole seconds left, with a bar for the whole boost', () => {
    const [tag] = sugarTags(eater([{ id: 'pumpkin_fizz', left: CANDY_SEC / 2 - 0.2 }]), 0);
    expect(tag.label).toBe(`${CANDIES.pumpkin_fizz.stat} ${Math.ceil(CANDY_SEC / 2 - 0.2)}`);
    expect(tag.fraction).toBeCloseTo((CANDY_SEC / 2 - 0.2) / CANDY_SEC);
    expect(tag.lit).toBe(true);
  });

  it('measures a Full-Size Bar against its own short boost', () => {
    const [tag] = sugarTags(eater([{ id: 'full_size_bar', left: FULL_SIZE_SEC }]), 0);
    expect(tag.label).toBe(`ALL ${FULL_SIZE_SEC}`);
    expect(tag.fraction).toBe(1);
  });

  it('gives a line to each candy working, oldest first', () => {
    const tags = sugarTags(eater([{ id: 'jawbreaker', left: 40 }, { id: 'ghost_gum', left: 70 }]), 0);
    expect(tags.map((tag) => tag.label)).toEqual(['ARMOR 40', 'QUIET 70']);
  });

  it('blinks in the last seconds, and only then', () => {
    const sugar = [{ id: 'sour_skulls' as const, left: SUGAR_WARN_SEC - 1 }];
    const beats = [0, 1 / 6, 2 / 6, 3 / 6].map((time) => sugarTags(eater(sugar), time)[0].lit);
    expect(beats).toContain(false);
    expect(beats).toContain(true);
    const early = [0, 1 / 6].map((time) => sugarTags(eater([{ id: 'sour_skulls', left: 30 }]), time)[0].lit);
    expect(early).toEqual([true, true]);
  });

  it('is gone once the survivor is down or dead', () => {
    expect(sugarTags(eater([{ id: 'jawbreaker', left: 40 }], 'downed'), 0)).toEqual([]);
    expect(sugarTags(eater([{ id: 'jawbreaker', left: 40 }], 'dead'), 0)).toEqual([]);
  });

  it('has a short stat word for every candy', () => {
    for (const def of Object.values(CANDIES)) expect(def.stat).toMatch(/^[A-Z]{3,7}$/);
  });
});

describe('pickup notes and the candy timer', () => {
  const box: KeepOut = { x: 100, top: 60, bottom: 80, width: 30 };

  function overlaps(texts: FloatingTexts): boolean {
    return texts.lines().some((line) => line.top < box.bottom && line.top + FONT_HEIGHT + 2 > box.top);
  }

  it('lifts a note rising out of a head over the timer, and it never comes back down onto it', () => {
    const texts = new FloatingTexts();
    texts.add('+4 SHELLS', 100, 86, '#fff');
    for (let t = 0; t < 1; t += 1 / 60) {
      texts.update(1 / 60);
      texts.keepClear([box]);
      expect(overlaps(texts)).toBe(false);
    }
  });

  it('leaves notes beside the timer where they are', () => {
    const texts = new FloatingTexts();
    texts.add('SMASH', 200, 86, '#fff');
    texts.update(1 / 60);
    const before = texts.lines()[0].top;
    texts.keepClear([box]);
    expect(texts.lines()[0].top).toBe(before);
  });
});
