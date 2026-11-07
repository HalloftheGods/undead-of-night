// Three houses for the residential streets, with the same bones and different roofs: a
// four-sided hip, a gable turned to the road, and a long side-gabled bungalow.
// Each roof plane takes its own tone from the upper-left light.

import type { PixelSprite } from '../types.ts';
import { PixelCanvas } from '../kit.ts';
import type { Point } from '../kit.ts';
import { RAMPS } from '../palette.ts';
import type { Color } from '../palette.ts';
import { brickPatch, grime, streak, windowUnit } from './facade.ts';
import type { Trim } from './facade.ts';
import { bakeShell, doorway, startShell } from './shell.ts';
import type { Shell } from './shell.ts';

const { ink, metal, ash, wood, bone, brick, concrete, olive, grass, denim } = RAMPS;

const WALL = 28;
const WHITE: Trim = [ash[0], bone[0], bone[1]];

interface Plane {
  readonly points: readonly Point[];
  readonly base: Color;
  readonly course: Color;
}

/** Paints shingle courses over one plane only, with staggered tab cuts. */
function shingles(c: PixelCanvas, plane: Plane, alongY = false): void {
  const mask = new PixelCanvas(c.w, c.h).poly(plane.points, plane.base);
  for (let y = 0; y < c.h; y++) {
    for (let x = 0; x < c.w; x++) {
      const isOffRoof = mask.get(x, y) === null;
      if (isOffRoof) continue;
      const [run, across] = alongY ? [y, x] : [x, y];
      const band = Math.floor(across / 4);
      const onCourse = across % 4 === 3;
      const tab = (run + band * 5) % 10 === 0 && across % 4 > 0 && (run * 7 + band * 3) % 3 === 0;
      c.px(x, y, onCourse || tab ? plane.course : plane.base);
    }
  }
}

function chimney(c: PixelCanvas, x: number, y: number): void {
  c.rect(x + 12, y + 19, 4, 3, metal[0]);
  c.rect(x, y + 6, 12, 15, brick[1]);
  c.rect(x, y + 6, 1, 15, brick[2]).rect(x + 11, y + 6, 1, 15, brick[0]);
  brickPatch(c, x + 1, y + 8, 2);
  brickPatch(c, x + 3, y + 14, 2);
  // Cap: seen from above, with the flue as a black mouth.
  c.rect(x - 1, y, 14, 7, concrete[2]);
  c.rect(x - 1, y, 14, 1, concrete[3]).rect(x - 1, y, 1, 7, concrete[3]);
  c.rect(x - 1, y + 6, 14, 1, concrete[1]);
  c.rect(x + 3, y + 2, 7, 3, ink[0]);
  c.rect(x, y + 21, 12, 1, wood[0]);
}

function dormer(c: PixelCanvas, x: number, y: number): void {
  // Cheek shade, then wall, then a small gable lit on its left slope.
  c.rect(x + 18, y + 10, 3, 12, metal[0]);
  c.rect(x + 1, y + 9, 17, 13, olive[1]);
  c.rect(x + 1, y + 9, 1, 13, olive[2]).rect(x + 17, y + 9, 1, 13, olive[0]);
  windowUnit(c, x + 5, y + 12, 9, 7, 'dark', WHITE);
  c.poly([[x - 1, y + 10], [x + 9, y], [x + 9, y + 10]], metal[1]);
  c.poly([[x + 10, y], [x + 20, y + 10], [x + 10, y + 10]], metal[0]);
  c.line(x - 1, y + 10, x + 9, y, metal[2]).line(x + 10, y, x + 20, y + 10, metal[1]);
  c.rect(x - 1, y + 10, 22, 1, ash[0]);
}

interface Boards {
  readonly face: Color;
  readonly joint: Color;
  readonly lit: Color;
}

