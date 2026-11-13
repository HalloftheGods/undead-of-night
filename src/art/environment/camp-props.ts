// The camp's small things: pup tents, bedrolls, lanterns and the fire. The big tents are buildings (camp-tents.ts).
// Salvage and rope, lit warm by the fire.

import { PROP_DEFS } from '../../../shared/protocol.ts';
import type { Clip, PixelSprite } from '../types.ts';
import { makeClip, PixelCanvas } from '../kit.ts';
import { RAMPS } from '../palette.ts';
import { bake, groundShadow } from './common.ts';

const { ash, bone, denim, fire, ink, metal, wood } = RAMPS;

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
