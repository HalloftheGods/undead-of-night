// The hospital: the biggest building in town. Three storeys of pale panel with ribbon windows,
// a blue H board on the parapet, the helipad painted on the roof, and a red emergency canopy
// over the doors. Its marks are the H and the red band, never a cross, so it never reads as
// the pharmacy.

import type { PixelSprite } from '../types.ts';
import type { PixelCanvas } from '../kit.ts';
import { RAMPS } from '../palette.ts';
import type { Color } from '../palette.ts';
import { grime, streak, windowUnit } from './facade.ts';
import type { Trim, WindowKind } from './facade.ts';
import { acUnit, bulkhead, radioMast, roofVent, skylight, tarPatch, waterTank } from './roof-kit.ts';
import { bakeShell, caseLamp, doorway, startShell } from './shell.ts';
import type { Shell } from './shell.ts';
import { GREY_PARAPET, parapetRoof, puddle, rollSeams } from './shop.ts';
import { blockText, blockWidth, heavyText, heavyWidth, signBoard } from './signage.ts';

const { ink, metal, concrete, asphalt, denim, blood, bone, ash, fire } = RAMPS;

const WALL = 58;
const ROOF_TOP = 6;
const PALE: Trim = [ash[0], bone[0], bone[1]];
const STOREY = 17;
const PANES = 13;

/** The H, in heavy strokes `stroke` wide, inside a box `size` across. */
function hMark(c: PixelCanvas, x: number, y: number, size: number, stroke: number, color: Color): void {
  c.rect(x, y, stroke, size, color).rect(x + size - stroke, y, stroke, size, color);
  c.rect(x, y + Math.floor((size - stroke) / 2), size, stroke, color);
}

/** The pad: a ring in safety yellow, gone patchy, round a white H. */
function helipad(c: PixelCanvas, cx: number, cy: number): void {
  c.ellipse(cx, cy, 34, 30, concrete[1]);
  c.ellipse(cx, cy, 31, 27, fire[1]);
  c.ellipse(cx, cy, 28, 24, concrete[1]);
  hMark(c, cx - 13, cy - 13, 26, 6, bone[2]);
  // Worn patches, where the paint has lifted off under the weather.
  for (const [x, y, w] of [[cx + 18, cy - 20, 7], [cx - 30, cy + 4, 4], [cx + 2, cy + 22, 9], [cx - 9, cy - 4, 3], [cx + 5, cy + 6, 4]] as const) {
    c.rect(x, y, w, 1, concrete[1]);
  }
  // Tie-down rings at the corners of the pad.
  for (const [x, y] of [[cx - 30, cy - 22], [cx + 29, cy - 22], [cx - 30, cy + 21], [cx + 29, cy + 21]] as const) c.px(x, y, metal[2]);
}

function roof(s: Shell): void {
  const { c, left, right, wallTop } = s;
  const shade = asphalt[2];
  const box = parapetRoof(s, ROOF_TOP, { ...GREY_PARAPET, field: concrete[1], lit: bone[1], top: bone[0], face: ash[0] });
  rollSeams(c, box, [36, 70, 104, 132], concrete[0]);
  tarPatch(c, left + 26, 112, [[3, 9], [1, 15], [0, 19], [0, 20], [2, 17], [6, 9]]);
  tarPatch(c, left + 250, 44, [[2, 6], [0, 13], [0, 16], [1, 16], [0, 12], [3, 8]]);
  helipad(c, left + 160, 74);
  // Plant along the west end: stair housing, condensers, the tank.
  bulkhead(c, left + 14, 16, 40, 12, 12, shade);
  acUnit(c, left + 16, 52, 30, shade);
  acUnit(c, left + 16, 84, 30, shade);
  waterTank(c, left + 62, 10, shade);
  // Skylights over the wards on the east end.
  skylight(c, left + 236, 82, 34, 8, shade, 7);
  skylight(c, left + 236, 102, 34, 8, shade, 22);
  skylight(c, left + 276, 82, 26, 8, shade, 13);
  acUnit(c, left + 264, 16, 34, shade);
  roofVent(c, left + 116, 128, shade);
  roofVent(c, left + 206, 130, shade);
  roofVent(c, left + 64, 126, shade);
  puddle(c, left + 136, 126, 28);
  // A mast on the rear parapet, its warning lamp still burning.
  radioMast(c, right - 22, 0, 26);
  c.rect(left, wallTop - 4, s.footW, 1, blood[1]);
}