function clapboard(s: Shell, b: Boards): void {
  const { c, left, right, footW, ground, wallTop } = s;
  c.rect(left, wallTop, footW, WALL, b.face);
  for (let y = wallTop + 3; y < ground; y += 3) c.rect(left, y, footW, 1, b.joint);
  // Boards still catching light on the left of the house.
  for (const [x, y, w] of [[1, 5, 7], [1, 11, 4], [1, 17, 6], [72, 8, 12], [92, 17, 10]] as const) c.rect(left + x, wallTop + y, w, 1, b.lit);
  c.rect(left, wallTop, 1, WALL, b.lit).rect(right, wallTop, 1, WALL, b.joint);
  // The eaves drop a hard shade across the top boards.
  c.rect(left, wallTop, footW, 3, ink[1]);
  c.rect(left, ground - 4, footW, 4, concrete[1]).rect(left, ground - 4, footW, 1, concrete[2]);
  c.rect(left + 12, ground - 3, 4, 2, ink[1]);
}

function porch(s: Shell, roofTone: readonly [Color, Color, Color]): void {
  const { c, ground, wallTop, doorL, doorR } = s;
  const [dark, mid, lit] = roofTone;
  doorway(s, 22, 'timber', WHITE, wood[1]);
  const x = doorL - 4;
  const w = doorR - doorL + 8;
  const top = wallTop - 5;
  // Posts, one kicked out of true.
  c.rect(x, top + 8, 2, ground - top - 9, bone[0]).rect(x, top + 8, 1, ground - top - 9, bone[1]);
  c.line(x + w - 1, top + 8, x + w, ground - 2, bone[0]).line(x + w - 2, top + 8, x + w - 1, ground - 2, bone[1]);
  c.rect(x - 3, top, w + 6, 6, mid).rect(x - 3, top, w + 6, 1, lit).rect(x - 3, top + 3, w + 6, 1, dark);
  c.rect(x - 3, top + 6, w + 6, 1, bone[0]).rect(x - 3, top + 7, w + 6, 1, ink[1]);
}

// --- Hip roof ---------------------------------------------------------------------------

const EAVE_TOP = 3;
const HIP_RIDGE_Y = 34;
const HIP_RIDGE_L = 38;
const HIP_RIDGE_R = 78;

function hipRoof(s: Shell): void {
  const { c, left, right, wallTop } = s;
  const eaveL = left - 1;
  const eaveR = right + 1;
  const eaveBottom = wallTop - 1;
  const planes: readonly Plane[] = [
    // Rear, front, then the hips, so their lit arrises end up on top.
    { points: [[eaveL, EAVE_TOP], [eaveR, EAVE_TOP], [HIP_RIDGE_R, HIP_RIDGE_Y], [HIP_RIDGE_L, HIP_RIDGE_Y]], base: metal[1], course: ash[0] },
    { points: [[eaveL, eaveBottom], [HIP_RIDGE_L, HIP_RIDGE_Y], [HIP_RIDGE_R, HIP_RIDGE_Y], [eaveR, eaveBottom]], base: ash[0], course: metal[0] },
    { points: [[eaveL, EAVE_TOP], [HIP_RIDGE_L, HIP_RIDGE_Y], [eaveL, eaveBottom]], base: metal[1], course: ash[0] },
    { points: [[eaveR, EAVE_TOP], [HIP_RIDGE_R, HIP_RIDGE_Y], [eaveR, eaveBottom]], base: metal[0], course: ink[1] },
  ];
  planes.forEach((plane) => shingles(c, plane));
  // Hip and ridge caps. The lit hip runs down the left; the right one sits in shade.
  c.line(eaveL, eaveBottom, HIP_RIDGE_L, HIP_RIDGE_Y, metal[2]).line(eaveL, EAVE_TOP, HIP_RIDGE_L, HIP_RIDGE_Y, metal[2]);
  c.line(eaveR, eaveBottom, HIP_RIDGE_R, HIP_RIDGE_Y, metal[1]).line(eaveR, EAVE_TOP, HIP_RIDGE_R, HIP_RIDGE_Y, ash[0]);
  const ridgeW = HIP_RIDGE_R - HIP_RIDGE_L + 1;
  c.rect(HIP_RIDGE_L, HIP_RIDGE_Y, ridgeW, 1, metal[2]).rect(HIP_RIDGE_L, HIP_RIDGE_Y + 1, ridgeW, 1, metal[0]);
  c.rect(eaveL, EAVE_TOP, right - left + 3, 1, metal[2]);
}

