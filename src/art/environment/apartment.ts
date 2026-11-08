// Two blocks of flats, the tallest fronts in town: old brick with a fire escape and a water
// tank on the roof, and a concrete slab block with balconies and dishes.

import type { PixelSprite } from '../types.ts';
import { RAMPS } from '../palette.ts';
import { brickPatch, grime, streak, windowUnit } from './facade.ts';
import type { Trim, WindowKind } from './facade.ts';
import { acUnit, bulkhead, dish, roofVent, tarPatch, waterTank } from './roof-kit.ts';
import { dressForHalloween } from './halloween.ts';
import { bakeShell, caseLamp, doorway, startShell } from './shell.ts';
import type { Shell } from './shell.ts';
import { GREY_PARAPET, parapetRoof, puddle, rollSeams } from './shop.ts';
import { signBoard, smallText } from './signage.ts';

const { ink, metal, concrete, asphalt, bone, ash, brick, wood, denim, olive } = RAMPS;

const WALL = 56;
const ROOF_TOP = 8;
const STONE: Trim = [concrete[0], concrete[1], concrete[2]];

type Floor = readonly (readonly [number, WindowKind])[];

const BRICK_FLOORS: readonly (readonly [number, Floor])[] = [
  [5, [[8, 'dark'], [30, 'blind'], [52, 'dark'], [76, 'lit'], [100, 'dark']]],
  // The middle of this floor is the stair landing, over the entrance.
  [22, [[8, 'boarded'], [30, 'dark'], [100, 'cracked']]],
  [41, [[8, 'dark'], [30, 'boarded'], [108, 'boarded']]],
];

function fireEscape(s: Shell, x: number): void {
  const { c, ground, wallTop } = s;
  for (const y of [wallTop + 18, wallTop + 35]) {
    // Landing, rail, and the shadow it throws on the brick.
    c.rect(x, y + 3, 36, 1, ink[1]).rect(x, y, 36, 3, metal[0]).rect(x, y, 36, 1, metal[1]);
    c.rect(x, y - 8, 36, 1, metal[1]).rect(x, y - 4, 36, 1, metal[0]);
    for (let i = x; i <= x + 35; i += 7) c.rect(i, y - 8, 1, 8, metal[0]);
  }
  c.line(x + 3, wallTop + 34, x + 30, wallTop + 19, metal[1]).line(x + 3, wallTop + 35, x + 30, wallTop + 20, metal[0]);
  // The drop ladder, stuck half way.
  c.rect(x + 28, wallTop + 38, 1, ground - wallTop - 46, metal[1]).rect(x + 33, wallTop + 38, 1, ground - wallTop - 46, metal[1]);
  for (let y = wallTop + 40; y < ground - 9; y += 3) c.rect(x + 28, y, 6, 1, metal[0]);
}

function brickFront(s: Shell): void {
  const { c, left, right, footW, ground, wallTop, doorL, doorR } = s;
  c.rect(left, wallTop, footW, WALL, brick[1]);
  c.rect(left, wallTop, footW, 2, ink[1]);
  for (const [x, y, p] of [[6, 18, 1], [40, 3, 2], [66, 18, 0], [116, 3, 1], [130, 26, 2], [4, 36, 2], [50, 40, 2]] as const) {
    brickPatch(c, left + x, wallTop + y, p);
  }
  // Stone string courses between floors.
  for (const y of [wallTop + 18, wallTop + 36]) c.rect(left, y, footW, 1, concrete[1]);
  c.rect(left, wallTop, 1, WALL, brick[2]).rect(right, wallTop, 1, WALL, brick[0]);
  c.rect(left, ground - 3, footW, 3, concrete[0]).rect(left, ground - 3, footW, 1, concrete[1]);
  for (const [y, row] of BRICK_FLOORS) for (const [x, kind] of row) windowUnit(c, left + x, wallTop + y, 13, 11, kind, STONE);
  fireEscape(s, left + 116);
  // Entrance with the block's name on a stone head.
  doorway(s, 22, 'timber', STONE, concrete[0]);
  signBoard(c, doorL - 5, ground - 33, doorR - doorL + 10, 9, concrete[1], concrete[3]);
  smallText(c, doorL - 3, ground - 31, 'APARTMENTS', ink[1]);
  caseLamp(c, doorL + 12, ground - 24);
  streak(c, left + 12, wallTop + 34, [3, 6, 2], brick[0]);
  streak(c, left + 56, wallTop + 34, [2, 8, 3, 5], brick[0]);
  grime(c, left, ground - 3, 40, [2, 4, 1, 3], brick[0]);
  grime(c, right - 34, ground - 3, 34, [3, 1, 2, 4], brick[0]);
}

