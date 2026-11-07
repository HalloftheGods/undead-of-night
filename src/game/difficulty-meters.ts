import { BASELINE_DIFFICULTY, DIFFICULTIES } from '../../shared/difficulty.ts';
import type { DifficultyDef } from '../../shared/difficulty.ts';

/** Segments in every meter. */
export const METER_SLOTS = 5;
/** Where the baseline difficulty sits: the middle of the bar. */
const BASELINE_SLOTS = 3;

type Multiplier = 'zombieSpeed' | 'zombieDamage' | 'hordeSize' | 'ammo';

export interface DifficultyMeter {
  readonly key: Multiplier;
  readonly label: string;
  /** Segments lit out of METER_SLOTS. */
  readonly slots: number;
}

/** Zombie rows grow with danger. Ammo is the odd one out: more segments means more ammo. */
const METERS: readonly { key: Multiplier; label: string }[] = [
  { key: 'zombieSpeed', label: 'Speed' },
  { key: 'zombieDamage', label: 'Bite' },
  { key: 'hordeSize', label: 'Horde' },
  { key: 'ammo', label: 'Ammo' },
];

const baseline = DIFFICULTIES.find((each) => each.id === BASELINE_DIFFICULTY) as DifficultyDef;

/** Slots for one value: the baseline is the middle, the table's extremes are the ends. */
function slotsFor(key: Multiplier, value: number): number {
  const all = DIFFICULTIES.map((each) => each[key]);
  const mid = baseline[key];
  const span = BASELINE_SLOTS - 1;
  const isUpperHalf = value >= mid;
  if (isUpperHalf) {
    const room = Math.max(...all) - mid;
    return room > 0 ? BASELINE_SLOTS + Math.round((span * (value - mid)) / room) : BASELINE_SLOTS;
  }
  const room = mid - Math.min(...all);
  return room > 0 ? BASELINE_SLOTS - Math.round((span * (mid - value)) / room) : BASELINE_SLOTS;
}

/** The at-a-glance bars for a difficulty, in display order. */
export function difficultyMeters(def: DifficultyDef): DifficultyMeter[] {
  return METERS.map(({ key, label }) => ({ key, label, slots: slotsFor(key, def[key]) }));
}
