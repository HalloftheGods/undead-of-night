// The school: two storeys of red brick with tall white-framed windows, a stone entrance bay
// under a gable with the clock stopped in it, the name cut in the lintel, and a flagpole on
// the roof flying what is left of a flag. A row of bike racks waits by the steps.

import type { PixelSprite } from '../types.ts';
import type { PixelCanvas } from '../kit.ts';
import { RAMPS } from '../palette.ts';
import { brickPatch, grime, streak, windowUnit } from './facade.ts';
import type { Trim, WindowKind } from './facade.ts';
import { acUnit, bulkhead, roofVent, skylight, tarPatch, turbineVent } from './roof-kit.ts';
import { bakeShell, caseLamp, doorway, startShell } from './shell.ts';
import type { Shell } from './shell.ts';
import { GREY_PARAPET, parapetRoof, puddle, rollSeams } from './shop.ts';
import { heavyText, heavyWidth, smallText } from './signage.ts';

const { ink, metal, concrete, asphalt, bone, brick, blood, denim, fire, wood } = RAMPS;

const WALL = 50;
const ROOF_TOP = 6;
const WHITE: Trim = [bone[0], bone[2], bone[3]];
const STONE: Trim = [concrete[1], concrete[3], bone[1]];
const BAY_L = 108;
const BAY_W = 72;

/** A pole on the roof with a flag gone to tatters. */
function flagpole(c: PixelCanvas, x: number, foot: number): void {
  const top = 0;
  c.rect(x + 2, foot, 5, 2, asphalt[1]);
  c.rect(x, top, 1, foot - top, metal[3]).rect(x + 1, top + 1, 1, foot - top - 1, metal[1]);
  c.px(x, top, bone[3]);
  c.rect(x + 2, top + 2, 13, 3, blood[2]).rect(x + 2, top + 5, 11, 3, bone[2]).rect(x + 2, top + 8, 9, 2, denim[1]);
  // The fly end, torn ragged.
  for (const [dx, dy] of [[15, 3], [13, 6], [11, 9], [12, 4]] as const) c.px(x + dx, top + dy, ink[1]);
}

/** Painted lines of a court on the roof of the gym wing. */
function court(c: PixelCanvas, x: number, y: number, w: number, h: number): void {
  c.rect(x, y, w, h, concrete[0]);
  c.frame(x, y, w, h, fire[1]);
  c.rect(x + Math.floor(w / 2), y, 1, h, fire[1]);
  c.ellipse(x + w / 2, y + h / 2, 7, 7, fire[1]).ellipse(x + w / 2, y + h / 2, 6, 6, concrete[0]);
  c.rect(x + Math.floor(w / 2), y + h / 2 - 6, 1, 13, fire[1]);
  // Faded away down one side.
  c.rect(x + w - 18, y + h - 1, 14, 1, concrete[0]).rect(x, y + 6, 1, 9, concrete[0]);
}

function roof(s: Shell): void {
  const { c, left } = s;
  const shade = asphalt[2];
  const box = parapetRoof(s, ROOF_TOP, GREY_PARAPET);
  rollSeams(c, box, [34, 66, 98, 124], shade);
  tarPatch(c, left + 40, 104, [[2, 7], [0, 12], [0, 15], [1, 13], [4, 6]]);
  tarPatch(c, left + 200, 26, [[3, 10], [0, 16], [1, 18], [0, 14], [5, 7]]);
  court(c, left + 182, 52, 86, 52);
  // A row of skylights over the classrooms, two of them gone.
  for (const [x, gone] of [[18, 4], [52, 19], [86, 9]] as const) skylight(c, left + x, 60, 26, 8, shade, gone);
  bulkhead(c, left + 120, 18, 34, 12, 12, shade);
  acUnit(c, left + 18, 16, 28, shade);
  acUnit(c, left + 54, 16, 28, shade);
  turbineVent(c, left + 166, 18, shade);
  roofVent(c, left + 30, 92, shade);
  roofVent(c, left + 132, 108, shade);
  roofVent(c, left + 246, 20, shade);
  puddle(c, left + 70, 112, 24);
  flagpole(c, left + 228, 30);
}

/** The gable over the entrance bay, with the clock stopped at a quarter to midnight. */
function gable(s: Shell): void {
  const { c, left, wallTop } = s;
  const x0 = left + BAY_L - 4;
  const x1 = left + BAY_L + BAY_W + 4;
  const peak = wallTop - 18;
  const cx = (x0 + x1) / 2;
  c.poly([[x0, wallTop + 1], [cx, peak], [x1, wallTop + 1]], concrete[3]);
  c.poly([[x0 + 4, wallTop], [cx, peak + 3], [x1 - 4, wallTop]], brick[1]);
  c.line(x0, wallTop + 1, cx, peak, bone[2]).line(cx, peak, x1, wallTop + 1, concrete[1]);
  c.ellipse(cx, wallTop - 6, 6, 6, bone[2]).ellipse(cx, wallTop - 6, 5, 5, bone[3]);
  c.rect(cx, wallTop - 10, 1, 4, ink[1]).line(cx, wallTop - 6, cx - 3, wallTop - 6, ink[1]);
  c.px(cx, wallTop - 6, blood[2]);
}

