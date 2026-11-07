// The auto garage: a low corrugated shed with roll doors along the front. The left bay is
// up and is the way in; the others are shut, one of them stoved in.

import type { PixelSprite } from '../types.ts';
import { RAMPS } from '../palette.ts';
import { grime, rust, streak } from './facade.ts';
import { roofVent, turbineVent } from './roof-kit.ts';
import { bakeShell, caseLamp, doorway, startShell } from './shell.ts';
import type { Shell } from './shell.ts';
import { blockText, blockWidth, signBoard } from './signage.ts';

const { ink, metal, concrete, asphalt, fire, ash, olive } = RAMPS;

const WALL = 36;
const ROOF_TOP = 3;
const RIDGE = 40;

/** Corrugated sheet: a rib every 4px, the rear plane lit and the front one dull. */
function plane(s: Shell, y: number, h: number, base: number, rib: number, hi: number): void {
  const { c, left, footW } = s;
  c.rect(left, y, footW, h, base);
  for (let x = left + 1; x < left + footW; x += 4) c.rect(x, y, 1, h, rib).rect(x + 1, y, 1, h, hi);
}

function roof(s: Shell): void {
  const { c, left, right, footW, wallTop } = s;
  plane(s, ROOF_TOP, RIDGE - ROOF_TOP, metal[1], metal[0], ash[1]);
  plane(s, RIDGE, wallTop - RIDGE, ash[0], metal[0], metal[1]);
  c.rect(left, RIDGE - 2, footW, 3, metal[2]).rect(left, RIDGE - 2, footW, 1, metal[3]).rect(left, RIDGE + 1, footW, 1, ink[1]);
  for (let x = left + 12; x < right; x += 24) c.rect(x, RIDGE - 2, 2, 3, metal[0]);
  // Sheet laps across the long front plane.
  for (const [x, y, w] of [[14, 60, 44], [76, 72, 52], [120, 54, 40], [28, 86, 36]] as const) c.rect(left + x, y, w, 1, metal[0]);
  rust(c, left + 20, RIDGE + 2, [4, 12, 6, 15, 3, 9, 5, 18, 7]);
  rust(c, left + 104, RIDGE + 2, [3, 14, 6, 20, 8, 4, 12]);
  rust(c, left + 146, 60, [5, 9, 3, 14, 6]);
  rust(c, left + 58, 8, [3, 10, 5, 14, 2]);
  // Translucent sheets gone yellow, one of them holed.
  c.rect(left + 62, 56, 16, 24, olive[1]).rect(left + 62, 56, 16, 1, olive[2]).rect(left + 62, 56, 1, 24, olive[2]);
  for (const x of [left + 66, left + 70, left + 74]) c.rect(x, 57, 1, 23, olive[0]);
  c.rect(left + 67, 66, 7, 6, ink[0]).rect(left + 69, 65, 4, 1, ink[0]);
  turbineVent(c, left + 136, 16, ink[1]);
  turbineVent(c, left + 34, 12, ink[1]);
  roofVent(c, left + 122, 84, ink[1]);
  // Stove flue.
  c.rect(left + 92, 8, 5, 26, metal[0]).rect(left + 92, 8, 2, 26, metal[2]).rect(left + 90, 6, 9, 3, metal[1]).rect(left + 90, 6, 9, 1, metal[3]);
  c.rect(left + 97, 12, 3, 22, ink[1]);
  c.rect(left, ROOF_TOP, footW, 1, metal[3]);
  c.rect(left, wallTop - 1, footW, 1, metal[2]);
  c.rect(left, ROOF_TOP, 1, wallTop - ROOF_TOP, metal[2]).rect(right, ROOF_TOP, 1, wallTop - ROOF_TOP, metal[0]);
}

function rollDoor(s: Shell, x: number, w: number): void {
  const { c, ground } = s;
  const top = ground - 26;
  c.rect(x - 2, top - 2, w + 4, 28, metal[1]).rect(x - 2, top - 2, w + 4, 1, metal[2]).rect(x - 2, top - 2, 1, 28, metal[2]);
  c.rect(x, top, w, 26, ash[0]);
  for (let y = top + 1; y < ground; y += 3) c.rect(x, y, w, 1, metal[0]);
  c.rect(x, top, w, 1, ink[1]);
  c.rect(x + Math.floor(w / 2) - 3, ground - 3, 6, 1, metal[3]);
}

