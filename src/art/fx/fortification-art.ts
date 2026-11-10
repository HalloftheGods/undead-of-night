import type { Legend } from '../kit.ts';
import { PixelCanvas } from '../kit.ts';
import { RAMPS } from '../palette.ts';
import type { PixelSprite } from '../types.ts';
import type { Grid } from './shared.ts';

const { bone, ink, metal, teal, wood } = RAMPS;

export const FORTIFICATION_LEGEND: Legend = {
  k: ink[0],
  K: ink[1],
  w: wood[0],
  x: wood[1],
  y: wood[2],
  z: wood[3],
  m: metal[0],
  n: metal[1],
  o: metal[2],
  p: metal[3],
  e: bone[3],
  f: bone[2],
  g: bone[1],
  h: bone[0],
  a: teal[0],
  b: teal[1],
  c: teal[2],
};

/** 32x16: Tier 1 Barricade: single sturdy plank nailed across the center */
export const BARRICADE_TIER_1_GRID: Grid = [
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  'kzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzk',
  'kymwyyyyyyyyyyyyyyyyyyyyyyyywmzk',
  'kxmoyyyyyyyyyyyyyyyyyyyyyyyyomxk',
  'kxwyyyyyyyyyyyyyyyyyyyyyyyyywxk',
  'kwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwk',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
];

/** 32x16: Tier 2 Barricade: two parallel reinforced horizontal planks */
export const BARRICADE_TIER_2_GRID: Grid = [
  '................................',
  '................................',
  'kzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzk',
  'kymwyyyyyyyyyyyyyyyyyyyyyyyywmzk',
  'kxmoyyyyyyyyyyyyyyyyyyyyyyyyomxk',
  'kwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwk',
  '................................',
  '................................',
  '................................',
  '................................',
  'kzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzk',
  'kymwyyyyyyyyyyyyyyyyyyyyyyyywmzk',
  'kxmoyyyyyyyyyyyyyyyyyyyyyyyyomxk',
  'kwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwk',
  '................................',
  '................................',
];

/** 32x16: Tier 3 Barricade: two horizontal planks with diagonal center brace */
export const BARRICADE_TIER_3_GRID: Grid = [
  '................................',
  'kzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzk',
  'kymwyyyyyyyyyyyyyyyyyyyyyyyywmzk',
  'kwwwwwwkwwwwwwwwwwwwwwwwwwwwwwwk',
  '........kzzk....................',
  '.........kxyzk..................',
  '..........kxyzk.................',
  '...........kxyzk................',
  '............kxyzk...............',
  '.............kxyzk..............',
  '..............kxyzk.............',
  '...............kzzk.............',
  'kzzzzzzzzzzzzzzzkwzzzzzzzzzzzzzk',
  'kymwyyyyyyyyyyyykwyyyyyyyyyywmzk',
  'kwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwk',
  '................................',
];

/** 32x16: Tier 4 Barricade: full criss-cross defensive boards with corner reinforcements */
export const BARRICADE_TIER_4_GRID: Grid = [
  'kzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzk',
  'kymwyyyyyyyyyyyyyyyyyyyyyyyywmzk',
  'kwwkwwwwwwwwwwwwwwwwwwwwwwwwkwwk',
  '..kzzk....................kzzk..',
  '...kxyzk................kxyzk...',
  '....kxyzk..............kxyzk....',
  '.....kxyzk............kxyzk.....',
  '......kxyzk..........kxyzk......',
  '.......kxyzk........kxyzk.......',
  '........kxyzk......kxyzk........',
  '.........kxyzk....kxyzk.........',
  '..........kxyzk..kxyzk..........',
  '...........kxyzkkyzk............',
  'kzzzzzzzzzzzkzzkkzzkzzzzzzzzzzzk',
  'kymwyyyyyyyykwyykwwkyyyyyyyywmzk',
  'kwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwk',
];

/** 16x16: Open sheet curtain draped and tied back on left and right edges */
export const CURTAIN_OPEN_GRID: Grid = [
  'keeeeeeeeeeeeeek',
  'kfh..........hfk',
  'keg..........gek',
  'kfh..........hfk',
  'keg..........gek',
  'kfh..........hfk',
  'keg..........gek',
  'kfh..........hfk',
  'kff..........ffk',
  'keg..........gek',
  'kfh..........hfk',
  'keg..........gek',
  'kfh..........hfk',
  'ke...........ek.',
  'k.............k.',
  '................',
];

/** 16x16: Closed sheet curtain drawn solid across window with vertical folds */
export const CURTAIN_CLOSED_GRID: Grid = [
  'keeeeeeeeeeeeeek',
  'kffgffgffgffgffk',
  'kffgffgffgffgffk',
  'keehffhffhffhffk',
  'keehffhffhffhffk',
  'kffgffgffgffgffk',
  'kffgffgffgffgffk',
  'keehffhffhffhffk',
  'keehffhffhffhffk',
  'kffgffgffgffgffk',
  'kffgffgffgffgffk',
  'keehffhffhffhffk',
  'keehffhffhffhffk',
  'kffgffgffgffgffk',
  'keeeeeeeeeeeeeek',
  '..kkkkkkkkkkkk..',
];

/** 16x16: Broken window glass shards on ground */
export const GLASS_SHARDS_GRID: Grid = [
  '................',
  '....kppk........',
  '...kbaapk.......',
  '....kppk........',
  '..........kppk..',
  '.........kbaapk.',
  '..kppk....kppk..',
  '.kbbapk.........',
  '..kppk..........',
  '........kppk....',
  '.......kcbapk...',
  '........kppk....',
  '...kppk.........',
  '..kbbapk...kppk.',
  '...kppk...kcbaak',
  '...........kppk.',
];

export function buildBarricadeSprite(planks: number): PixelSprite {
  const isTier1 = planks <= 1;
  if (isTier1) {
    return PixelCanvas.fromGrid(BARRICADE_TIER_1_GRID, FORTIFICATION_LEGEND).toSprite();
  }

  const isTier2 = planks === 2;
  if (isTier2) {
    return PixelCanvas.fromGrid(BARRICADE_TIER_2_GRID, FORTIFICATION_LEGEND).toSprite();
  }

  const isTier3 = planks === 3;
  if (isTier3) {
    return PixelCanvas.fromGrid(BARRICADE_TIER_3_GRID, FORTIFICATION_LEGEND).toSprite();
  }

  return PixelCanvas.fromGrid(BARRICADE_TIER_4_GRID, FORTIFICATION_LEGEND).toSprite();
}

export function buildCurtainSprite(isClosed: boolean): PixelSprite {
  const grid = isClosed ? CURTAIN_CLOSED_GRID : CURTAIN_OPEN_GRID;
  return PixelCanvas.fromGrid(grid, FORTIFICATION_LEGEND).toSprite();
}

export function buildGlassShardsSprite(): PixelSprite {
  return PixelCanvas.fromGrid(GLASS_SHARDS_GRID, FORTIFICATION_LEGEND).toSprite();
}
