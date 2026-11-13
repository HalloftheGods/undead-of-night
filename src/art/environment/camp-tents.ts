// The camp's tents: big ridge tents you walk into, drawn as every building is, roof and front wall in one shell.
// Canvas over a pole frame, seams every panel, the door flap rolled up and tied. Lit from the upper left like the town.

import type { BuildingKind } from '../../../shared/protocol.ts';
import type { PixelSprite } from '../types.ts';
import { RAMPS } from '../palette.ts';
import type { Color } from '../palette.ts';
import type { Trim } from './facade.ts';
import { bakeShell, doorway, startShell } from './shell.ts';
import type { Shell } from './shell.ts';
import { blockText } from './signage.ts';

const { ink, bone, denim, fire, metal, olive, teal, wood } = RAMPS;

/** The canvas side wall under the eave. */
const WALL = 20;
const DOOR_TALL = 18;
/** Top of the far slope, and the ridge pole's row. */
const ROOF_TOP = 6;
const RIDGE = 22;
const PANEL = 16;

type Cloth = readonly [Color, Color, Color];

interface TentLook {
  /** Shadow, body and lit tones of the canvas. */
  readonly cloth: Cloth;
  /** A second cloth for alternate panels, for a striped canopy. */
  readonly stripe?: Cloth;
}

const panelCloth = (look: TentLook, x: number): Cloth => {
  const isStripe = look.stripe !== undefined && Math.floor(x / PANEL) % 2 === 1;
  return isStripe ? (look.stripe as Cloth) : look.cloth;
};

/** The far slope, hipped at both ends, then the ridge pole, then the near slope down to a scalloped eave. */
function roof(s: Shell, look: TentLook): void {
  const { c, left, footW, wallTop } = s;
  for (let y = ROOF_TOP; y < RIDGE; y++) {
    const inset = Math.round(((RIDGE - y) * 3) / 2);
    for (let x = left + inset; x < left + footW - inset; x++) c.px(x, y, panelCloth(look, x - left)[0]);
  }
  const slope = wallTop - 3 - (RIDGE + 2);
  for (let x = left; x < left + footW; x++) {
    const cloth = panelCloth(look, x - left);
    // Canvas sags between the poles: the middle of each panel dips into shadow lower down than its seams do.
    const across = ((x - left) % PANEL) / PANEL;
    const dip = Math.sin(across * Math.PI);
    for (let y = RIDGE + 2; y < wallTop - 3; y++) {
      const down = (y - RIDGE - 2) / slope;
      const lit = down < 0.12 || (down < 0.3 && dip < 0.5);
      const shade = down > 0.86 - dip * 0.22;
      let tone = cloth[1];
      if (shade) tone = cloth[0];
      if (lit) tone = cloth[2];
      c.px(x, y, tone);
    }
    // Scalloped valance: the canvas hangs a little lower between each pair of seams.
    const sag = Math.round(Math.sin((((x - left) % PANEL) / PANEL) * Math.PI) * 2);
    c.rect(x, wallTop - 3, 1, 2 + sag, cloth[1]).px(x, wallTop - 1 + sag, ink[1]);
  }
  for (let x = left + PANEL; x < left + footW; x += PANEL) {
    c.rect(x, RIDGE + 2, 1, wallTop - RIDGE - 4, panelCloth(look, x - left - 1)[0]);
    c.rect(x - 1, RIDGE + 2, 1, 4, panelCloth(look, x - left - 1)[2]);
  }
  c.rect(left + 4, RIDGE, footW - 8, 2, wood[2]).rect(left + 4, RIDGE, footW - 8, 1, wood[3]);
  c.rect(left + 2, RIDGE - 1, 3, 4, wood[1]).rect(left + footW - 5, RIDGE - 1, 3, 4, wood[1]);
  // Guy ropes from each end of the ridge down across the hips to the corner pegs.
  c.line(left + 3, RIDGE + 2, left + 1, wallTop - 3, bone[1]).line(left + footW - 4, RIDGE + 2, left + footW - 2, wallTop - 3, bone[0]);
  c.line(left + 3, RIDGE + 2, left + 10, wallTop - 3, bone[0]).line(left + footW - 4, RIDGE + 2, left + footW - 11, wallTop - 3, bone[0]);
}

/** Canvas wall with a pole at each corner and a mud-stained hem. */
function wall(s: Shell, look: TentLook): void {
  const { c, left, right, footW, ground, wallTop } = s;
  for (let x = left; x < left + footW; x++) {
    const cloth = panelCloth(look, x - left);
    // Hanging canvas: a soft fold every few pixels, deeper at each pole.
    const fold = (x - left) % 6 === 5;
    c.rect(x, wallTop, 1, WALL, fold ? cloth[0] : cloth[1]);
    c.rect(x, wallTop, 1, 3, cloth[0]);
    const isPole = (x - left) % PANEL === 0;
    if (isPole) c.rect(x, wallTop, 1, WALL, ink[1]);
  }
  c.rect(left, wallTop, footW, 1, ink[1]);
  c.rect(left, ground - 3, footW, 3, wood[0]).rect(left, ground - 3, footW, 1, wood[1]);
  c.rect(left, wallTop - 2, 2, WALL + 2, wood[1]).rect(left, wallTop - 2, 1, WALL + 2, wood[2]);
  c.rect(right - 1, wallTop - 2, 2, WALL + 2, wood[0]);
}

