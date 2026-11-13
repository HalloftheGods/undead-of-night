// Where the horde breaks in: how many fence sections give, which ones, and where outside each gap the horde gathers.
// Picked with the sim's own rolls on the tick the clock arms, so every client sees the same sections rattle.

import type { DifficultyId } from '../difficulty.ts';
import { TILE_SIZE } from '../map-protocol.ts';
import type { Rng } from '../rng.ts';
import type { FenceSection } from './camp-ring.ts';
import { gapGround } from './camp-ring.ts';

/** Most sections one breach brings down. */
export const OVERRUN_GAPS_MAX = 4;
/** Sections kept between picks round the ring while the ring has room for them. */
export const OVERRUN_GAP_SPACING = 4;
/** The horde gathers this far outside a gap, give or take `GAP_SPAWN_SCATTER_TILES`: 4 to 7 tiles out. */
export const GAP_SPAWN_OUT_TILES = 5.5;
export const GAP_SPAWN_SCATTER_TILES = 1.5;

/** A run on these gives one place more. */
const HARD_RUNS: ReadonlySet<DifficultyId> = new Set<DifficultyId>(['lights_out', 'undead_tired']);

/** From which level the fence gives in how many places, furthest first. Below the last, one. */
const PLACES_FROM_LEVEL: readonly (readonly [number, number])[] = [
  [7, 3],
  [4, 2],
];

/** One place below level 4, two to level 6, three from level 7; one more on a hard run; never fewer than one or more than four. */
export function gapCount(level: number, difficulty: DifficultyId): number {
  const byLevel = PLACES_FROM_LEVEL.find(([from]) => level >= from)?.[1] ?? 1;
  const byDifficulty = HARD_RUNS.has(difficulty) ? 1 : 0;
  return Math.max(1, Math.min(OVERRUN_GAPS_MAX, byLevel + byDifficulty));
}

/**
 * Up to `count` breachable sections, in ring order. Spread at least `OVERRUN_GAP_SPACING` apart round the ring, then, if that
 * leaves fewer than asked, at least one section apart. One roll per section picked, so the sim's stream moves by a known amount.
 */
export function pickGaps(sections: readonly FenceSection[], count: number, rng: Rng): number[] {
  const n = sections.length;
  const ringGap = (a: number, b: number): number => Math.min(Math.abs(a - b), n - Math.abs(a - b));
  const breachable = sections.filter((s) => s.breachable).map((s) => s.index);
  const picked: number[] = [];
  for (const spacing of [OVERRUN_GAP_SPACING, 2]) {
    const fits = (i: number): boolean => !picked.includes(i) && picked.every((p) => ringGap(p, i) >= spacing);
    let left = breachable.filter(fits);
    while (picked.length < count && left.length > 0) {
      picked.push(left[Math.floor(rng() * left.length)]);
      left = left.filter(fits);
    }
  }
  return picked.sort((a, b) => a - b);
}

/** The middle of the open ground outside a gap, where its share of the horde is put down. */
export function gapSpawnCentre(section: FenceSection): { x: number; y: number } {
  const box = gapGround(section);
  const out = GAP_SPAWN_OUT_TILES * TILE_SIZE;
  return { x: (box.x0 + box.x1) / 2 + section.out.x * out, y: (box.y0 + box.y1) / 2 + section.out.y * out };
}
