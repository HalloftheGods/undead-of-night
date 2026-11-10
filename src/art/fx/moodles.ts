import type { Legend } from '../kit.ts';
import { RAMPS } from '../palette.ts';
import type { PixelSprite } from '../types.ts';
import { gridSprite } from './shared.ts';
import type { Grid } from './shared.ts';

const { blood, bone, fire, ink, metal, rot, teal } = RAMPS;

export const MOODLE_LEGEND: Legend = {
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
  v: rot[0],
  d: rot[1],
  q: rot[2],
  Q: rot[3],
  Y: fire[3],
  B: fire[2],
  C: fire[1],
  D: fire[0],
};

export const MOODLE_HUNGER: Grid = [
  '................',
  '....kk....kk....',
  '....kYk..kYk....',
  '....kYYkkYYk....',
  '....kYYYYYYk....',
  '....kYYYYYYk....',
  '....kYYYYYYk....',
  '.....kYYYYk.....',
  '......kYYk......',
  '......kYYk......',
  '......kYYk......',
  '.....keeeek.....',
  '....keeffeek....',
  '....kff..ffk....',
  '.....kk..kk.....',
  '................',
];

export const MOODLE_THIRST: Grid = [
  '................',
  '.......kk.......',
  '......kcck......',
  '......kcck......',
  '.....kcccck.....',
  '....kcccccck....',
  '....kcabbcck....',
  '...kcabbbccck...',
  '...kcabbbccck...',
  '...kcaabbccck...',
  '...kcaabbccck...',
  '....kcccccck....',
  '....kcccccck....',
  '.....kcccck.....',
  '......kkkk......',
  '................',
];

export const MOODLE_BLEEDING: Grid = [
  '................',
  '......kk........',
  '.....kuuk.......',
  '....kuuuuk......',
  '....kuttuk......',
  '...kuttstuk.....',
  '...kuttssttk....',
  '...kuttssttk....',
  '....kttssttk....',
  '..k..kttttk.....',
  '.kurk.kkkk......',
  'kuttuk..........',
  'kutstk...kk.....',
  '.ktstk..krrk....',
  '..kkk..kurrrk...',
  '........kkkk....',
];

export const MOODLE_INFECTION: Grid = [
  '................',
  '.....kkkkkk.....',
  '...kkqqqqqqkk...',
  '..kqddddddddqk..',
  '.kqdvvkkkkvvdqk.',
  '.kddkv.kk.vkddk.',
  '.kddkk.kk.kkddk.',
  '.kqdvvkkkkvvdqk.',
  '..kqddvvvvdqqk..',
  '...kqqvvvvqqk...',
  '..kqqkvvvvkqqk..',
  '..kqk.kvvk.kqk..',
  '...k...kk...k...',
  '....kk....kk....',
  '.....kkkkkk.....',
  '................',
];

export const MOODLE_FATIGUE: Grid = [
  '................',
  '........kkkkkk..',
  '.......keeekkk..',
  '.........keek...',
  '........keeek...',
  '.......kkkkkk...',
  '................',
  '...kkkkk........',
  '..keeekkk.......',
  '....keek........',
  '...keeek........',
  '..kkkkkk........',
  '................',
  '.kkkkkkkkkkkkk..',
  '.keeeeeeeeeffk..',
  '..kkkkkkkkkkk...',
];

export type MoodleKind = 'hunger' | 'thirst' | 'bleeding' | 'infection' | 'fatigue';

export function buildMoodleIcons(): Record<MoodleKind, PixelSprite> {
  return {
    hunger: gridSprite(MOODLE_HUNGER, MOODLE_LEGEND, 0, 0),
    thirst: gridSprite(MOODLE_THIRST, MOODLE_LEGEND, 0, 0),
    bleeding: gridSprite(MOODLE_BLEEDING, MOODLE_LEGEND, 0, 0),
    infection: gridSprite(MOODLE_INFECTION, MOODLE_LEGEND, 0, 0),
    fatigue: gridSprite(MOODLE_FATIGUE, MOODLE_LEGEND, 0, 0),
  };
}