/** The board on the parapet: a blue square with the H, then the name. */
function nameBoard(s: Shell): void {
  const { c, left, wallTop } = s;
  const word = 'HOSPITAL';
  const w = heavyWidth(word) + 34;
  const x = left + 160 - Math.floor(w / 2);
  const y = wallTop - 18;
  // Legs standing it up off the parapet.
  for (const leg of [x + 6, x + w - 8]) c.rect(leg, y + 14, 2, 5, metal[1]);
  signBoard(c, x, y, w, 15, bone[3], bone[1]);
  c.rect(x + 2, y + 2, 11, 11, denim[1]).rect(x + 2, y + 2, 11, 1, denim[2]);
  hMark(c, x + 4, y + 4, 7, 2, bone[3]);
  heavyText(c, x + 18, y + 4, word, denim[0]);
  // One letter's tube gone, so it sits dimmer.
  c.rect(x + 18 + 7 * 6, y + 4, 6, 7, bone[2]);
  heavyText(c, x + 18 + 7 * 6, y + 4, 'A', denim[1]);
}

/** One storey's ribbon of windows, broken by the entrance block. */
function ribbon(s: Shell, y: number, kinds: readonly WindowKind[]): void {
  const { c, left } = s;
  let n = 0;
  for (let x = 8; x < 312; x += 18) {
    const inEntrance = x > 112 && x < 196;
    if (inEntrance) continue;
    windowUnit(c, left + x, y, PANES, 10, kinds[n % kinds.length], PALE);
    n++;
  }
}

/** The red canopy over the doors, EMERGENCY along its fascia. */
function canopy(s: Shell): void {
  const { c, ground, doorL, doorR, wallTop } = s;
  const x = doorL - 30;
  const w = doorR - doorL + 60;
  const y = wallTop + 22;
  for (const post of [x + 2, x + w - 5]) c.rect(post, y + 10, 3, ground - y - 10, bone[1]).rect(post, y + 10, 1, ground - y - 10, bone[2]);
  c.rect(x, y + 10, w, 2, ink[1]);
  c.rect(x, y, w, 10, blood[2]).rect(x, y, w, 1, blood[3]).rect(x, y + 9, w, 1, blood[1]);
  const word = 'EMERGENCY';
  blockText(c, x + Math.floor((w - blockWidth(word)) / 2), y + 2, word, bone[3], blood[0]);
  caseLamp(c, doorL + 12, y + 12);
}

function entrance(s: Shell): void {
  const { c, left, wallTop } = s;
  // The block stands a little proud of the wings, in a darker panel, glass all the way up.
  c.rect(left + 112, wallTop, 96, WALL, bone[0]);
  c.rect(left + 112, wallTop, 1, WALL, bone[1]).rect(left + 207, wallTop, 1, WALL, ash[0]);
  for (const x of [left + 118, left + 146, left + 174]) {
    c.rect(x, wallTop + 4, 28, 16, denim[0]);
    c.rect(x, wallTop + 4, 28, 1, ink[1]);
    c.line(x + 18, wallTop + 4, x + 6, wallTop + 19, denim[1]);
    for (let m = x + 6; m < x + 28; m += 7) c.rect(m, wallTop + 4, 1, 16, bone[0]);
  }
  c.rect(left + 120, wallTop + 11, 80, 1, bone[0]);
}

function front(s: Shell): void {
  const { c, left, right, footW, ground, wallTop } = s;
  c.rect(left, wallTop, footW, WALL, bone[1]);
  c.rect(left, wallTop, footW, 2, ink[1]);
  c.rect(left, wallTop, 1, WALL, bone[2]).rect(right, wallTop, 1, WALL, ash[0]);
  // The red band at each floor line.
  for (const y of [wallTop + STOREY + 1, wallTop + STOREY * 2 + 2]) c.rect(left, y, footW, 2, blood[1]).rect(left, y, footW, 1, blood[2]);
  ribbon(s, wallTop + 5, ['blind', 'dark', 'lit', 'blind', 'dark', 'cracked', 'blind']);
  ribbon(s, wallTop + STOREY + 6, ['dark', 'blind', 'blind', 'boarded', 'dark', 'lit', 'blind']);
  ribbon(s, wallTop + STOREY * 2 + 7, ['blind', 'dark', 'cracked', 'blind', 'boarded', 'dark']);
  entrance(s);
  c.rect(left, ground - 4, footW, 4, concrete[2]).rect(left, ground - 4, footW, 1, concrete[3]);
  doorway(s, 22, 'glass', PALE, concrete[1]);
  canopy(s);
  nameBoard(s);
  // An ambulance bay marked out along the kerb to the east of the doors.
  for (let x = left + 236; x < right - 10; x += 8) c.rect(x, ground - 2, 4, 1, fire[2]);
  streak(c, left + 20, wallTop + 16, [4, 2, 6], ash[0]);
  streak(c, left + 250, wallTop + 16, [2, 5, 3, 7], ash[0]);
  streak(c, left + 74, wallTop + 34, [3, 1, 4], ash[0]);
  grime(c, left, ground - 4, 60, [2, 4, 1, 3], concrete[0]);
  grime(c, right - 48, ground - 4, 48, [3, 1, 2, 4], concrete[0]);
}

export function buildHospital(): PixelSprite {
  const s = startShell('hospital', WALL);
  roof(s);
  front(s);
  return bakeShell(s);
}
