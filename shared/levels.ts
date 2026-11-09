import { STANDING_POPULATION } from './constants.ts';

/** The look of a town. Palette, lighting and weather only: every level is built from the same art. */
export type LevelTheme =
  | 'night'
  | 'industrial-dusk'
  | 'flooded'
  | 'contaminated'
  | 'blackout'
  | 'emergency'
  | 'snow'
  | 'infested'
  | 'burning'
  | 'bunker';

/** Shares of a crowd added to what level 1 already has, for roamers and hordes alike. */
export interface ZombieMix {
  readonly runner: number;
  readonly bloater: number;
  readonly brute: number;
}

export interface LevelDef {
  readonly number: number;
  /** The town's name, a pun on its number. What players see where they once saw "Level 3". */
  readonly town: string;
  readonly title: string;
  /** Hordes to survive before the exit opens. */
  readonly hordes: number;
  /** Scales the roaming population, the ammo in town and every horde's size. */
  readonly difficulty: number;
  readonly theme: LevelTheme;
  readonly mix: ZombieMix;
}

/** A run, in order. Level 1 adds nothing, so it plays as the endless game did. */
export const LEVELS: readonly LevelDef[] = [
  { number: 1, town: 'One Town', title: 'Silent Ruins', hordes: 2, difficulty: 1, theme: 'night', mix: { runner: 0, bloater: 0, brute: 0 } },
  { number: 2, town: 'Two City', title: 'Escalation', hordes: 2, difficulty: 1.06, theme: 'night', mix: { runner: 0.02, bloater: 0.01, brute: 0 } },
  { number: 3, town: 'Three Country', title: 'Into the Breach', hordes: 3, difficulty: 1.13, theme: 'industrial-dusk', mix: { runner: 0.04, bloater: 0.02, brute: 0 } },
  { number: 4, town: 'Four Corners', title: 'Abyssal Depths', hordes: 3, difficulty: 1.2, theme: 'flooded', mix: { runner: 0.06, bloater: 0.03, brute: 0.005 } },
  { number: 5, town: 'Fiville', title: 'Contamination Zone', hordes: 3, difficulty: 1.27, theme: 'contaminated', mix: { runner: 0.08, bloater: 0.05, brute: 0.01 } },
  { number: 6, town: 'Sixburg', title: 'Blackout', hordes: 4, difficulty: 1.34, theme: 'blackout', mix: { runner: 0.1, bloater: 0.05, brute: 0.015 } },
  { number: 7, town: 'Seven Springs', title: 'Quarantine Breach', hordes: 4, difficulty: 1.41, theme: 'emergency', mix: { runner: 0.13, bloater: 0.06, brute: 0.02 } },
  { number: 8, town: 'Eight Below', title: 'Frozen Wasteland', hordes: 4, difficulty: 1.48, theme: 'snow', mix: { runner: 0.15, bloater: 0.06, brute: 0.025 } },
  { number: 9, town: 'Ninevah', title: 'The Hive', hordes: 5, difficulty: 1.54, theme: 'infested', mix: { runner: 0.17, bloater: 0.08, brute: 0.03 } },
  { number: 10, town: 'Tenacity', title: 'Final Stand', hordes: 5, difficulty: 1.6, theme: 'burning', mix: { runner: 0.2, bloater: 0.08, brute: 0.04 } },
];

/** The bunker's name, the town before One Town. */
export const BASE_NAME = 'Zero Point';

export const FIRST_LEVEL = 1;
export const FINAL_LEVEL = LEVELS.length;

/** Odd and large, so neighbouring levels land far apart in seed space. */
const LEVEL_SEED_STEP = 0x9e3779b1;
/** The same again for a level's later attempts, with a step of its own. */
const ATTEMPT_SEED_STEP = 0x85ebca6b;

/** The row for a level number, with anything out of range held to the ends of the run. */
export function levelDef(level: number): LevelDef {
  const index = Math.min(FINAL_LEVEL, Math.max(FIRST_LEVEL, Math.floor(level))) - 1;
  return LEVELS[index];
}

/** Level 1 is the run seed itself; the rest follow from it, so server and clients agree on every town. Each later attempt is a fresh one. */
export function levelSeed(runSeed: number, level: number, attempt = 0): number {
  const stepsIn = level - FIRST_LEVEL;
  const town = stepsIn === 0 ? runSeed : (runSeed ^ Math.imul(stepsIn, LEVEL_SEED_STEP)) >>> 0;
  return attempt === 0 ? town : (town ^ Math.imul(attempt, ATTEMPT_SEED_STEP)) >>> 0;
}

/** Roaming zombies a level's town holds. */
export const levelPopulation = (level: number): number => Math.round(STANDING_POPULATION * levelDef(level).difficulty);

/** A level's town name, for anywhere a player reads it. */
export const townName = (level: number): string => levelDef(level).town;
