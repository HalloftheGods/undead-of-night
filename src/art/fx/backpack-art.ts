import type { BackpackTier } from '../../../shared/backpack.ts';
import type { Legend } from '../kit.ts';
import { PixelCanvas } from '../kit.ts';
import { RAMPS } from '../palette.ts';
import type { PixelSprite } from '../types.ts';
import type { Grid } from './shared.ts';

const { bone, denim, ink, metal, olive, wood } = RAMPS;

export const BACKPACK_LEGEND: Legend = {
  k: ink[0],
  K: ink[1],
  w: wood[0],
  x: wood[1],
  y: wood[2],
  z: wood[3],
  a: olive[0],
  b: olive[1],
  c: olive[2],
  m: metal[0],
  n: metal[1],
  o: metal[2],
  p: metal[3],
  u: denim[0],
  v: denim[1],
  j: denim[2],
  e: bone[3],
  f: bone[2],
};

/** Compact leather/canvas shoulder satchel (Tier 1). */
export const SATCHEL_GRID: Grid = [
  '..kzzzzk..',
  '.kzyyyyzk.',
  'kzyyppyyzk',
  'kxxxxxxxxx',
  'kxxmppmxxx',
  'kxxwyywxxx',
  '.kwwwwwwk.',
  '..kkkkkk..',
];

/** Sturdy olive utility duffel (Tier 2). */
export const DUFFEL_GRID: Grid = [
  '..kaaaaaaak..',
  '.kaccbccccak.',
  'kabckkmkkcba',
  'kbbckkmkkbbk',
  'kbbckkmkkbbk',
  'kaaaaaaaaaak',
  '.kaapppaak..',
  '..kkkkkkkk..',
];

/** Heavy reinforced military ALICE rucksack with external pouches and clips (Tier 3). */
export const ALICE_GRID: Grid = [
  '...kcccccck...',
  '..kcbbmmbbck..',
  '.kcbbccccbbck.',
  '.kbbkkkkkkbbk.',
  'kbbmbbccbbmbk',
  'kbbmbbccbbmbk',
  'kbbkbbccbbkbk',
  'kbbkbbccbbkbk',
  'kbbkbbccbbkbk',
  '.kaaaaaaaak..',
  '..kkkmmkkk...',
  '...kkkkkk....',
];

export function buildBackpackSprite(tier: BackpackTier): PixelSprite {
  const isSatchel = tier === 'satchel';
  if (isSatchel) {
    return PixelCanvas.fromGrid(SATCHEL_GRID, BACKPACK_LEGEND).toSprite(undefined, undefined, 5, 4);
  }

  const isDuffel = tier === 'duffel';
  if (isDuffel) {
    return PixelCanvas.fromGrid(DUFFEL_GRID, BACKPACK_LEGEND).toSprite(undefined, undefined, 6, 4);
  }

  return PixelCanvas.fromGrid(ALICE_GRID, BACKPACK_LEGEND).toSprite(undefined, undefined, 7, 6);
}
