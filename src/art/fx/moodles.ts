import type { Legend } from '../kit.ts';
import { RAMPS } from '../palette.ts';
import { PixelCanvas } from '../kit.ts';
import type { PixelSprite } from '../types.ts';
import { gridSprite } from './shared.ts';
import type { Grid } from './shared.ts';

const { blood, bone, fire, ink, metal, rot, teal, wood } = RAMPS;

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
  w: wood[0],
  x: wood[1],
  y: wood[2],
  z: wood[3],
};

export const MOODLE_HUNGER: Grid = [
  'o.o.o...op..',
  'o.o.o...opp.',
  'o.o.o...oppp',
  'ooooo...oppp',
  '.opo....oppp',
  '..o.....oppp',
  '..o.....opp.',
  '..n.....nn..',
  '..x.....xy..',
  '..x.....xy..',
  '..x.....xy..',
  '..x.....xy..',
];

/** The earlier 16x16 drawing with its own inked outline, kept to switch back to (build it with gridSprite). */
export const MOODLE_HUNGER_OLD: Grid = [
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
  '....cc....',
  '....cc....',
  '...cccb...',
  '...cecb...',
  '..cceccb..',
  '..ceccbb..',
  '.cceccbba.',
  '.cecccbba.',
  '.cccccbba.',
  '.ccccbbba.',
  '..cbbbba..',
  '...baaa...',
];

/** The earlier 16x16 drawing with its own inked outline, kept to switch back to (build it with gridSprite). */
export const MOODLE_THIRST_OLD: Grid = [
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
  '....tt......',
  '....tt......',
  '...ttts.....',
  '...tuts.....',
  '..ttutss....',
  '..tuttss.tt.',
  '.ttutssr.tt.',
  '.ttttssrttts',
  '.tttsssrtuts',
  '..tsssr.ttss',
  '...srr...ss.',
];

/** The earlier 16x16 drawing with its own inked outline, kept to switch back to (build it with gridSprite). */
export const MOODLE_BLEEDING_OLD: Grid = [
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
  '.....qq.....',
  '.q..qQQq..q.',
  '..qqQQqqqq..',
  '..qQQvqqqd..',
  '.qQQqqqqqdd.',
  'qqQqqqvvqddq',
  'qqqqqqvvqddq',
  '.qqvqqqqddd.',
  '..qqqqqddd..',
  '..qddddddd..',
  '.q..dddd..q.',
  '.....dd.....',
];

/** The earlier 16x16 drawing with its own inked outline, kept to switch back to (build it with gridSprite). */
export const MOODLE_INFECTION_OLD: Grid = [
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
  '.....eeeeeee',
  '.....fffffee',
  '.........ee.',
  '........ee..',
  '.......ee...',
  '......ee....',
  '.....eeeeeee',
  'eeeee.ffffff',
  'fffee.......',
  '..ee........',
  '.ee.........',
  'eeeee.......',
  'fffff.......',
];

/** The earlier 16x16 drawing with its own inked outline, kept to switch back to (build it with gridSprite). */
export const MOODLE_FATIGUE_OLD: Grid = [
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

const SIZE = 16;

/** Flat colour inside one ink line, centred in the cell: the same hand as the pickup icons. */
function outlined(rows: Grid): PixelSprite {
  const x = Math.floor((SIZE - rows[0].length) / 2);
  const y = Math.floor((SIZE - rows.length) / 2);
  return new PixelCanvas(SIZE, SIZE).grid(x, y, rows, MOODLE_LEGEND).outline({ color: ink[0] }).toSprite(SIZE, SIZE, 0, 0);
}

export function buildMoodleIcons(): Record<MoodleKind, PixelSprite> {
  return {
    hunger: outlined(MOODLE_HUNGER),
    thirst: outlined(MOODLE_THIRST),
    bleeding: outlined(MOODLE_BLEEDING),
    infection: outlined(MOODLE_INFECTION),
    fatigue: outlined(MOODLE_FATIGUE),
  };
}

/** The earlier icons, built the old way. Nothing uses them. */
export function buildMoodleIconsOld(): Record<MoodleKind, PixelSprite> {
  return {
    hunger: gridSprite(MOODLE_HUNGER_OLD, MOODLE_LEGEND, 0, 0),
    thirst: gridSprite(MOODLE_THIRST_OLD, MOODLE_LEGEND, 0, 0),
    bleeding: gridSprite(MOODLE_BLEEDING_OLD, MOODLE_LEGEND, 0, 0),
    infection: gridSprite(MOODLE_INFECTION_OLD, MOODLE_LEGEND, 0, 0),
    fatigue: gridSprite(MOODLE_FATIGUE_OLD, MOODLE_LEGEND, 0, 0),
  };
}