function hipDamage(c: PixelCanvas): void {
  // Bare felt where shingles have slid.
  const felt: readonly (readonly [number, number, number])[] = [[34, 70, 7], [32, 71, 10], [33, 72, 11], [36, 73, 8], [38, 74, 3]];
  for (const [x, y, w] of felt) c.rect(x, y, w, 1, wood[1]);
  c.rect(36, 72, 4, 1, wood[2]);
  // The hole, with rafters still crossing it.
  const hole: readonly (readonly [number, number, number])[] = [
    [76, 58, 6], [73, 59, 11], [72, 60, 14], [72, 61, 16], [71, 62, 17], [72, 63, 16], [72, 64, 15], [73, 65, 14], [75, 66, 11], [77, 67, 6],
  ];
  for (const [x, y, w] of hole) c.rect(x, y, w, 1, ink[0]);
  for (const x of [76, 83]) c.line(x, 58, x - 2, 67, wood[2]).line(x + 1, 58, x - 1, 67, wood[1]);
  c.rect(71, 64, 18, 1, wood[1]);
  c.rect(75, 68, 8, 1, wood[1]).rect(72, 66, 3, 1, wood[1]);
  // Moss creeping along the shaded courses.
  for (const [x, y, w] of [[48, 84, 8], [49, 85, 5], [92, 86, 7], [60, 40, 6]] as const) c.rect(x, y, w, 1, grass[2]);
  c.rect(50, 83, 3, 1, olive[1]);
}

function gutter(s: Shell, sag: number): void {
  const { c, left, right, wallTop } = s;
  const y = wallTop - 1;
  const straight = sag - left;
  c.rect(left - 1, y, straight, 1, metal[2]).rect(left - 1, y + 1, straight, 1, metal[0]);
  // Sagging off its brackets towards the right.
  for (let i = 0; sag + i <= right + 1; i++) {
    const drop = y + Math.floor(i / 12);
    c.px(sag + i, drop, metal[2]).px(sag + i, drop + 1, metal[0]);
  }
}

export function buildHipHouse(): PixelSprite {
  const s = startShell('house', WALL);
  const { c, left, ground, wallTop } = s;
  hipRoof(s);
  hipDamage(c);
  chimney(c, 44, 8);
  dormer(c, 50, 60);
  clapboard(s, { face: olive[1], joint: olive[0], lit: olive[2] });
  windowUnit(c, left + 9, wallTop + 8, 11, 11, 'boarded', WHITE);
  windowUnit(c, left + 72, wallTop + 8, 11, 11, 'blind', WHITE);
  windowUnit(c, left + 92, wallTop + 8, 10, 11, 'lit', WHITE);
  gutter(s, 80);
  streak(c, left + 100, wallTop + 2, [3, 6, 2, 8, 1], olive[0]);
  porch(s, [ash[0], metal[1], metal[2]]);
  grime(c, left, ground - 4, 28, [2, 4, 1, 3], olive[0]);
  return bakeShell(s);
}

// --- Gable to the road ------------------------------------------------------------------

const PEAK = 24;
/** How far back the ridge runs on screen. */
const RIDGE_RUN = 70;

