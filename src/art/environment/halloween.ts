// Halloween night: what the town put out before the dead came. Every home has its string of
// bulbs along the eaves, carved pumpkins on the step and a cobweb in a window, and a candy
// bowl by the door for the trick-or-treaters (a searchable prop, shut full and searched empty).

import { PixelCanvas } from '../kit.ts';
import { RAMPS } from '../palette.ts';
import type { Color } from '../palette.ts';
import type { PixelSprite } from '../types.ts';
import type { ContainerArt } from '../containers/stage.ts';
import { markGlow } from '../glow.ts';
import { bake, groundShadow } from './common.ts';
import type { Shell } from './shell.ts';

const { ink, bone, fire, violet, acid, blood, olive, denim, teal, wood } = RAMPS;

/** Bulbs run orange, purple, green and red along the wire. */
const BULBS: readonly Color[] = [fire[2], violet[2], acid[2], blood[3]];
const BULB_STEP = 4;
const SPAN = 16;

/** A wire of party bulbs that sags between the nails it hangs from. */
export function stringLights(c: PixelCanvas, x0: number, x1: number, y: number): void {
  for (let x = x0; x <= x1; x++) {
    const along = (x - x0) % SPAN;
    const sag = Math.round(Math.sin((along / SPAN) * Math.PI) * 2);
    c.px(x, y + sag, ink[1]);
    const isBulb = (x - x0) % BULB_STEP === 2;
    const bulb = BULBS[Math.floor((x - x0) / BULB_STEP) % BULBS.length];
    if (isBulb) c.rect(x, y + sag + 1, 1, 2, bulb);
  }
}

const PUMPKIN = ['....g....', '.OoOoOod.', 'OoYYoYYdd', 'OoooYoodd', 'OYoYoYodd', '.OYYYYdd.', '..Ooood..'];
const SMALL_PUMPKIN = ['..g..', '.OoOd', 'OYoYd', 'OoYdd', '.ood.'];
const PUMPKIN_INK = { g: olive[1], o: fire[1], O: fire[2], d: fire[0], Y: fire[3] };
/** The letter the pumpkin grids use for the lit cut-outs of the face. */
const FACE = 'Y';

/** A carved pumpkin sitting on the step, its bottom row on `base`. Lit from inside, so the face glows. */
export function jackOLantern(c: PixelCanvas, x: number, base: number, small = false): void {
  const rows = small ? SMALL_PUMPKIN : PUMPKIN;
  c.grid(x, base - rows.length + 1, rows, PUMPKIN_INK);
  litFace(c, x, base - rows.length + 1, rows);
}

/** The carved face is where the candle shows through: those pixels burn by themselves after dark. */
function litFace(c: PixelCanvas, x: number, y: number, rows: readonly string[]): void {
  rows.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) if (row[i] === FACE) markGlow(c, x + i, y + j, fire[3], fire[1]);
  });
}

/** A web strung across a window's top corner. */
export function cobweb(c: PixelCanvas, x: number, y: number): void {
  c.line(x, y, x + 5, y + 5, bone[0]).line(x, y + 2, x + 4, y, bone[0]).line(x, y + 4, x + 5, y + 1, bone[0]);
  c.px(x + 3, y + 3, bone[2]);
}

/** A bedsheet ghost hung from a porch beam on a string. */
export function sheetGhost(c: PixelCanvas, x: number, y: number): void {
  c.px(x + 2, y, ink[1]);
  c.grid(x, y + 1, ['.WWW.', 'WWWWw', 'WkWkw', 'WWWWw', 'WWWWw', 'W.W.w'], { W: bone[3], w: bone[1], k: ink[0] });
}

/** A giant plastic spider sat on the roof, the one decoration seen from the street above. */
export function roofSpider(c: PixelCanvas, x: number, y: number): void {
  c.grid(x, y, [
    'k...k.k...k',
    '.k..kkk..k.',
    '..kkKKKkk..',
    'kkkKrKrKkkk',
    '..kkKKKkk..',
    '.k.kkkkk.k.',
    'k..k...k..k',
  ], { k: ink[0], K: ink[1], r: blood[3] });
}

