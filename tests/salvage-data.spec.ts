import { describe, expect, it } from 'vitest';
import { PICKUP_TYPES, SALVAGE_TYPES } from '../shared/events.ts';
import { FINAL_LEVEL, FIRST_LEVEL } from '../shared/levels.ts';
import { isSalvagePickup, SALVAGE_LABEL, SALVAGE_RECIPES, SALVAGE_SOURCES, salvageCounts } from '../shared/salvage-data.ts';
import { EFFECT_ORDER } from '../shared/round-effect-data.ts';

describe('salvage data', () => {
  it('is a pickup like any other, appended after the rest', () => {
    // Salvage sits as one block in the pickup list (fortification items were appended after it).
    const at = PICKUP_TYPES.indexOf(SALVAGE_TYPES[0]);
    expect(PICKUP_TYPES.slice(at, at + SALVAGE_TYPES.length)).toEqual([...SALVAGE_TYPES]);
    expect(SALVAGE_TYPES.every(isSalvagePickup)).toBe(true);
    expect(isSalvagePickup('jewel_small')).toBe(false);
  });

  it('holds the spec counts at the first and last level, and half of them on a replay', () => {
    expect(salvageCounts(FIRST_LEVEL, false)).toEqual({ fuel_can: 3, car_battery: 2, scrap_steel: 3, sedatives: 2 });
    expect(salvageCounts(FINAL_LEVEL, false)).toEqual({ fuel_can: 5, car_battery: 4, scrap_steel: 5, sedatives: 3 });
    expect(salvageCounts(FIRST_LEVEL, true)).toEqual({ fuel_can: 1, car_battery: 1, scrap_steel: 1, sedatives: 1 });
  });

  it('never holds less at a later level', () => {
    for (let level = FIRST_LEVEL + 1; level <= FINAL_LEVEL; level++) {
      const now = salvageCounts(level, false);
      const before = salvageCounts(level - 1, false);
      for (const id of SALVAGE_TYPES) expect(now[id], `${id} at ${level}`).toBeGreaterThanOrEqual(before[id]);
    }
  });

  it('has a recipe for every kit, a label and two ranks of sources for every kind', () => {
    expect(EFFECT_ORDER.map((effect) => SALVAGE_RECIPES[effect].count)).toEqual([4, 3, 3, 2]);
    expect(new Set(EFFECT_ORDER.map((effect) => SALVAGE_RECIPES[effect].salvage))).toEqual(new Set(SALVAGE_TYPES));
    for (const id of SALVAGE_TYPES) {
      expect(SALVAGE_LABEL[id]).toBeTruthy();
      expect(SALVAGE_SOURCES[id].every((rank) => rank.length > 0)).toBe(true);
    }
  });
});
