// The S.O.S. Fireworks stand: an old city bus, side-on and nose-left, that somebody turned into a
// fireworks booth. A hatch is cut in its side under a striped awning, a hand-built sign rides on the
// roof, a string of bulbs runs along it, and the back end sits on blocks. Sold out, it goes dark.

import type { PixelSprite } from '../types.ts';
import { PixelCanvas } from '../kit.ts';
import { RAMPS } from '../palette.ts';
import type { Color } from '../palette.ts';
import { bake, groundShadow } from './common.ts';
import { blockText, blockWidth, signBoard, smallText } from './signage.ts';
import { legend, WHEEL } from './vehicles.ts';

const { ink, metal, denim, wood, bone, fire, blood, teal, violet, concrete } = RAMPS;

export const BUS_W = 96;
const LEFT = 1;
const SIGN_TOP = 1;
const SIGN_H = 11;
const ROOF_TOP = 15;
const SIDE_TOP = 25;
const BAND_TOP = 36;
const SILL = 45;
export const BUS_GROUND = 51;
const CANVAS_H = 55;

/** The serving hatch, cut out of the middle windows. */
const HATCH_X = 31;
const HATCH_W = 36;
const HATCH_BOTTOM = 37;
const SIGN_TEXT = 'SOS FIREWORKS';
const BULB_COLORS: readonly Color[] = [fire[3], violet[2], teal[2], blood[3]];
const ROCKET_COLORS: readonly Color[] = [blood[2], teal[2], violet[2], fire[2], denim[2]];

/** The roof, seen from above: a long pale slab with ribs, a cooling unit and the sign's two posts. */
function roof(c: PixelCanvas): void {
  c.poly([[LEFT + 4, ROOF_TOP], [LEFT + BUS_W - 1, ROOF_TOP], [LEFT + BUS_W - 1, SIDE_TOP - 1], [LEFT + 1, SIDE_TOP - 1], [LEFT + 1, ROOF_TOP + 3]], bone[1]);
  c.rect(LEFT + 4, ROOF_TOP, BUS_W - 5, 1, bone[2]);
  for (const x of [16, 30, 44, 58, 86]) c.rect(LEFT + x, ROOF_TOP + 1, 1, SIDE_TOP - ROOF_TOP - 2, bone[0]);
  c.rect(LEFT + 62, ROOF_TOP + 2, 16, 6, metal[1]).rect(LEFT + 62, ROOF_TOP + 2, 16, 1, metal[2]);
  for (const x of [64, 68, 72]) c.rect(LEFT + x, ROOF_TOP + 4, 2, 2, metal[0]);
  c.rect(LEFT + 1, SIDE_TOP - 1, BUS_W - 1, 1, ink[1]);
  for (const x of [22, 72]) c.rect(LEFT + x, SIGN_TOP + SIGN_H, 2, ROOF_TOP + 4 - SIGN_TOP - SIGN_H, metal[1]).rect(LEFT + x, SIGN_TOP + SIGN_H, 1, ROOF_TOP + 4 - SIGN_TOP - SIGN_H, metal[2]);
}

/** The hand-built board on the roof, red with yellow capitals, a burst at each end. */
function sign(c: PixelCanvas, lit: boolean): void {
  const w = blockWidth(SIGN_TEXT) + 8;
  const x = LEFT + Math.floor((BUS_W - w) / 2);
  signBoard(c, x, SIGN_TOP, w, SIGN_H, blood[1], blood[2]);
  blockText(c, x + 4, SIGN_TOP + 2, SIGN_TEXT, lit ? fire[2] : bone[1], ink[1]);
  const star = lit ? fire[3] : bone[0];
  for (const sx of [x - 3, x + w + 2]) c.px(sx, SIGN_TOP + 5, star).px(sx - 1, SIGN_TOP + 4, star).px(sx + 1, SIGN_TOP + 4, star).px(sx - 1, SIGN_TOP + 6, star).px(sx + 1, SIGN_TOP + 6, star);
}