function bay(s: Shell): void {
  const { c, left, wallTop, ground } = s;
  const x = left + BAY_L;
  c.rect(x, wallTop, BAY_W, WALL, concrete[2]);
  c.rect(x, wallTop, 1, WALL, concrete[3]).rect(x + BAY_W - 1, wallTop, 1, WALL, concrete[0]);
  // Rusticated quoins up both edges of the bay.
  for (let y = wallTop + 2; y < ground - 6; y += 6) {
    c.rect(x - 3, y, 4, 4, bone[1]).rect(x - 3, y, 4, 1, bone[2]);
    c.rect(x + BAY_W - 1, y + 3, 4, 4, bone[1]).rect(x + BAY_W - 1, y + 3, 4, 1, bone[2]);
  }
  // The lintel with the name.
  const word = 'SCHOOL';
  c.rect(x + 4, wallTop + 4, BAY_W - 8, 13, bone[1]);
  c.rect(x + 4, wallTop + 4, BAY_W - 8, 1, bone[3]).rect(x + 4, wallTop + 16, BAY_W - 8, 1, concrete[1]);
  const wordX = x + Math.floor((BAY_W - heavyWidth(word)) / 2);
  heavyText(c, wordX + 1, wallTop + 8, word, concrete[1]);
  heavyText(c, wordX, wallTop + 7, word, brick[0]);
  // A fanlight over the doors, one pane still lit from inside.
  const mid = x + BAY_W / 2;
  c.rect(mid - 18, wallTop + 19, 36, 7, bone[2]);
  c.rect(mid - 16, wallTop + 20, 32, 5, denim[0]);
  for (let m = mid - 10; m < mid + 16; m += 6) c.rect(m, wallTop + 20, 1, 5, bone[2]);
  c.rect(mid + 2, wallTop + 20, 5, 5, fire[2]);
  // Steps up to the doors.
  c.rect(x + 14, ground - 2, BAY_W - 28, 2, concrete[3]).rect(x + 14, ground - 1, BAY_W - 28, 1, concrete[1]);
}

/** Tall sash windows in two storeys along both wings. */
function wings(s: Shell): void {
  const { c, left, wallTop } = s;
  const upper: readonly WindowKind[] = ['dark', 'blind', 'dark', 'cracked', 'dark', 'lit', 'blind', 'dark', 'dark', 'boarded', 'dark', 'blind'];
  const lower: readonly WindowKind[] = ['blind', 'dark', 'boarded', 'dark', 'dark', 'blind', 'dark', 'lit', 'boarded', 'dark', 'dark', 'cracked'];
  const columns = [10, 34, 58, 82, 196, 220, 244, 268];
  columns.forEach((x, i) => {
    windowUnit(c, left + x, wallTop + 6, 12, 14, upper[i], WHITE);
    windowUnit(c, left + x, wallTop + 28, 12, 14, lower[i], WHITE);
  });
  // A white string course at the floor line.
  c.rect(left, wallTop + 23, BAY_L - 3, 2, bone[2]).rect(left + BAY_L + BAY_W + 3, wallTop + 23, s.footW - BAY_L - BAY_W - 3, 2, bone[2]);
}

/** Bike racks by the steps, one bike left chained to them. */
function bikeRack(c: PixelCanvas, x: number, ground: number): void {
  for (let i = 0; i < 4; i++) c.rect(x + i * 6, ground - 7, 1, 6, metal[2]).rect(x + i * 6, ground - 7, 5, 1, metal[2]).rect(x + i * 6 + 4, ground - 7, 1, 6, metal[1]);
  c.ellipse(x + 8, ground - 4, 3, 3, ink[1]).ellipse(x + 8, ground - 4, 2, 2, metal[0]);
  c.ellipse(x + 17, ground - 4, 3, 3, ink[1]).ellipse(x + 17, ground - 4, 2, 2, metal[0]);
  c.line(x + 8, ground - 4, x + 12, ground - 8, blood[2]).line(x + 12, ground - 8, x + 17, ground - 4, blood[2]);
}

function front(s: Shell): void {
  const { c, left, right, footW, ground, wallTop } = s;
  c.rect(left, wallTop, footW, WALL, brick[1]);
  c.rect(left, wallTop, footW, 2, ink[1]);
  c.rect(left, wallTop, footW, 3, bone[1]).rect(left, wallTop, footW, 1, bone[2]);
  for (const [x, y, p] of [[40, 34, 0], [212, 4, 1], [140, 40, 2], [256, 36, 2]] as const) brickPatch(c, left + x, wallTop + y, p);
  c.rect(left, wallTop, 1, WALL, brick[2]).rect(right, wallTop, 1, WALL, brick[0]);
  c.rect(left, ground - 4, footW, 4, concrete[1]).rect(left, ground - 4, footW, 1, concrete[2]);
  wings(s);
  bay(s);
  gable(s);
  doorway(s, 22, 'timber', STONE, wood[1]);
  caseLamp(c, s.doorL - 12, ground - 20);
  // A banner still strung across the east wing from the last game of the season.
  c.rect(left + 214, wallTop + 22, 44, 7, bone[2]).rect(left + 214, wallTop + 22, 44, 1, bone[3]).rect(left + 214, wallTop + 28, 44, 1, bone[0]);
  smallText(c, left + 222, wallTop + 23, 'GO TEAM', blood[2]);
  bikeRack(c, left + 196, ground);
  streak(c, left + 22, wallTop + 44, [2, 1, 3], brick[0]);
  streak(c, left + 236, wallTop + 20, [3, 5, 2], brick[0]);
  grime(c, left, ground - 4, 50, [2, 4, 1, 3], brick[0]);
  grime(c, right - 44, ground - 4, 44, [3, 1, 2, 4], brick[0]);
}

export function buildSchool(): PixelSprite {
  const s = startShell('school', WALL);
  roof(s);
  front(s);
  return bakeShell(s);
}
