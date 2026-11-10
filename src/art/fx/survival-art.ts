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
  'pmmmmmmmmp',
  'pmrttsrrmp',
  'pmtsesttmp',
  'pmtseestmp',
  'pmrttsrrmp',
  'pmmmmmmmmp',
  '.pooooonp.',
  '..nnnnnn..',
];

export const WATER_BOTTLE: Grid = [
  '....ee....',
  '....ee....',
  '...p..p...',
  '..pcccp...',
  '.pcbccbp..',
  '.pcbaabp..',
  '.pcbaabp..',
  '.pcbccbp..',
  '.pcbccbp..',
  '..pbbbp...',
  '...ppp....',
];

export const DISINFECTANT: Grid = [
  '....nn....',
  '...nooon..',
  '..zwwwwz..',
  '.zwxzzxwz.',
  '.zwxttxwz.',
  '.zwttsswz.',
  '.zwxttxwz.',
  '.zwxzzxwz.',
  '..zwwwwz..',
  '...zzzz...',
];

export const ANTIBIOTICS: Grid = [
  '..pppppp..',
  '.poooooon.',
  '.pmreermn.',
  '.pmtseumn.',
  '.pmreermn.',
  '.pmtseumn.',
  '.pnnnnnnp.',
  '..mmmmmm..',
];

export interface SurvivalArtSpec {
  readonly rows: Grid;
  readonly glint: readonly [number, number];
}

export const SURVIVAL_ITEM_ART: Record<'canned_food' | 'water_bottle' | 'disinfectant' | 'antibiotics', SurvivalArtSpec> = {
  canned_food: { rows: CANNED_FOOD, glint: [2, 1] },
  water_bottle: { rows: WATER_BOTTLE, glint: [3, 2] },
  disinfectant: { rows: DISINFECTANT, glint: [2, 2] },
  antibiotics: { rows: ANTIBIOTICS, glint: [2, 1] },
};