/** A pane of glass, or one boarded over with two planks. */
function pane(c: PixelCanvas, x: number, boarded: boolean): void {
  c.rect(x, SIDE_TOP + 2, 8, 7, denim[0]).line(x + 2, SIDE_TOP + 7, x + 5, SIDE_TOP + 3, denim[1]);
  if (boarded) c.rect(x - 1, SIDE_TOP + 3, 10, 2, wood[2]).rect(x - 1, SIDE_TOP + 6, 10, 2, wood[1]).px(x, SIDE_TOP + 3, wood[3]);
}

/** The flat front, the folding door, the windows either side of the hatch, the tail lights. */
function body(c: PixelCanvas): void {
  c.rect(LEFT, SIDE_TOP, BUS_W, BAND_TOP - SIDE_TOP, bone[2]).rect(LEFT, SIDE_TOP, BUS_W, 1, bone[3]);
  c.rect(LEFT, BAND_TOP, BUS_W, SILL - BAND_TOP, teal[1]).rect(LEFT, BAND_TOP, BUS_W, 1, teal[2]);
  c.rect(LEFT, BAND_TOP + 4, BUS_W, 1, teal[0]);
  // Nose: windscreen, a headlamp and the destination box, blank since it stopped running.
  c.rect(LEFT, SIDE_TOP, 5, SILL - SIDE_TOP, teal[0]).rect(LEFT, SIDE_TOP + 1, 4, 9, denim[0]).line(LEFT + 1, SIDE_TOP + 7, LEFT + 3, SIDE_TOP + 3, denim[1]);
  c.rect(LEFT, BAND_TOP + 1, 3, 2, bone[3]);
  c.rect(LEFT + 7, SIDE_TOP + 2, 7, SILL - SIDE_TOP - 3, denim[0]).rect(LEFT + 10, SIDE_TOP + 2, 1, SILL - SIDE_TOP - 3, metal[1]);
  pane(c, LEFT + 17, true);
  for (const x of [71, 81]) pane(c, LEFT + x, x === 81);
  c.rect(LEFT + BUS_W - 2, SIDE_TOP + 3, 2, 4, blood[2]).rect(LEFT + BUS_W - 2, BAND_TOP + 1, 2, 3, blood[2]);
  // The old fleet number, painted over in a darker coat.
  c.rect(LEFT + 20, BAND_TOP + 2, 8, 2, teal[0]);
}

/** Rockets on the counter and boxes on the shelf, or bare boards and a sold out card. */
function hatch(c: PixelCanvas, soldOut: boolean): void {
  const top = SIDE_TOP + 1;
  c.rect(HATCH_X, top, HATCH_W, HATCH_BOTTOM - top, ink[0]);
  c.rect(HATCH_X + 1, top + 4, HATCH_W - 2, 1, wood[1]);
  c.rect(HATCH_X - 1, HATCH_BOTTOM, HATCH_W + 2, 2, wood[2]).rect(HATCH_X - 1, HATCH_BOTTOM, HATCH_W + 2, 1, wood[3]);
  if (soldOut) {
    signBoard(c, HATCH_X + 2, top + 5, 33, 7, bone[2], bone[1]);
    smallText(c, HATCH_X + 3, top + 6, 'SOLD OUT', blood[2]);
    return;
  }
  for (let i = 0; i < 8; i++) c.rect(HATCH_X + 2 + i * 4, top + 1, 3, 3, ROCKET_COLORS[i % ROCKET_COLORS.length]).px(HATCH_X + 2 + i * 4, top + 1, bone[3]);
  for (let i = 0; i < 7; i++) {
    const x = HATCH_X + 3 + i * 5;
    const color = ROCKET_COLORS[(i + 2) % ROCKET_COLORS.length];
    c.rect(x, top + 7, 2, 4, color).px(x, top + 6, bone[3]).px(x + 1, top + 6, bone[2]);
    c.rect(x + 1, top + 10, 1, 1, wood[3]);
  }
}

