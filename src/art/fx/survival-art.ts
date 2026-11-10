import type { Legend } from '../kit.ts';
import { RAMPS } from '../palette.ts';
import type { Grid } from './shared.ts';

const { blood, bone, ink, metal, teal, wood } = RAMPS;

export const SURVIVAL_LEGEND: Legend = {
  k: ink[0],
  K: ink[1],
  e: bone[3],
  f: bone[2],
  g: bone[1],
  h: bone[0],
  r: blood[0],
  s: blood[1],
  t: blood[2],
  u: blood[3],
  m: metal[0],
  n: metal[1],
  o: metal[2],
  p: metal[3],
  a: teal[0],
  b: teal[1],
  c: teal[2],
  w: wood[0],
  x: wood[1],
  y: wood[2],
  z: wood[3],
};

export const CANNED_FOOD: Grid = [
  '..pppppp..',
  '.pooooonp.',
  '.mppppppm.',
  '.mooonnnm.',
  '.rsttttsr.',
  '.rseeeesr.',
  '.rsteetsr.',
  '.rsttttsr.',
  '.mooonnnm.',
  '.mnnnnnnm.',
  '..mmmmmm..',
];

export const WATER_BOTTLE: Grid = [
  '...aaaa...',
  '...abba...',
  '....pp....',
  '...pccp...',
  '..pceccp..',
  '..pcebbp..',
  '..eeeeee..',
  '..effffe..',
  '..pcebbp..',
  '..pcbbap..',
  '..paaaap..',
];

export const DISINFECTANT: Grid = [
  '...eeee...',
  '...fggf...',
  '....xx....',
  '...xyyx...',
  '..xyzyyx..',
  '..eettee..',
  '..ettttf..',
  '..eettff..',
  '..xyyyxw..',
  '..xyyxxw..',
  '..wwwwww..',
];

export const ANTIBIOTICS: Grid = [
  '......rrr.',
  '.....rtuur',
  '....rtttur',
  '...rstttr.',
  '..hfrstr..',
  '.hfeefr...',
  'hfeeefh...',
  'hfeefh....',
  'hgffh.....',
  '.hhh......',
];

export interface SurvivalArtSpec {
  readonly rows: Grid;
  readonly glint: readonly [number, number];
}

export const SURVIVAL_ITEM_ART: Record<'canned_food' | 'water_bottle' | 'disinfectant' | 'antibiotics', SurvivalArtSpec> = {
  canned_food: { rows: CANNED_FOOD, glint: [3, 1] },
  water_bottle: { rows: WATER_BOTTLE, glint: [4, 4] },
  disinfectant: { rows: DISINFECTANT, glint: [4, 4] },
  antibiotics: { rows: ANTIBIOTICS, glint: [7, 1] },
};