export interface Dressing {
  /** Row the bulbs hang from, across the whole front. */
  readonly lightsY: number;
  /** Left edges of the pumpkins on the step, right of the door where the bowl does not stand. */
  readonly pumpkins: readonly number[];
  /** Top-left corners of window panes that have a web. */
  readonly webs?: readonly (readonly [number, number])[];
  /** Where a ghost hangs, if there is a porch to hang one from. */
  readonly ghost?: readonly [number, number];
  /** Where a spider sits on the roof. */
  readonly spider?: readonly [number, number];
}

/** Dresses a home's front for the night. Drawn last, so it sits over the facade. */
export function dressForHalloween(s: Shell, dressing: Dressing): void {
  const { c, left, right, ground } = s;
  stringLights(c, left + 1, right - 1, dressing.lightsY);
  dressing.pumpkins.forEach((x, i) => jackOLantern(c, x, ground - 1, i % 2 === 1));
  for (const [x, y] of dressing.webs ?? []) cobweb(c, x, y);
  if (dressing.ghost) sheetGhost(c, dressing.ghost[0], dressing.ghost[1]);
  if (dressing.spider) roofSpider(c, dressing.spider[0], dressing.spider[1]);
}

// --- The candy bowl ----------------------------------------------------------------------

const BOWL_FOOT_W = 10;
const BOWL_LEFT = 3;
const BOWL_GROUND = 15;

/** Wrappers heaped over the rim. */
const CANDY_PILE = ['..cvbt..', '.bcAvcr.', 'rAbcvAbc'];
const CANDY_INK = { c: fire[2], v: violet[2], b: denim[2], t: teal[2], A: acid[2], r: blood[3] };

/** A carved pumpkin hollowed into a bowl, the candle behind its face. */
const PAIL = [
  '.dOOOOOOOOd.',
  'oOoooooooodd',
  'oOYYoooYYodd',
  'oOooooYooodd',
  'oOYYYYYYYodd',
  '.oOYoYoYodd.',
  '..oooooood..',
];
const PAIL_INK = { o: fire[1], O: fire[2], d: fire[0], Y: fire[3] };

function bowlBase(): PixelCanvas {
  const c = new PixelCanvas(BOWL_FOOT_W + 6, BOWL_GROUND + 2);
  groundShadow(c, BOWL_LEFT, BOWL_GROUND - 1, BOWL_FOOT_W, 2);
  c.grid(BOWL_LEFT - 1, BOWL_GROUND - PAIL.length, PAIL, PAIL_INK);
  litFace(c, BOWL_LEFT - 1, BOWL_GROUND - PAIL.length, PAIL);
  return c;
}

const bakeBowl = (c: PixelCanvas): PixelSprite => {
  c.outline({ selective: true });
  return bake(c, BOWL_LEFT, BOWL_FOOT_W, BOWL_GROUND);
};

/** Full: candy heaped over the rim. */
export function buildCandyBowl(): PixelSprite {
  const c = bowlBase();
  c.grid(BOWL_LEFT + 1, BOWL_GROUND - PAIL.length - 2, CANDY_PILE, CANDY_INK);
  return bakeBowl(c);
}

/** Searched: the dark inside showing, and the wrappers of what was taken dropped beside it. */
function candyBowlEmpty(): PixelSprite {
  const c = bowlBase();
  const rim = BOWL_GROUND - PAIL.length;
  c.rect(BOWL_LEFT + 1, rim, BOWL_FOOT_W - 2, 1, ink[0]).rect(BOWL_LEFT + 2, rim + 1, BOWL_FOOT_W - 4, 1, ink[1]);
  c.px(BOWL_LEFT + 3, rim, wood[1]);
  // The candle's out now there is nobody to give to: the face goes dark.
  c.recolor(new Map([[fire[3], fire[0]]]));
  c.rect(BOWL_LEFT + BOWL_FOOT_W + 1, BOWL_GROUND, 2, 1, violet[2]).px(BOWL_LEFT - 2, BOWL_GROUND, acid[2]);
  return bakeBowl(c);
}

export function buildCandyBowlArt(closed: PixelSprite): ContainerArt {
  return { closed, opened: candyBowlEmpty() };
}
