import { describe, expect, it } from 'vitest';
import { CHARACTERS } from '../shared/characters.ts';
import { DIFFICULTIES } from '../shared/difficulty.ts';
import { statBarsOf } from '../src/game/character-select-view.ts';
import { createInitialProgression } from '../shared/progression.ts';
import { PROGRESSION_STORAGE_KEY } from '../shared/progression-save.ts';
import { chosenOption, dialSlots, longestWord, setupPicks, setupProgression, stepFocus } from '../src/game/setup-picks.ts';

describe('setup progression', () => {
  const NOW = 1_700_000_000_000;
  const DAY_MS = 24 * 60 * 60 * 1000;

  function storeWith(saved: unknown) {
    const memory = new Map<string, string>([[PROGRESSION_STORAGE_KEY, JSON.stringify(saved)]]);
    return { getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, val: string) => void memory.set(key, val) };
  }

  it('takes the missed week out of banked AP before any is spent on the survivor', () => {
    const start = createInitialProgression(NOW - 8 * DAY_MS);
    const store = storeWith({ ...start, level: 3, ap: 1, allocations: { ...start.allocations, 0: { spentAp: { stealth: 0, reload: 1, speed: 0, strength: 0, search: 0 } } } });
    const after = setupProgression(1, store, NOW);
    // Spending first would put the AP on survivor 1 and take survivor 0's pip instead.
    expect(after).toMatchObject({ ap: 0, owedAp: 1, rustySkins: [] });
    expect(after.allocations[0].spentAp.reload).toBe(1);
    expect(Object.values(after.allocations[1].spentAp)).toEqual([0, 0, 0, 0, 0]);
  });

  it('spends banked AP on the picked survivor and saves it', () => {
    const store = storeWith({ ...createInitialProgression(NOW), level: 3, ap: 2 });
    const after = setupProgression(1, store, NOW);
    expect(after.ap).toBe(0);
    expect(Object.values(after.allocations[1].spentAp).reduce((sum, n) => sum + n, 0)).toBe(2);
    expect(JSON.parse(store.getItem(PROGRESSION_STORAGE_KEY)!).ap).toBe(0);
  });
});

describe('setup picks', () => {
  it('lays out mode, difficulty and survivor, numbered in that order; the Level card takes number 3 between difficulty and survivor', () => {
    const picks = setupPicks({ mode: 'solo', difficulty: 'stay_close', survivor: 0 });
    expect(picks.map((pick) => [pick.number, pick.key, pick.label])).toEqual([
      [1, 'mode', 'Mode'],
      [2, 'difficulty', 'Difficulty'],
      [4, 'who', 'Survivor'],
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
    expect(chosenOption(who)).toEqual({ id: '3', name: 'Rex', bars: statBarsOf(3), level: 1, isMaxed: false, isRusty: false });
  });

  it('reflects progression and displays OP badge when survivor is maxed', () => {
    const maxedProgression = {
      level: 21,
      xp: 0,
      ap: 0,
      gp: 0,
      allocations: {
        3: { spentAp: { stealth: 5, reload: 5, speed: 5, strength: 0, search: 5 } },
      },
    };
    const who = setupPicks({ mode: 'solo', difficulty: 'stay_close', survivor: 3 }, maxedProgression as any)[2];
    const rex = chosenOption(who);
    expect(rex.name).toBe('OP Rex');
    expect(rex.level).toBe(21);
    expect(rex.isMaxed).toBe(true);
    expect(rex.isRusty).toBe(false);
    for (const bar of rex.bars) {
      expect(bar.filled).toBe(5);
    }
  });

  it('reflects rusty status when survivor has decayed from inactivity', () => {
    const rustyProgression = {
      level: 20,
      xp: 0,
      ap: 19,
      gp: 0,
      rustySkins: [3],
      allocations: {
        3: { spentAp: { stealth: 0, reload: 0, speed: 0, strength: 0, search: 0 } },
      },
    };
    const who = setupPicks({ mode: 'solo', difficulty: 'stay_close', survivor: 3 }, rustyProgression as any)[2];
    const rex = chosenOption(who);
    expect(rex.name).toBe('Rusty Rex');
    expect(rex.isRusty).toBe(true);
    expect(rex.isMaxed).toBe(false);
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

  it('measures a title by its longest word', () => {
    expect(longestWord('Night Light On')).toBe(5);
    expect(longestWord('Multiplayer')).toBe(11);
    expect(longestWord('')).toBe(1);
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