export function buildGableHouse(): PixelSprite {
  const s = startShell('house', WALL);
  const { c, left, right, ground, wallTop } = s;
  const mid = left + 56;
  const eaveL = left - 1;
  const eaveR = right + 1;
  const peak = wallTop - PEAK;
  const rear = wallTop - RIDGE_RUN;
  shingles(c, { points: [[eaveL, wallTop - 1], [mid, peak], [mid, peak - RIDGE_RUN + 1], [eaveL, rear]], base: grass[2], course: grass[1] }, true);
  shingles(c, { points: [[mid, peak], [eaveR, wallTop - 1], [eaveR, rear], [mid, peak - RIDGE_RUN + 1]], base: grass[1], course: grass[0] }, true);
  c.line(mid, peak, mid, peak - RIDGE_RUN + 1, olive[2]).line(mid + 1, peak, mid + 1, peak - RIDGE_RUN + 1, grass[0]);
  c.line(eaveL, rear, mid, peak - RIDGE_RUN + 1, olive[2]).line(mid, peak - RIDGE_RUN + 1, eaveR, rear, olive[1]);
  // Slipped courses, a vent stack and the chimney.
  for (const [x, y, h] of [[22, 40, 8], [26, 44, 6], [30, 42, 7], [90, 48, 9], [78, 26, 6]] as const) c.rect(x, y, 2, h, wood[1]);
  c.rect(84, 30, 3, 8, metal[1]).rect(84, 30, 1, 8, metal[2]).rect(83, 29, 5, 1, metal[2]).rect(87, 33, 2, 5, ink[1]);
  chimney(c, 26, 16);
  for (const [x, y, w] of [[8, 60, 9], [10, 61, 5], [96, 66, 8], [36, 54, 5]] as const) c.rect(x, y, w, 1, olive[1]);

  clapboard(s, { face: denim[0], joint: metal[0], lit: denim[1] });
  // The gable end, boarded the same way, under white bargeboards.
  c.poly([[left, wallTop], [mid, peak + 1], [right, wallTop]], denim[0]);
  const gable = new PixelCanvas(c.w, c.h).poly([[left, wallTop], [mid, peak + 1], [right, wallTop]], denim[0]);
  for (let y = peak + 3; y < wallTop; y += 3) {
    for (let x = left; x <= right; x++) {
      const onGable = gable.get(x, y) !== null;
      if (onGable) c.px(x, y, metal[0]);
    }
  }
  c.ellipse(mid + 0.5, wallTop - 9, 5.5, 5.5, bone[0]).ellipse(mid + 0.5, wallTop - 9, 4, 4, ink[1]);
  c.rect(mid, wallTop - 13, 1, 9, bone[0]).rect(mid - 3, wallTop - 9, 8, 1, bone[0]);
  c.line(left - 1, wallTop, mid, peak, bone[1]).line(left - 1, wallTop + 1, mid, peak + 1, ash[0]);
  c.line(mid + 1, peak, right + 1, wallTop, bone[0]).line(mid + 1, peak + 1, right + 1, wallTop + 1, ash[0]);
  windowUnit(c, left + 8, wallTop + 8, 12, 12, 'dark', WHITE);
  windowUnit(c, left + 74, wallTop + 8, 12, 12, 'cracked', WHITE);
  windowUnit(c, left + 93, wallTop + 8, 12, 12, 'boarded', WHITE);
  porch(s, [grass[0], grass[1], grass[2]]);
  grime(c, left, ground - 4, 24, [2, 3, 1, 3], metal[0]);
  grime(c, right - 16, ground - 4, 16, [3, 1, 2], metal[0]);
  return bakeShell(s);
}

// --- Bungalow ---------------------------------------------------------------------------

const BUNGALOW_RIDGE = 26;

function tarp(c: PixelCanvas, x: number, y: number): void {
  c.poly([[x, y + 2], [x + 26, y], [x + 30, y + 19], [x + 3, y + 22]], denim[1]);
  c.line(x, y + 2, x + 26, y, denim[2]).line(x + 3, y + 22, x + 30, y + 19, denim[0]);
  c.line(x + 8, y + 3, x + 12, y + 20, denim[0]).line(x + 18, y + 2, x + 22, y + 19, denim[0]);
  // Weighted down with whatever was to hand.
  for (const [px, py] of [[x - 1, y + 2], [x + 25, y - 1], [x + 29, y + 18], [x + 3, y + 21]] as const) c.rect(px, py, 3, 2, concrete[3]);
}

