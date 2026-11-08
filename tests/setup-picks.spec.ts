import { describe, expect, it } from 'vitest';
import { CHARACTERS } from '../shared/characters.ts';
import { DIFFICULTIES } from '../shared/difficulty.ts';
import { statBarsOf } from '../src/game/character-select-view.ts';
import { chosenOption, dialSlots, setupPicks, stepFocus } from '../src/game/setup-picks.ts';

describe('setup picks', () => {
  it('lays out mode, difficulty and survivor, numbered in that order', () => {
    const picks = setupPicks({ mode: 'solo', difficulty: 'stay_close', survivor: 0 });
    expect(picks.map((pick) => [pick.number, pick.key, pick.label])).toEqual([
      [1, 'mode', 'Mode'],
      [2, 'difficulty', 'Difficulty'],
      [3, 'who', 'Survivor'],
    ]);
  });

  it('lists every option of each pick', () => {
    const [mode, difficulty, who] = setupPicks({ mode: 'solo', difficulty: 'stay_close', survivor: 0 });
    expect(mode.options.map((each) => each.id)).toEqual(['solo', 'multi']);
    expect(difficulty.options.map((each) => each.id)).toEqual(DIFFICULTIES.map((each) => each.id));
    expect(who.options.map((each) => each.name)).toEqual(CHARACTERS.map((each) => each.name));
  });

  it('marks what is chosen now', () => {
    const [mode, difficulty, who] = setupPicks({ mode: 'multi', difficulty: 'undead_tired', survivor: 3 });
    expect(chosenOption(mode).name).toBe('Multiplayer');
    expect(chosenOption(difficulty).name).toBe('Undead Tired');
    expect(chosenOption(who)).toEqual({ id: '3', name: 'Rex', bars: statBarsOf(3) });
  });

  it('gives every option stat bars of one to five cells, or none', () => {
    for (const pick of setupPicks({ mode: 'solo', difficulty: 'stay_close', survivor: 0 })) {
      for (const option of pick.options) {
        expect(option.bars.length).toBeGreaterThan(0);
        for (const bar of option.bars) {
          expect(bar.filled).toBeGreaterThanOrEqual(0);
          expect(bar.filled).toBeLessThanOrEqual(5);
        }
      }
    }
  });

  it('fills difficulty bars from easiest to hardest', () => {
    const difficulty = setupPicks({ mode: 'solo', difficulty: 'stay_close', survivor: 0 })[1];
    const horde = difficulty.options.map((option) => option.bars.find((bar) => bar.key === 'hordeSize')?.filled);
    expect(horde[0]).toBe(1);
    expect(horde.at(-1)).toBe(5);
    expect(dialSlots('ammo', 2)).toBe(5);
    expect(dialSlots('ammo', 0.6)).toBe(1);
  });

  it('shows Multiplayer seating more players than Solo', () => {
    const [solo, multi] = setupPicks({ mode: 'solo', difficulty: 'stay_close', survivor: 0 })[0].options;
    expect(multi.bars[0].filled).toBeGreaterThan(solo.bars[0].filled);
  });

  it('falls back to the first survivor for an index the table does not have', () => {
    const who = setupPicks({ mode: 'solo', difficulty: 'stay_close', survivor: 99 })[2];
    expect(who.chosen).toBe(0);
  });

  it('moves focus through an open list with the arrow keys, wrapping at the ends', () => {
    expect(stepFocus(0, 4, 'ArrowDown')).toBe(1);
    expect(stepFocus(0, 4, 'ArrowRight')).toBe(1);
    expect(stepFocus(3, 4, 'ArrowDown')).toBe(0);
    expect(stepFocus(0, 4, 'ArrowUp')).toBe(3);
    expect(stepFocus(2, 4, 'Home')).toBe(0);
    expect(stepFocus(1, 4, 'End')).toBe(3);
    expect(stepFocus(2, 4, 'a')).toBe(2);
  });
});