function hazard(s: Shell, x: number, h: number): void {
  const { c, ground } = s;
  for (let y = 0; y < h; y += 1) c.rect(x, ground - 1 - y, 3, 1, Math.floor(y / 3) % 2 === 0 ? fire[1] : ink[1]);
}

/** One tyre lying flat: tread at the front, and when it tops a stack, the hole. */
function tyre(s: Shell, x: number, y: number, top: boolean): void {
  const { c } = s;
  c.rect(x + 1, y, 16, 5, asphalt[2]).rect(x, y + 1, 18, 3, asphalt[2]);
  c.rect(x + 1, y + 4, 16, 1, ink[0]);
  for (let i = x + 2; i < x + 16; i += 3) c.rect(i, y + 1, 1, 3, ink[1]);
  c.rect(x + 1, y, 16, 1, concrete[0]);
  if (top) c.ellipse(x + 8.5, y - 1, 8.5, 3.5, asphalt[2]).ellipse(x + 8.5, y - 1, 4.5, 1.5, ink[0]).rect(x + 4, y - 4, 10, 1, concrete[0]);
}

function tyres(s: Shell, x: number): void {
  const { ground } = s;
  tyre(s, x, ground - 5, false);
  tyre(s, x, ground - 10, false);
  tyre(s, x + 1, ground - 15, true);
  tyre(s, x + 13, ground - 5, true);
}

function wrench(s: Shell, x: number, y: number): void {
  s.c.grid(x, y, [
    '.........bb.',
    '........bb..',
    '.......bbb.b',
    '......bbbbbb',
    '.....bbbbbb.',
    '....bbb.....',
    'b.bbb.......',
    'bbbb........',
    '.bb.........',
  ], { b: fire[2] });
}

function front(s: Shell): void {
  const { c, left, right, footW, ground, wallTop, doorL, doorR } = s;
  c.rect(left, wallTop, footW, WALL, olive[0]);
  for (let x = left + 2; x < right; x += 4) c.rect(x, wallTop, 1, WALL, ink[1]);
  c.rect(left, wallTop, footW, 2, ink[1]);
  c.rect(left, wallTop, 1, WALL, olive[2]).rect(right, wallTop, 1, WALL, ink[1]);
  c.rect(left, ground - 3, footW, 3, concrete[1]).rect(left, ground - 3, footW, 1, concrete[2]);
  rollDoor(s, doorR + 12, 42);
  rollDoor(s, doorR + 64, 42);
  // Something drove into the right-hand shutter.
  c.rect(doorR + 76, ground - 16, 20, 11, metal[0]);
  for (const y of [ground - 15, ground - 12, ground - 9]) c.rect(doorR + 76, y, 20, 1, ink[1]);
  c.rect(doorR + 76, ground - 16, 20, 1, metal[2]);
  c.rect(doorR + 84, ground - 8, 8, 8, ink[0]).rect(doorR + 82, ground - 5, 3, 5, ink[0]);

  const word = 'AUTO GARAGE';
  const x = doorR + 12;
  signBoard(c, x, wallTop + 2, blockWidth(word) + 22, 10, ink[1], fire[1]);
  blockText(c, x + 4, wallTop + 3, word, fire[2], fire[0]);
  wrench(s, x + blockWidth(word) + 7, wallTop + 2);

  doorway(s, 28, 'shutter', [metal[0], metal[1], metal[2]], concrete[1]);
  hazard(s, doorL - 5, 28);
  hazard(s, doorR + 2, 28);
  caseLamp(c, doorL + 12, wallTop + 2);
  tyres(s, left + 2);
  // A pool of old oil creeping out of the bay.
  c.rect(doorL + 6, ground - 2, 18, 1, ink[1]);
  streak(c, left + 3, wallTop + 2, [2, 5, 3], ink[1]);
  grime(c, doorR + 6, ground - 3, 4, [3, 5], concrete[0]);
  grime(c, right - 8, ground - 3, 8, [3, 1, 2], concrete[0]);
}

export function buildGarage(): PixelSprite {
  const s = startShell('garage', WALL);
  roof(s);
  front(s);
  return bakeShell(s);
}