function shedDormer(c: PixelCanvas, x: number, y: number, w: number): void {
  const h = 16;
  c.rect(x + 3, y + h, w, 3, wood[0]).rect(x + w, y + 3, 3, h, wood[0]);
  c.rect(x, y, w, 5, wood[2]).rect(x, y, w, 1, wood[3]);
  c.rect(x, y + 5, w, h - 5, brick[0]).rect(x, y + 5, w, 1, ink[1]);
  windowUnit(c, x + 5, y + 8, 12, 6, 'dark', WHITE);
  windowUnit(c, x + 22, y + 8, 12, 6, 'blind', WHITE);
  windowUnit(c, x + 39, y + 8, 12, 6, 'dark', WHITE);
}

export function buildBungalow(): PixelSprite {
  const s = startShell('house', WALL);
  const { c, left, right, footW, ground, wallTop } = s;
  const eaveL = left - 1;
  const eaveR = right + 1;
  shingles(c, { points: [[eaveL, EAVE_TOP], [eaveR, EAVE_TOP], [eaveR, BUNGALOW_RIDGE], [eaveL, BUNGALOW_RIDGE]], base: wood[2], course: wood[1] });
  shingles(c, { points: [[eaveL, BUNGALOW_RIDGE], [eaveR, BUNGALOW_RIDGE], [eaveR, wallTop - 1], [eaveL, wallTop - 1]], base: wood[1], course: wood[0] });
  c.rect(eaveL, BUNGALOW_RIDGE, footW + 2, 1, wood[3]).rect(eaveL, BUNGALOW_RIDGE + 1, footW + 2, 1, wood[0]);
  c.rect(eaveL, EAVE_TOP, footW + 2, 1, wood[3]).rect(eaveL, EAVE_TOP, 1, wallTop - EAVE_TOP, wood[2]);
  c.rect(eaveR, EAVE_TOP, 1, wallTop - EAVE_TOP, wood[0]);
  chimney(c, 88, 7);
  shedDormer(c, 18, 40, 56);
  tarp(c, 76, 56);
  // Moss in the wet end of the roof.
  for (const [x, y, w] of [[10, 80, 9], [12, 81, 5], [52, 86, 8], [90, 40, 6]] as const) c.rect(x, y, w, 1, olive[1]);

  c.rect(left, wallTop, footW, WALL, brick[1]);
  for (const [x, y, p] of [[4, 8, 2], [72, 4, 1], [94, 16, 2]] as const) brickPatch(c, left + x, wallTop + y, p);
  c.rect(left, wallTop, 1, WALL, brick[2]).rect(right, wallTop, 1, WALL, brick[0]);
  c.rect(left, wallTop, footW, 3, ink[1]);
  c.rect(left, ground - 4, footW, 4, concrete[0]).rect(left, ground - 4, footW, 1, concrete[1]);
  windowUnit(c, left + 8, wallTop + 7, 13, 12, 'blind', WHITE);
  // A bay of three lights, one still burning.
  c.rect(left + 70, wallTop + 4, 38, 18, bone[0]).rect(left + 70, wallTop + 4, 38, 1, bone[1]);
  windowUnit(c, left + 73, wallTop + 7, 9, 12, 'dark', WHITE);
  windowUnit(c, left + 85, wallTop + 7, 9, 12, 'lit', WHITE);
  windowUnit(c, left + 97, wallTop + 7, 9, 12, 'boarded', WHITE);
  porch(s, [wood[0], wood[1], wood[2]]);
  grime(c, left, ground - 4, 30, [2, 4, 1, 3], brick[0]);
  return bakeShell(s);
}
