import type { Legend } from '../kit.ts';
import { PixelCanvas } from '../kit.ts';
import { RAMPS } from '../palette.ts';
import type { PixelSprite } from '../types.ts';
import type { Grid } from './shared.ts';

const { ash, blood, fire, ink, metal, rot } = RAMPS;

export const HAZARD_LEGEND: Legend = {
  k: ink[0],
  K: ink[1],
  f: fire[0],
  F: fire[1],
  g: fire[2],
  G: fire[3],
  a: ash[0],
  b: ash[1],
  c: ash[2],
  m: metal[0],
  n: metal[1],
  o: metal[2],
  p: metal[3],
  r: rot[0],
  R: rot[1],
  d: blood[1],
  D: blood[2],
};

/** 16x16: Twin-bell retro wind-up alarm clock */
export const ALARM_CLOCK_GRID: Grid = [
  '..kmmk....kmmk..',
  '.knoook..knoook.',
  '..kmmk.kk.kmmk..',
  '.....kDDDDk.....',
  '....kddddddk....',
  '...kddpopdddk...',
  '..kddpoonooddk..',
  '..kddpoooooddk..',
  '..kddpoomooddk..',
  '..kddpoooooddk..',
  '..kddpoonooddk..',
  '...kddpopdddk...',
  '....kddddddk....',
  '.....kDDDDk.....',
  '...kmmk..kmmk...',
  '..kppk....kppk..',
];

/** 16x16: Animated fire flame frame 1 */
export const FIRE_FLAME_FRAME_1: Grid = [
  '.......kGk......',
  '......kGgGk.....',
  '.....kGgggGk....',
  '.....kgggggk....',
  '....kggFFFggk...',
  '...kgFFFFFFgk...',
  '...kgFFFFFFgGk..',
  '..kggFffffFggk..',
  '..kgFffffffFgk..',
  '.kgFfffkfffFgk..',
  '.kgFffkkkffFgk..',
  '.kgFfffffffFgk..',
  '.kggFfffffFggk..',
  '..kggFFFFFggk...',
  '...kgggggggk....',
  '....kkkkkkk.....',
];

/** 16x16: Animated fire flame frame 2 */
export const FIRE_FLAME_FRAME_2: Grid = [
  '......kGgGk.....',
  '.....kGgggGk....',
  '....kGggggggk...',
  '....kggggGggk...',
  '...kgFFFFFFggk..',
  '..kgFFFFFFFFgk..',
  '..kgFFffffFFgk..',
  '.kggFffffffFggk.',
  '.kgFffffffffFgk.',
  '.kgFffkkkfffFgk.',
  '.kgFffffffffFgk.',
  '..kgFffffffFgk..',
  '..kggFffffFggk..',
  '...kggFFFFggk...',
  '....kggggggk....',
  '.....kkkkkk.....',
];

/** 16x16: Charred scorched earth ground decal */
export const CHARRED_GROUND_GRID: Grid = [
  '....kkk...kk....',
  '..kbaabk.kaabk..',
  '.kaaaaabkaaaabk.',
  '.kaakkaaakaaaak.',
  'kbaakaaaaaakaabk',
  'kbaaaaaaaaaaabk.',
  '.kaaaaaaakaaaak.',
  '.kbaakaaaaaabk..',
  '..kaaaaaaaaak...',
  '.kbaaaaaakaabk..',
  '.kaakaaaaakaaak.',
  'kbaaaaaaaaaaabk.',
  'kbaaaakaaaaaabk.',
  '.kaaaaaaakaaak..',
  '..kbaaaabaak....',
  '....kkkkkkk.....',
];

/** 16x16: Swarm of flies circling a decaying corpse */
export const CORPSE_FLIES_GRID: Grid = [
  '....krk.........',
  '....k.k.........',
  '..........krk...',
  '..krk.....k.k...',
  '..k.k...........',
  '.......krk......',
  '.......k.k......',
  '............krk.',
  '.krk........k.k.',
  '.k.k............',
  '.....krk........',
  '.....k.k...krk..',
  '...........k.k..',
  '..krk...........',
  '..k.k.....krk...',
  '..........k.k...',
];

export function buildAlarmClockSprite(): PixelSprite {
  return PixelCanvas.fromGrid(ALARM_CLOCK_GRID, HAZARD_LEGEND).toSprite();
}

export function buildFireSprite(frame: 0 | 1): PixelSprite {
  const isFirstFrame = frame === 0;
  const grid = isFirstFrame ? FIRE_FLAME_FRAME_1 : FIRE_FLAME_FRAME_2;
  return PixelCanvas.fromGrid(grid, HAZARD_LEGEND).toSprite();
}

export function buildCharredGroundSprite(): PixelSprite {
  return PixelCanvas.fromGrid(CHARRED_GROUND_GRID, HAZARD_LEGEND).toSprite();
}

export function buildCorpseFliesSprite(): PixelSprite {
  return PixelCanvas.fromGrid(CORPSE_FLIES_GRID, HAZARD_LEGEND).toSprite();
}