/** The awning propped out over the hatch, red and cream, scalloped along its edge. Sold out, it is rolled up tight. */
function awning(c: PixelCanvas, soldOut: boolean): void {
  const y = SIDE_TOP - 2;
  const depth = soldOut ? 2 : 4;
  if (!soldOut) for (const x of [HATCH_X, HATCH_X + HATCH_W - 1]) c.rect(x, y + 3, 1, HATCH_BOTTOM - y - 3, metal[2]);
  for (let i = 0; i < HATCH_W + 2; i++) {
    const x = HATCH_X - 1 + i;
    const color = Math.floor(i / 4) % 2 === 0 ? blood[2] : bone[3];
    c.rect(x, y, 1, depth, color);
    const scallop = !soldOut && (i % 4 === 1 || i % 4 === 2);
    if (scallop) c.px(x, y + depth, color);
  }
  c.rect(HATCH_X - 1, y, HATCH_W + 2, 1, bone[3]);
}

/** Bursts somebody painted on the old livery by hand. */
function paintedStars(c: PixelCanvas): void {
  for (const [x, color] of [[LEFT + 34, fire[2]], [LEFT + 50, violet[2]], [LEFT + 63, fire[2]]] as const) {
    const y = BAND_TOP + 5;
    c.px(x, y, color).px(x - 1, y, color).px(x + 1, y, color).px(x, y - 1, color).px(x, y + 1, color);
    c.px(x - 2, y - 2, bone[3]).px(x + 2, y - 2, bone[3]).px(x - 2, y + 2, bone[3]).px(x + 2, y + 2, bone[3]);
  }
}

/** The string of bulbs along the roof's edge, every third pixel; dead once it is sold out. */
function bulbs(c: PixelCanvas, lit: boolean): void {
  for (let x = LEFT + 6, i = 0; x < LEFT + BUS_W - 2; x += 3, i++) {
    const underAwning = x >= HATCH_X - 1 && x <= HATCH_X + HATCH_W;
    if (underAwning) continue;
    c.px(x, SIDE_TOP, lit ? BULB_COLORS[i % BULB_COLORS.length] : ink[1]);
  }
}

/** A flat front tyre, and the back end jacked up on two cinder blocks where its wheel was. */
function underside(c: PixelCanvas): void {
  c.rect(LEFT, SILL, BUS_W, 2, ink[1]);
  c.rect(LEFT + 11, SILL - 4, 11, 6, ink[0]);
  c.grid(LEFT + 12, BUS_GROUND - 7, WHEEL, legend(RAMPS.teal));
  c.rect(LEFT + 12, BUS_GROUND - 2, 9, 2, ink[0]);
  c.rect(LEFT + 72, SILL - 4, 11, 6, ink[0]);
  for (const x of [73, 78]) c.rect(LEFT + x, BUS_GROUND - 5, 4, 5, concrete[2]).rect(LEFT + x, BUS_GROUND - 5, 4, 1, concrete[3]).rect(LEFT + x + 1, BUS_GROUND - 3, 2, 1, concrete[0]);
}

function busCanvas(soldOut: boolean): PixelCanvas {
  const c = new PixelCanvas(BUS_W + 2, CANVAS_H);
  groundShadow(c, LEFT + 1, BUS_GROUND - 1, BUS_W - 1, 3);
  roof(c);
  sign(c, !soldOut);
  body(c);
  paintedStars(c);
  hatch(c, soldOut);
  awning(c, soldOut);
  bulbs(c, !soldOut);
  underside(c);
  return c.outline({ selective: true });
}

/** Open for business. */
export function buildFireworksBus(): PixelSprite {
  return bake(busCanvas(false), LEFT, BUS_W, BUS_GROUND);
}

/** Every last rocket gone: the bulbs dead, the awning sagging, a card in the hatch. */
export function buildFireworksBusSoldOut(): PixelSprite {
  return bake(busCanvas(true), LEFT, BUS_W, BUS_GROUND);
}
