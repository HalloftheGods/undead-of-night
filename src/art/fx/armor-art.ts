import type { Legend } from '../kit.ts';
import { PixelCanvas } from '../kit.ts';
import { RAMPS } from '../palette.ts';
import type { PixelSprite } from '../types.ts';
import type { Grid } from './shared.ts';

const { bone, denim, ink, metal, olive } = RAMPS;

export type ArmorTier = 'light' | 'medium' | 'heavy';

export const ARMOR_LEGEND: Legend = {
  k: ink[0],
  K: ink[1],
  m: metal[0],
  n: metal[1],
  o: metal[2],
  p: metal[3],
  u: denim[0],
  v: denim[1],
  j: denim[2],
  a: olive[0],
  b: olive[1],
  c: olive[2],
  e: bone[3],
  f: bone[2],
};

/** Compact concealable Kevlar vest (Tier 1). */
export const LIGHT_ARMOR_GRID: Grid = [
  '..kmmk..',
  '.knnnnk.',
  'knnooonk',
  'knnnmmnk',
  'knnnnnnk',
  '.kmmmmk.',
];

/** Standard tactical police vest with front ballistic plate (Tier 2). */
export const MEDIUM_ARMOR_GRID: Grid = [
  '..kuuk..',
  '.kvvvvk.',
  'kvvjjvvk',
  'kvkmmkvk',
  'kvvjjvvk',
  'kvvvvvvk',
  '.kuuuuk.',
];

/** Heavy reinforced military flak jacket with neck guard and shoulder attachments (Tier 3). */
export const HEAVY_ARMOR_GRID: Grid = [
  '.kbbbbk.',
  'kaaaaeak',
  'kabbfbbk',
  'kbbmmbbk',
  'kbbmmbbk',
  'kaaaaaak',
  '.kbbbbk.',
];

export function buildArmorSprite(tier: ArmorTier): PixelSprite {
  const isLight = tier === 'light';
  if (isLight) {
    return PixelCanvas.fromGrid(LIGHT_ARMOR_GRID, ARMOR_LEGEND).toSprite(undefined, undefined, 4, 3);
  }

  const isMedium = tier === 'medium';
  if (isMedium) {
    return PixelCanvas.fromGrid(MEDIUM_ARMOR_GRID, ARMOR_LEGEND).toSprite(undefined, undefined, 4, 3);
  }

  return PixelCanvas.fromGrid(HEAVY_ARMOR_GRID, ARMOR_LEGEND).toSprite(undefined, undefined, 4, 3);
}