/** The opening, then its flap rolled up over it and tied with two cords. */
function flapDoor(s: Shell, look: TentLook, floor: Color): void {
  const trim: Trim = [look.cloth[0], wood[1], wood[2]];
  doorway(s, DOOR_TALL, 'shutter', trim, floor);
  const { c, ground, doorL, doorR } = s;
  const top = ground - DOOR_TALL;
  c.rect(doorL, top, doorR - doorL, 5, look.cloth[1]).rect(doorL, top, doorR - doorL, 1, look.cloth[2]).rect(doorL, top + 4, doorR - doorL, 1, look.cloth[0]);
  for (const x of [doorL + 6, doorR - 7]) c.rect(x, top - 1, 1, 7, bone[1]);
}

function startTent(kind: BuildingKind, look: TentLook, floor: Color): Shell {
  const s = startShell(kind, WALL);
  roof(s, look);
  wall(s, look);
  flapDoor(s, look, floor);
  return s;
}

/** Striped canopy, a painted board over the door. */
export function buildCampMarket(): PixelSprite {
  const look: TentLook = { cloth: [teal[0], teal[1], teal[2]], stripe: [bone[0], bone[1], bone[2]] };
  const s = startTent('camp_market', look, wood[2]);
  const { c, doorL, wallTop } = s;
  const signX = doorL - 6;
  const signY = wallTop - 15;
  c.rect(signX, signY, 44, 11, wood[1]).rect(signX, signY, 44, 1, wood[3]).rect(signX, signY + 10, 44, 1, ink[1]);
  blockText(c, signX + 4, signY + 3, 'MARKET', bone[3], wood[0]);
  c.rect(signX + 6, signY + 11, 1, 4, metal[1]).rect(signX + 37, signY + 11, 1, 4, metal[1]);
  return bakeShell(s);
}

/** Army canvas with a tin patch, and a stovepipe through the roof for the forge inside. */
export function buildCampWorkshop(): PixelSprite {
  const look: TentLook = { cloth: [olive[0], olive[1], olive[2]] };
  const s = startTent('camp_workshop', look, metal[1]);
  const { c, left, footW } = s;
  const patch = { x: left + 18, y: RIDGE + 20, w: 22, h: 14 };
  c.rect(patch.x, patch.y, patch.w, patch.h, metal[1]).rect(patch.x, patch.y, patch.w, 1, metal[3]);
  for (let x = patch.x + 2; x < patch.x + patch.w; x += 3) c.rect(x, patch.y + 1, 1, patch.h - 1, metal[2]);
  c.px(patch.x + 3, patch.y + patch.h - 2, fire[0]).px(patch.x + patch.w - 4, patch.y + 3, fire[0]);
  const pipe = left + footW - 30;
  c.rect(pipe, RIDGE - 12, 5, 26, metal[1]).rect(pipe, RIDGE - 12, 1, 26, metal[3]).rect(pipe + 4, RIDGE - 12, 1, 26, metal[0]);
  c.rect(pipe - 2, RIDGE - 14, 9, 3, metal[2]).rect(pipe - 2, RIDGE - 14, 9, 1, metal[3]);
  c.rect(pipe - 3, RIDGE + 13, 11, 3, ink[1]);
  return bakeShell(s);
}

/** Denim-blue canvas, a mesh window, and a string of bulbs along the eave that still glow off the generator. */
export function buildCampQuarters(): PixelSprite {
  const look: TentLook = { cloth: [denim[0], denim[1], denim[2]] };
  const s = startTent('camp_quarters', look, wood[2]);
  const { c, left, footW, wallTop, ground } = s;
  for (let x = left + 3; x < left + footW - 3; x++) {
    const droop = Math.round(Math.sin(((x - left) / footW) * Math.PI * 4) * 1.5) + 2;
    c.px(x, wallTop - 6 + droop, ink[1]);
    const isBulb = (x - left) % 9 === 4;
    if (isBulb) c.px(x, wallTop - 5 + droop, fire[2]).px(x, wallTop - 4 + droop, fire[1]);
  }
  const win = { x: left + 12, y: wallTop + 4, w: 18, h: 9 };
  c.rect(win.x - 1, win.y - 1, win.w + 2, win.h + 2, denim[2]).rect(win.x, win.y, win.w, win.h, ink[1]);
  for (let x = win.x; x < win.x + win.w; x += 2) c.rect(x, win.y, 1, win.h, ink[0]);
  c.rect(win.x + 2, win.y + 3, 5, 3, fire[1]);
  c.rect(left + footW - 22, ground - 9, 8, 6, wood[1]).rect(left + footW - 22, ground - 9, 8, 1, wood[3]);
  return bakeShell(s);
}
