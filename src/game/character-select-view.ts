// The survivor select screen's plain parts: the bars each survivor shows, and where an arrow key moves the pick.

import { CHARACTERS } from '../../shared/characters.ts';
import { STAT_BASELINE, STAT_SLOTS, STATS, statSlotsOf } from '../../shared/character-stats.ts';
import type { StatKey } from '../../shared/character-stats.ts';
import { effectiveStatSlots, SPECIALTY_STAT_BY_SKIN, type ProgressionState } from '../../shared/progression.ts';

export interface StatBar {
  readonly key: StatKey;
  readonly label: string;
  readonly filled: number;
  /** Better than a plain survivor at this, so the screen picks it out. */
  readonly strong: boolean;
}

/** One survivor's five bars, in the order the screen lists them. */
export function statBarsOf(skin: number, progression?: ProgressionState): readonly StatBar[] {
  const specialtyKey = SPECIALTY_STAT_BY_SKIN[skin];
  const slots = progression
    ? effectiveStatSlots(skin, progression.allocations[skin])
    : statSlotsOf(skin);
  return STATS.map(({ key, label }) => {
    const filled = slots[key] ?? 0;
    const isSpecialty = key === specialtyKey;
    const isMaxed = filled === STAT_SLOTS;
    return {
      key,
      label,
      filled,
      strong: isSpecialty || isMaxed || filled > STAT_BASELINE,
    };
  });
}

const STEPS: Partial<Record<string, number>> = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 };

/** The survivor an arrow key moves the pick to, wrapping round the roster as a radio group does; null for any other key. */
export function rosterStep(at: number, key: string, count: number = CHARACTERS.length): number | null {
  const step = STEPS[key] ?? 0;
  const moves = step !== 0 && count > 0;
  if (!moves) return null;
  return (((at + step) % count) + count) % count;
}
