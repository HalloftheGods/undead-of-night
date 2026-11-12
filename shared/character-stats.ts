// The select screen's stat bars, derived from the survivors' tuning in characters.ts so the
// numbers live in one place. A bar is STAT_SLOTS long; a stat nobody changes sits at STAT_BASELINE.

import { CHARACTERS, characterOf, type Character } from './characters.ts';

export const STAT_SLOTS = 5;
export const STAT_BASELINE = 0;

export type StatKey = 'stealth' | 'reload' | 'speed' | 'strength' | 'search';

export const STATS: readonly { readonly key: StatKey; readonly label: string }[] = [
  { key: 'stealth', label: 'Stealth' },
  { key: 'reload', label: 'Reload' },
  { key: 'speed', label: 'Speed' },
  { key: 'strength', label: 'Strength' },
  { key: 'search', label: 'Loot' },
];

/** How much better than normal each stat is: 1 is normal, higher is better. Stealth is how little of the zombies' senses a survivor gives away: spotted from sightRange as far and heard from noise as far, so the two shrink the reach together. Search weighs a kill's drop odds by the extra chance of a find in a bare container. */
const BENEFIT: Record<StatKey, (character: Character) => number> = {
  stealth: (c) => 1 / (c.sightRange * c.noise),
  reload: (c) => 1 / c.reloadTime,
  speed: (c) => c.moveSpeed,
  strength: (c) => c.shoveForce,
  search: (c) => c.dropOdds * (1 + c.searchLuck),
};

function bestBenefit(key: StatKey): number {
  return Math.max(1, ...CHARACTERS.map(BENEFIT[key]));
}

export function statSlots(character: Character): Record<StatKey, number> {
  const slots = {} as Record<StatKey, number>;
  for (const { key } of STATS) {
    const best = bestBenefit(key);
    const share = best > 1 ? (BENEFIT[key](character) - 1) / (best - 1) : 0;
    const filled = STAT_BASELINE + Math.round(share * (STAT_SLOTS - STAT_BASELINE));
    slots[key] = Math.min(STAT_SLOTS, Math.max(STAT_BASELINE, filled));
  }
  return slots;
}

export function statSlotsOf(skin: number): Record<StatKey, number> {
  return statSlots(characterOf(skin));
}
