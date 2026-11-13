// What the camp is made of besides its fence: a tarp over the market, a lean-to for the workshop, tents, bedrolls, lanterns and the fire.
// Salvage and rope, lit warm by the fire. The awning and lean-to have no footprint: they are drawn behind whoever stands under them.

import { PROP_DEFS } from '../../../shared/protocol.ts';
import type { Clip, PixelSprite } from '../types.ts';
import { makeClip, PixelCanvas } from '../kit.ts';
import { RAMPS } from '../palette.ts';
import { bake, groundShadow } from './common.ts';

const { ash, bone, denim, fire, ink, metal, teal, wood } = RAMPS;

const POLE_RISE = 26;
const TARP_DROP = 9;

/** A sagging tarp between poles: the back edge high, the front edge scalloped between each pair. */
function tarp(c: PixelCanvas, x: number, top: number, w: number, poles: number, cloth: readonly number[]): void {
  const bay = Math.floor((w - 2) / (poles - 1));
  c.rect(x, top, w, TARP_DROP - 2, cloth[1]).rect(x, top, w, 1, cloth[2]);
  for (let col = 0; col < w; col++) {
    const inBay = (col % bay) / bay;
    const sag = Math.round(Math.sin(inBay * Math.PI) * 2);
    c.rect(x + col, top + TARP_DROP - 2, 1, 1 + sag, cloth[0]);
  }
  for (let i = 0; i < poles; i++) {
    const px = Math.min(x + w - 2, x + i * bay);
    c.rect(px, top + 1, 2, POLE_RISE, wood[1]).rect(px, top + 1, 1, POLE_RISE, wood[2]);
  }
}

export function buildCampAwning(): PixelSprite {
  const { w } = PROP_DEFS.camp_awning;
  const ground = POLE_RISE + 2;
  const c = new PixelCanvas(w, ground + 1);
  tarp(c, 0, 0, w, 4, teal);
  // A plank table under it, with a crate at one end.
  c.rect(8, ground - 9, w - 30, 2, wood[2]).rect(8, ground - 7, w - 30, 1, wood[0]);
  c.rect(w - 20, ground - 12, 10, 10, wood[1]).rect(w - 20, ground - 12, 10, 1, wood[3]).rect(w - 16, ground - 12, 1, 10, wood[0]);
  return bake(c, 0, w, ground);
}

export function buildCampLeanto(): PixelSprite {
  const { w } = PROP_DEFS.camp_leanto;
  const ground = POLE_RISE + 2;
  const c = new PixelCanvas(w, ground + 1);
  // Corrugated tin on two posts, sloping to the back.
  for (let col = 0; col < w; col++) c.rect(col, col % 3 === 0 ? 0 : 1, 1, 7, col % 3 === 0 ? metal[2] : metal[1]);
  c.rect(0, 7, w, 1, ink[1]);
  for (const px of [1, w - 3]) c.rect(px, 8, 2, POLE_RISE - 6, ash[1]).rect(px, 8, 1, POLE_RISE - 6, ash[2]);
  c.rect(6, ground - 6, 12, 5, metal[0]).rect(6, ground - 6, 12, 1, metal[2]);
  return bake(c, 0, w, ground);
}

/** A ridge tent, door flap to the south. */
export function buildCampTent(): PixelSprite {
  const { w, h } = PROP_DEFS.camp_tent;
  const rise = 16;
  const ground = rise + h + 1;
  const c = new PixelCanvas(w + 4, ground + 4);
  const left = 2;
  groundShadow(c, left + 1, ground - 1, w, 3);
  for (let row = 0; row < rise + h; row++) {
    const half = Math.max(1, Math.round(((row + 1) / (rise + h)) * (w / 2)));
    const mid = left + Math.floor(w / 2);
    c.rect(mid - half, ground - (rise + h) + row, half, 1, denim[1]).rect(mid, ground - (rise + h) + row, half, 1, denim[0]);
  }
  const mid = left + Math.floor(w / 2);
  c.rect(mid - 1, ground - rise - h, 2, 2, wood[2]);
  for (let row = 0; row < h + 4; row++) c.rect(mid - Math.floor(row / 3), ground - 1 - row, 1 + Math.floor(row / 3) * 2 > 5 ? 5 : 1 + Math.floor(row / 3), 1, ink[1]);
  c.px(left, ground - 1, bone[1]).px(left + w - 1, ground - 1, bone[1]);
  return bake(c, left, w, ground);
}

/** A ring of stones round crossed logs on a bed of coals. The flames are their own clip, as the barrel's are. */
const FIRE_PIT = [
  '......sSSSSSSs......',
  '....sSdkkkkkkdSs....',
  '...SdkuwWeEWwukdS...',
  '..SdkwWeEcEeWwukdS..',
  '..SdkuwcEeEcwWukdS..',
  '..sSdkuwWecWwukdSs..',
  '...sSddkkkkkkddSs...',
  '.....ssSSSSSSss.....',
];
const PIT_W = FIRE_PIT[0].length;
/** Rows of the pit below the coals the flames stand on. */
const COALS_ABOVE_GROUND = 4;