function brickRoof(s: Shell): void {
  const { c, left } = s;
  const shade = asphalt[2];
  const box = parapetRoof(s, ROOF_TOP, { ...GREY_PARAPET, lit: brick[2], top: brick[1], face: brick[0], low: ink[1] });
  rollSeams(c, box, [38, 70], shade);
  tarPatch(c, left + 78, 30, [[3, 9], [1, 15], [0, 19], [0, 20], [2, 17], [6, 9]]);
  tarPatch(c, left + 16, 74, [[2, 6], [0, 13], [0, 16], [1, 16], [0, 12], [3, 8]]);
  bulkhead(c, left + 112, 14, 30, 10, 11, shade);
  acUnit(c, left + 62, 56, 16, shade);
  roofVent(c, left + 12, 62, shade);
  roofVent(c, left + 96, 66, shade);
  roofVent(c, left + 136, 62, shade);
  puddle(c, left + 104, 80, 22);
  waterTank(c, left + 18, 1, shade);
}

export function buildBrickApartment(): PixelSprite {
  const s = startShell('apartment', WALL);
  brickRoof(s);
  brickFront(s);
  dressForHalloween(s, { lightsY: s.wallTop + 2, pumpkins: [s.doorR + 5, s.doorR + 15], webs: [[s.left + 30, s.wallTop + 22]] });
  return bakeShell(s);
}

function balcony(s: Shell, x: number, y: number, cloth: number): void {
  const { c } = s;
  const w = 30;
  // Door and window behind, then slab, then rail.
  windowUnit(c, x + 3, y - 12, 10, 12, 'dark', STONE);
  windowUnit(c, x + 17, y - 12, 10, 12, cloth === 1 ? 'lit' : 'blind', STONE);
  c.rect(x + 1, y + 3, w, 2, ink[1]);
  c.rect(x, y, w, 3, concrete[2]).rect(x, y, w, 1, concrete[3]);
  c.rect(x, y - 7, w, 1, metal[2]);
  for (let i = x; i < x + w; i += 3) c.rect(i, y - 6, 1, 6, metal[0]);
  c.rect(x, y - 7, 1, 7, metal[1]).rect(x + w - 1, y - 7, 1, 7, metal[0]);
  const hasWashing = cloth === 2;
  const boardedUp = cloth === 3;
  if (hasWashing) c.rect(x + 6, y - 6, 8, 7, bone[0]).rect(x + 6, y - 6, 8, 1, bone[1]).rect(x + 16, y - 6, 5, 5, denim[1]);
  if (boardedUp) c.rect(x + 1, y - 6, w - 2, 6, wood[1]).rect(x + 1, y - 4, w - 2, 1, wood[0]).rect(x + 1, y - 6, w - 2, 1, wood[2]);
}

