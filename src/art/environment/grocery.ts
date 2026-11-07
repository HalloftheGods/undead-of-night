// The grocery: the longest front in town. A stepped false front over the name, a striped
// awning end to end, and a roof that is mostly plant and skylights.

import type { PixelSprite } from '../types.ts';
import { RAMPS } from '../palette.ts';
import { grime, streak } from './facade.ts';
import type { Trim } from './facade.ts';
import { acUnit, roofVent, skylight, tarPatch } from './roof-kit.ts';
import { bakeShell, caseLamp, doorway, startShell } from './shell.ts';
import type { Shell } from './shell.ts';
import { awning, GREY_PARAPET, parapetRoof, puddle, rollSeams, stockedWindow } from './shop.ts';
import type { Cloth } from './shop.ts';
import { blockText, blockWidth, signBoard, smallText } from './signage.ts';

const { ink, metal, concrete, asphalt, bone, ash, fire, wood, blood } = RAMPS;

const WALL = 36;
const ROOF_TOP = 6;
const AMBER: Cloth = { hi: fire[0], mid: wood[1] };
const CREAM: Cloth = { hi: bone[1], mid: bone[0] };
const TRIM: Trim = [wood[0], wood[2], wood[3]];

function roof(s: Shell): void {
  const { c, left } = s;
  const shade = asphalt[2];
  const box = parapetRoof(s, ROOF_TOP, { ...GREY_PARAPET, lit: wood[3], top: wood[2], face: wood[1], low: wood[0] });
  rollSeams(c, box, [36, 64, 90], shade);
  tarPatch(c, left + 150, 72, [[3, 9], [1, 15], [0, 19], [0, 20], [2, 17], [6, 9]]);
  tarPatch(c, left + 66, 16, [[2, 6], [0, 13], [0, 16], [1, 16], [0, 12], [3, 8]]);
  // Two ranks of store-length skylights, the roof's signature.
  [left + 16, left + 62, left + 108, left + 154].forEach((x, i) => {
    skylight(c, x, 42, 34, 9, shade, [4, 19, 9, 24][i]);
    skylight(c, x, 68, 34, 9, shade, [14, 4, 24, 9][i]);
  });
  acUnit(c, left + 14, 14, 28, shade);
  acUnit(c, left + 108, 14, 28, shade);
  acUnit(c, left + 148, 14, 28, shade);
  // The chiller's ducting runs back along the roof.
  c.rect(left + 44, 26, 62, 3, metal[1]).rect(left + 44, 26, 62, 1, metal[2]).rect(left + 44, 29, 62, 1, shade);
  for (const x of [left + 56, left + 76, left + 96]) c.rect(x, 25, 2, 5, metal[0]);
  roofVent(c, left + 28, 88, shade);
  roofVent(c, left + 184, 88, shade);
  puddle(c, left + 124, 90, 24);
}

/** A stepped board standing up from the parapet, so the name sits above the roofline. */
function falseFront(s: Shell): void {
  const { c, left, wallTop } = s;
  const cx = left + 104;
  const steps: readonly (readonly [number, number])[] = [[72, 20], [62, 14], [52, 8]];
  for (const [half, rise] of steps) {
    c.rect(cx - half, wallTop - rise - 3, half * 2, rise + 3, wood[1]);
    c.rect(cx - half, wallTop - rise - 3, half * 2, 1, wood[3]).rect(cx - half, wallTop - rise - 3, 1, rise + 3, wood[2]);
    c.rect(cx + half - 1, wallTop - rise - 3, 1, rise + 3, wood[0]);
  }
  c.rect(cx - 72, wallTop - 1, 144, 1, wood[0]);
}

function shopWord(s: Shell): void {
  const { c, left, wallTop } = s;
  const word = 'GROCERY';
  const cx = left + 104;
  signBoard(c, cx - 26, wallTop - 19, 52, 13, ink[1], fire[0]);
  blockText(c, cx - Math.floor(blockWidth(word) / 2), wallTop - 16, word, fire[2], fire[0]);
  // Dead bulbs round the board, a couple still in.
  for (let x = cx - 44; x <= cx + 44; x += 8) {
    const bulbLit = x === cx - 36 || x === cx + 28;
    c.px(x, wallTop - 5, bulbLit ? fire[3] : ash[0]);
  }
}

const CART = [
  'mmm..........',
  '..mTTTTTTTTTT',
  '..mt.t.t.t.tm',
  '..mTTTTTTTTTm',
  '...mt.t.t.tm.',
  '...mTTTTTTTm.',
  '....mmmmmmm..',
  '....k.....k..',
];

function trolleys(s: Shell, x: number): void {
  const legend = { m: metal[1], T: metal[3], t: metal[2], k: ink[0] };
  s.c.grid(x, s.ground - 9, CART, legend).grid(x + 6, s.ground - 9, CART, legend);
}

function front(s: Shell): void {
  const { c, left, right, footW, ground, wallTop, doorL, doorR } = s;
  c.rect(left, wallTop, footW, WALL, concrete[1]);
  c.rect(left, wallTop, footW, 3, ink[1]);
  c.rect(left, wallTop, 1, WALL, concrete[3]).rect(right, wallTop, 1, WALL, concrete[0]);
  c.rect(left, ground - 4, footW, 4, wood[1]).rect(left, ground - 4, footW, 1, wood[2]);
  const top = wallTop + 16;
  stockedWindow(c, left + 6, top, 36, 15, metal[1]);
  stockedWindow(c, doorR + 8, top, 50, 15, metal[1]);
  stockedWindow(c, doorR + 62, top, 50, 15, metal[1]);
  // Offers pasted to the glass.
  signBoard(c, doorR + 12, top + 1, 19, 8, bone[1], bone[0]);
  smallText(c, doorR + 14, top + 3, 'SALE', blood[1]);
  signBoard(c, left + 10, top + 5, 11, 7, fire[2], fire[1]);
  c.rect(left + 12, top + 7, 7, 1, blood[1]).rect(left + 12, top + 9, 5, 1, blood[1]);
  doorway(s, 22, 'glass', TRIM, concrete[1]);
  awning(c, left + 4, wallTop + 4, 25, AMBER, CREAM, [18, 19]);
  // The rip: bare rails and a flap of cloth.
  c.rect(left + 4 + 18 * 8, wallTop + 8, 16, 1, metal[1]);
  c.rect(left + 4 + 19 * 8 + 4, wallTop + 7, 3, 8, bone[1]).rect(left + 4 + 19 * 8 + 4, wallTop + 14, 2, 2, bone[0]);
  caseLamp(c, doorL + 12, wallTop + 13);
  trolleys(s, doorR + 72);
  streak(c, left + 12, top + 16, [2, 1], concrete[0]);
  grime(c, left, ground - 4, 40, [2, 4, 1, 3], wood[0]);
  grime(c, right - 30, ground - 4, 30, [3, 1, 2, 4], wood[0]);
}

export function buildGrocery(): PixelSprite {
  const s = startShell('grocery', WALL);
  roof(s);
  falseFront(s);
  shopWord(s);
  front(s);
  return bakeShell(s);
}