export function buildCampfire(): PixelSprite {
  const { w } = PROP_DEFS.campfire;
  const ground = FIRE_PIT.length + 1;
  const c = new PixelCanvas(PIT_W + 2, ground + 3);
  groundShadow(c, 3, ground - 1, PIT_W - 3, 2);
  c.grid(1, 1, FIRE_PIT, {
    S: ash[2], s: ash[1], d: ash[0], k: ink[1],
    W: wood[2], w: wood[1], u: wood[0], e: fire[1], E: fire[2], c: fire[0],
  });
  c.outline({ selective: true });
  return bake(c, 1 + (PIT_W - w) / 2, w, ground);
}

/** Wider and lower than the barrel's fire: two tongues, a hot core and a spark that climbs away. Darkest ramp step outermost. */
const CAMPFIRE_FRAMES: readonly (readonly string[])[] = [
  [
    '........a.......',
    '.......aa.......',
    '.......ab....a..',
    '..a...aab.......',
    '..a...abba..a...',
    '..aa.aabba..a...',
    '..ab.abbcba.aa..',
    '.aabaabccbaaba..',
    '.abbabbccbbbba..',
    '.abbbbcdccbbba..',
    '..abbccddccbba..',
    '..abccdddccba...',
    '...abcdddcbba...',
    '...abccdccba....',
    '....abbcbba.....',
    '.....aabaa......',
  ],
  [
    '.......a........',
    '.......a.....a..',
    '......aa........',
    '......ab...a....',
    '..a..aaba..a....',
    '..aa.abba..aa...',
    '..ab.abcba.ab...',
    '.aabaabcbbaaba..',
    '.abbbabccbbbba..',
    '.abbbccdccbbba..',
    '..abbcdddcbbba..',
    '..abccdddccba...',
    '...abcdddcbba...',
    '...abccdccba....',
    '....abbcbba.....',
    '.....aabaa......',
  ],
  [
    '.........a......',
    '.........a......',
    '....a....aa.....',
    '........aba..a..',
    '...a...aabba.a..',
    '...a...abbba.a..',
    '..aaa.aabcbaaa..',
    '.aabbaabccbbba..',
    '.abbbbbbccbbba..',
    '.abbcbccdccbba..',
    '..abbccdddcbba..',
    '..abccdddccba...',
    '...abcdddcbba...',
    '...abccdccba....',
    '....abbcbba.....',
    '.....aabaa......',
  ],
  [
    '......a.........',
    '......aa....a...',
    '......ab........',
    '.a....ab...a....',
    '.a...aab...aa...',
    '.aa..abba..ab...',
    '.aab.abbca.ab...',
    '.aabaabbcbaabb..',
    '.abbbabccbbbba..',
    '.abbcccdccbbba..',
    '..abbcdddccbba..',
    '..abccdddccba...',
    '...abcdddcbba...',
    '...abccdccba....',
    '....abbcbba.....',
    '.....aabaa......',
  ],
];

/** Drawn at the campfire's anchor, so each frame carries the pit's height below the coals as empty rows. */
export function buildCampfireFlames(): Clip {
  const flameW = CAMPFIRE_FRAMES[0][0].length;
  const frames = CAMPFIRE_FRAMES.map((rows) => {
    const c = new PixelCanvas(flameW, rows.length + COALS_ABOVE_GROUND);
    c.grid(0, 0, rows, { a: fire[0], b: fire[1], c: fire[2], d: fire[3] });
    return c.toSprite(c.w, c.h, flameW / 2, c.h);
  });
  return makeClip(frames, 10);
}

export function buildBedroll(): PixelSprite {
  const { w } = PROP_DEFS.bedroll;
  const deep = 7;
  const c = new PixelCanvas(w, deep + 1);
  c.rect(0, 1, w - 4, deep - 2, denim[1]).rect(0, 1, w - 4, 1, denim[2]).rect(0, deep - 1, w - 4, 1, denim[0]);
  c.rect(w - 4, 0, 4, deep, bone[1]).rect(w - 4, 0, 4, 1, bone[2]);
  c.rect(4, 1, 1, deep - 2, ink[1]).rect(9, 1, 1, deep - 2, ink[1]);
  return bake(c, 0, w, deep);
}

/** A storm lantern on a stake. */
export function buildLantern(): PixelSprite {
  const { w, h } = PROP_DEFS.lantern;
  const rise = 14;
  const ground = rise + h;
  const c = new PixelCanvas(w + 2, ground + 1);
  c.rect(2, ground - rise + 4, 1, rise - 4 + h, wood[1]);
  c.rect(1, ground - rise - 1, 4, 5, fire[2]).rect(2, ground - rise, 2, 3, fire[3]);
  c.rect(1, ground - rise - 2, 4, 1, metal[1]).rect(1, ground - rise + 4, 4, 1, metal[0]);
  return bake(c, 1, w, ground);
}
