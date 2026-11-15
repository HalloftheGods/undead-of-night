// The things a survivor throws or lights: an empty bottle, a ground spinner and a fountain. Drawn once here for the
// HUD's counters (icons.ts) and for the same item lying in the world after it is dropped (pickups.ts).

import type { Legend } from '../kit.ts';
import { RAMPS } from '../palette.ts';
import type { Grid } from './shared.ts';

const { blood, bone, fire, olive, violet, wood } = RAMPS;

/** The colours these grids use, the same letters as the HUD icons' legend. */
export const THROWABLE_LEGEND: Legend = {
  e: bone[3], f: bone[2], g: bone[1],
  r: blood[0], s: blood[1], t: blood[2], u: blood[3],
  a: olive[0], b: olive[1], c: olive[2],
  x: wood[1], y: wood[2],
  Y: fire[3], B: fire[2], C: fire[1],
  j: violet[1],
};

/** An empty green bottle with a cork. */
export const BOTTLE: Grid = [
  '..x..',
  '..y..',
  '.aba.',
  '.abc.',
  '.abc.',
  'abbcc',
  'abbec',
  'abbec',
  'abbcc',
  'abbcc',
  'abbcc',
  '.aaa.',
];

/** A ground spinner firework: a striped drum with its fuse lit. Lit and tossed, it whirls sparks on the street. */
export const FIREWORKS: Grid = [
  '.YB.jjj....',
  '...jjjtt...',
  '..jjjjttt.B',
  '..jjjYttt.Y',
  'Y.ttttjjj..',
  'B..ttjjj...',
  '....tjj.BY.',
];

/** A fountain firework: a striped cone on a card base, lit and spraying sparks straight up. */
export const FOUNTAIN: Grid = [
  '..Y..Y..Y..',
  '.B..YBY..B.',
  '...B.Y.B...',
  '....YBY....',
  '.....e.....',
  '....rst....',
  '....YBB....',
  '...rsstu...',
  '...rsstt...',
  '..YYBBBBC..',
  '..rsssttu..',
  '.gffffffee.',
];
