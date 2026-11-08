// More bodies cut from the sedan's grids, so every car on the road shares one hand: a hatchback
// with the boot taken off, and a pickup whose cab ends at the rear glass and carries an open bed.

import type { PixelSprite } from '../types.ts';
import { RAMPS } from '../palette.ts';
import type { Ramp } from '../palette.ts';
import {
  bakeNoseUp,
  bakeSideOn,
  noseUpBody,
  SEDAN,
  SEDAN_V,
  sideOnBody,
  STEEL,
} from './vehicles.ts';

const { ink, wood, metal } = RAMPS;

/** The sedan short in the roof and missing its boot. */
export const HATCH = SEDAN.map((row) => row.slice(0, 24) + row.slice(30, 39) + row.slice(41));
export const HATCH_W = 36;

export function buildHatchH(paint: Ramp = STEEL): PixelSprite {
  return bakeSideOn(sideOnBody(HATCH, HATCH_W, [5, 23], paint), HATCH_W);
}

/** Nose up: the boot rows go, so the rear glass runs straight down to the tail. */
export const HATCH_V = [...SEDAN_V.slice(0, 35), ...SEDAN_V.slice(39)];

export function buildHatchV(paint: Ramp = STEEL): PixelSprite {
  return bakeNoseUp(noseUpBody(HATCH_V, paint), HATCH_V);
}

const CAB = SEDAN.map((row) => row.slice(0, 24) + row.slice(34, 39));
const BED_LENGTH = 17;

/**
 * The bed's columns, row by row, as the letter along it and the letter at its tail: open sky, the far
 * rail, its inner face, the floor, the near rail, then the side with its tail lamps and the sill.
 */
const BED_ROWS: readonly (readonly [fill: string, cap: string])[] = [
  ['.', '.'], ['.', '.'], ['.', '.'], ['.', '.'],
  ['P', 'P'], ['p', 'd'],
  ['f', 'd'], ['f', 'd'], ['f', 'd'], ['f', 'd'], ['f', 'd'], ['f', 'd'],
  ['P', 'd'], ['d', 'd'], ['P', 'd'],
  ['p', 'R'], ['p', 'R'], ['p', 'd'], ['p', 'd'], ['p', 'd'],
  ['k', 'm'],
];

const bedRow = (row: number): string => {
  const [fill, cap] = BED_ROWS[row];
  return fill.repeat(BED_LENGTH - 1) + cap;
};

/** The cab, then the bed, then the cab's own tail pushed out past the bed. */
export const PICKUP = CAB.map((row, i) => row + bedRow(i));
export const PICKUP_W = 46;

export function buildPickupH(paint: Ramp = STEEL): PixelSprite {
  const c = sideOnBody(PICKUP, PICKUP_W, [5, 32], paint);
  // Ribs in the bed floor, a spare tyre and a toolbox left in the back.
  const floorX = 1 + CAB[0].length;
  for (let x = floorX + 2; x < floorX + BED_LENGTH - 2; x += 4) c.rect(x, 7, 1, 6, ink[0]);
  c.rect(floorX + 2, 9, 5, 3, ink[0]).rect(floorX + 3, 10, 3, 1, metal[1]);
  c.rect(floorX + 10, 9, 4, 2, wood[2]).rect(floorX + 10, 11, 4, 1, wood[1]);
  return bakeSideOn(c, PICKUP_W);
}