function slabFront(s: Shell): void {
  const { c, left, right, footW, ground, wallTop, doorL, doorR } = s;
  c.rect(left, wallTop, footW, WALL, ash[0]);
  c.rect(left, wallTop, footW, 2, ink[1]);
  // Panel joints: the system-built grid, stained where it leaks.
  for (const x of [left + 40, left + 120]) c.rect(x, wallTop, 1, WALL, concrete[0]);
  for (const y of [wallTop + 18, wallTop + 36]) c.rect(left, y, footW, 2, concrete[0]).rect(left, y, footW, 1, concrete[1]);
  c.rect(left, wallTop, 1, WALL, ash[1]).rect(right, wallTop, 1, WALL, concrete[0]);
  c.rect(left, ground - 3, footW, 3, concrete[1]).rect(left, ground - 3, footW, 1, concrete[2]);
  // The stair tower: one tall strip of glass over the door.
  c.rect(doorL + 6, wallTop + 1, 20, 33, concrete[1]);
  c.rect(doorL + 6, wallTop + 1, 1, 33, concrete[2]);
  c.rect(doorL + 9, wallTop + 3, 14, 29, denim[0]);
  for (const y of [wallTop + 10, wallTop + 17, wallTop + 24]) c.rect(doorL + 9, y, 14, 1, metal[1]);
  c.rect(doorL + 11, wallTop + 11, 10, 6, olive[1]).rect(doorL + 11, wallTop + 11, 10, 2, olive[2]);
  balcony(s, left + 7, wallTop + 15, 0);
  balcony(s, left + 41, wallTop + 15, 2);
  balcony(s, left + 90, wallTop + 15, 1);
  balcony(s, left + 124, wallTop + 15, 3);
  balcony(s, left + 7, wallTop + 33, 2);
  balcony(s, left + 41, wallTop + 33, 3);
  balcony(s, left + 90, wallTop + 33, 0);
  balcony(s, left + 124, wallTop + 33, 2);
  windowUnit(c, left + 12, ground - 15, 18, 9, 'boarded', STONE);
  windowUnit(c, left + 42, ground - 15, 14, 9, 'dark', STONE);
  windowUnit(c, doorR + 8, ground - 15, 14, 9, 'cracked', STONE);
  windowUnit(c, left + 128, ground - 15, 18, 9, 'dark', STONE);
  doorway(s, 22, 'steel', STONE, concrete[0]);
  caseLamp(c, doorL + 12, ground - 24);
  // A flat concrete hood over the door.
  c.rect(doorL - 6, ground - 26, doorR - doorL + 12, 3, concrete[2]).rect(doorL - 6, ground - 26, doorR - doorL + 12, 1, concrete[3]);
  c.rect(doorL - 6, ground - 23, doorR - doorL + 12, 1, ink[1]);
  streak(c, left + 40, wallTop + 3, [6, 14, 4], concrete[0]);
  streak(c, left + 118, wallTop + 20, [4, 11, 7], concrete[0]);
  grime(c, left, ground - 3, 50, [2, 4, 1, 3], concrete[0]);
  grime(c, right - 40, ground - 3, 40, [3, 1, 2, 4], concrete[0]);
}

function slabRoof(s: Shell): void {
  const { c, left } = s;
  const shade = asphalt[2];
  const box = parapetRoof(s, 3, { ...GREY_PARAPET, field: concrete[1], lit: bone[0], top: ash[1], face: ash[0], low: concrete[0] });
  rollSeams(c, box, [32, 62], concrete[0]);
  tarPatch(c, left + 104, 66, [[2, 6], [0, 13], [0, 16], [1, 16], [0, 12], [3, 8]]);
  bulkhead(c, left + 62, 14, 36, 14, 14, shade);
  dish(c, left + 18, 16, shade);
  dish(c, left + 30, 20, shade);
  dish(c, left + 124, 14, shade);
  dish(c, left + 136, 30, shade);
  acUnit(c, left + 14, 60, 28, shade);
  roofVent(c, left + 112, 44, shade);
  roofVent(c, left + 72, 70, shade);
  puddle(c, left + 124, 80, 20);
  // A washing line someone strung up here, once it stopped being safe downstairs.
  c.line(left + 50, 50, left + 108, 56, metal[1]);
  for (const [x, y, w, h, tone] of [[56, 51, 8, 9, bone[0]], [68, 52, 6, 7, denim[1]], [84, 53, 9, 10, bone[1]]] as const) {
    c.rect(left + x + 2, y + 2, w, h, shade).rect(left + x, y, w, h, tone);
  }
}

export function buildSlabApartment(): PixelSprite {
  const s = startShell('apartment', WALL);
  slabRoof(s);
  slabFront(s);
  dressForHalloween(s, { lightsY: s.wallTop + 2, pumpkins: [s.doorR + 5, s.doorR + 15], webs: [[s.left + 42, s.ground - 15]] });
  return bakeShell(s);
}
