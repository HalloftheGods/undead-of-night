// Street furniture, from hand grids where the shape matters and rects where it is a box.

import type { Clip, PixelSprite } from '../types.ts';
import { makeClip, mirrorSprite, PixelCanvas } from '../kit.ts';
import type { Legend } from '../kit.ts';
import { RAMPS } from '../palette.ts';
import { bake, groundShadow } from './common.ts';
import { carryGlow, carryMirroredGlow, markGlow } from '../glow.ts';

const { ink, metal, wood, bone, fire, brick, blood, olive, concrete, asphalt, ash, grass } = RAMPS;

export function buildDumpster(): PixelSprite {
  const footW = 30;
  const c = new PixelCanvas(footW + 2, 31);
  const ground = 27;
  const left = 1;
  const top = 3;
  const lidDepth = 9;
  const body = top + lidDepth;
  groundShadow(c, left + 1, ground - 1, footW - 1, 3);

  // Bin body: sloped back wall on top, ribbed front below.
  c.rect(left, top, footW, ground - top - 2, grass[1]);
  c.rect(left, body, footW, 1, olive[1]);
  for (const x of [left + 6, left + 14, left + 22]) c.rect(x, body + 1, 2, 11, grass[0]).rect(x, body + 1, 1, 11, grass[2]);
  c.rect(left, ground - 5, footW, 2, grass[0]);
  c.rect(left, body + 1, 1, 12, olive[1]).rect(left + footW - 1, body, 1, 13, grass[0]);
  // Rust and a stencilled block.
  c.rect(left + 3, ground - 6, 2, 3, wood[1]).rect(left + 10, ground - 8, 3, 5, wood[1]).rect(left + 11, ground - 9, 1, 2, wood[2]);
  c.rect(left + 25, ground - 7, 3, 4, wood[1]);
  c.rect(left + 9, body + 3, 4, 4, bone[0]).rect(left + 10, body + 4, 2, 2, grass[1]);
  // Casters.
  c.rect(left + 3, ground - 3, 5, 3, ink[0]).rect(left + 22, ground - 3, 5, 3, ink[0]);
  c.rect(left + 4, ground - 2, 3, 1, metal[1]).rect(left + 23, ground - 2, 3, 1, metal[1]);

  // Near lid shut, far lid thrown back over a heap of bags.
  c.rect(left + 1, top + 1, 13, lidDepth - 1, concrete[0]);
  c.rect(left + 1, top + 1, 13, 1, concrete[1]).rect(left + 1, top + 1, 1, lidDepth - 1, concrete[1]);
  c.rect(left + 4, top + 4, 7, 1, asphalt[2]);
  c.rect(left + 15, top + 1, 14, lidDepth - 1, ink[0]);
  c.grid(left + 15, top - 1, [
    '...aaa.......',
    '..aAAaa..bbb.',
    '.aAAAaaabBBbb',
    '.aAAaaabBBBbb',
    'aaaaaddbBBbbd',
    'dddddddbbbddd',
    '.ddk.ddddd...',
    '.....k.......',
  ], { a: ash[1], A: ash[2], b: metal[1], B: metal[2], d: ash[0], k: ink[1] });
  c.rect(left + 14, top - 2, 16, 2, concrete[1]).rect(left + 14, top - 2, 16, 1, concrete[2]);
  c.rect(left, body - 1, footW, 1, grass[0]);
  c.outline({ selective: true });
  return bake(c, left, footW, ground);
}

export function buildBarrier(): PixelSprite {
  const footW = 32;
  const c = new PixelCanvas(footW + 2, 24);
  const ground = 20;
  const left = 1;
  groundShadow(c, left + 1, ground - 1, footW, 3);
  // The Jersey profile, row by row: narrow top, steep face, flared foot.
  const rows: readonly (readonly [number, number])[] = [
    [2, concrete[3]], [1, concrete[3]], [1, concrete[2]], [1, concrete[3]], [1, concrete[2]], [1, concrete[2]], [1, concrete[2]],
    [1, concrete[2]], [1, concrete[1]], [1, concrete[1]], [0, concrete[1]], [0, concrete[1]], [0, concrete[0]], [0, concrete[0]],
  ];
  rows.forEach(([inset, color], i) => c.rect(left + inset, ground - rows.length + i, footW - inset * 2, 1, color));
  const top = ground - rows.length;
  // A form joint and the lifting slots.
  c.rect(left + 15, top + 3, 1, 11, concrete[1]);
  c.rect(left + 6, ground - 3, 4, 2, ink[1]).rect(left + 22, ground - 3, 4, 2, ink[1]);
  // Worn hazard bars, skewed to follow the face.
  for (const x of [4, 10, 19, 25]) {
    c.line(left + x, top + 8, left + x + 3, top + 3, fire[0]).line(left + x + 1, top + 8, left + x + 4, top + 3, fire[0]);
    c.line(left + x + 2, top + 8, left + x + 5, top + 3, wood[1]);
  }
  // A corner knocked off to the rebar.
  c.rect(left + 27, top, 5, 3, ink[0]).rect(left + 28, top + 3, 4, 1, ink[0]);
  c.erase(left + 31, top).erase(left + 30, top).erase(left + 29, top).erase(left + 31, top + 1).erase(left + 31, top + 2);
  c.line(left + 28, top + 3, left + 31, top - 1, wood[2]);
  c.rect(left + 26, top + 3, 2, 1, concrete[0]);
  c.outline({ selective: true });
  return bake(c, left, footW, ground);
}

const BAG: Legend = { a: olive[2], b: olive[1], c: olive[0], d: ink[1], h: bone[1] };

const SANDBAG = [
  '..abbbbbb.',
  '.ahhaabbbc',
  'aahaaabbbc',
  'aaaaabbbcc',
  'bbbbbbcccd',
  '.ccccccdd.',
];

export function buildSandbags(): PixelSprite {
  const footW = 36;
  const c = new PixelCanvas(footW + 2, 25);
  const ground = 21;
  const left = 1;
  groundShadow(c, left + 1, ground - 1, footW, 3);
  const rows: readonly (readonly [number, readonly number[]])[] = [
    [ground - 16, [10, 19]],
    [ground - 11, [5, 14, 23]],
    [ground - 6, [0, 9, 18, 27]],
  ];
  for (const [y, xs] of rows) for (const x of xs) c.grid(left + x, y, SANDBAG, BAG);
  // One split bag, spilling onto the ground.
  c.rect(left + 30, ground - 10, 5, 1, olive[1]).rect(left + 32, ground - 9, 4, 1, olive[2]);
  c.outline({ selective: true });
  return bake(c, left, footW, ground);
}

const HYDRANT = [
  '...hh...',
  '..hRRr..',
  '.bbbbbb.',
  '..RRRr..',
  'hmRRRrmk',
  'RRRhRrrr',
  'hmRRRrmk',
  '..RRRr..',
  '..RRrr..',
  '..RRrr..',
  '.bbbbbb.',
  '.dddddd.',
];

export function buildHydrant(): PixelSprite {
  const c = new PixelCanvas(10, 16);
  const ground = 13;
  groundShadow(c, 2, ground - 1, 7, 2);
  c.grid(1, 1, HYDRANT, { h: blood[3], R: blood[2], r: blood[1], b: bone[1], d: bone[0], m: metal[2], k: metal[1] });
  c.outline({ selective: true });
  return bake(c, 2, 6, ground);
}

export function buildStreetLamp(): PixelSprite {
  const c = new PixelCanvas(34, 74);
  const ground = 70;
  const pole = 7;
  groundShadow(c, pole - 3, ground - 1, 9, 2);
  // Base casing, then the pole in three tones.
  c.rect(pole - 2, ground - 7, 7, 7, metal[0]).rect(pole - 2, ground - 7, 2, 7, metal[1]);
  c.rect(pole - 2, ground - 7, 7, 1, metal[2]);
  c.rect(pole - 1, ground - 4, 4, 2, ink[1]);
  c.rect(pole, 8, 3, ground - 14, metal[1]).rect(pole, 8, 1, ground - 14, metal[2]).rect(pole + 2, 8, 1, ground - 14, metal[0]);
  c.rect(pole, ground - 34, 3, 1, metal[0]);
  // Faded notices tied to the pole.
  c.rect(pole - 1, ground - 26, 5, 7, bone[0]).rect(pole - 1, ground - 26, 5, 1, bone[1]);
  c.rect(pole, ground - 24, 3, 1, ash[0]).rect(pole, ground - 22, 3, 1, ash[0]);
  c.grid(pole, 2, [
    '...MMMMMMMMMMM...........',
    '.MMMmmmmmmmmmMMM.........',
    'MMmmdddddddddmmMMMMMMMM..',
    'Mmm...........ddmmmmmmmMM',
    'mmd.............dddddddMM',
    'mmd..............iiiiii..',
    'mmd..............ffffff..',
  ], { M: metal[2], m: metal[1], d: metal[0], i: ink[1], f: fire[2] });
  // The lit head: a glowing lens with a warm halo spilling under it.
  c.rect(pole + 17, 9, 6, 1, fire[2]);
  c.rect(pole + 16, 10, 8, 1, fire[1]);
  for (let x = pole + 17; x < pole + 23; x++) {
    markGlow(c, x, 8, fire[2], fire[1]);
    markGlow(c, x, 9, fire[2], fire[1]);
  }
  c.outline({ selective: true });
  return carryGlow(c, c.toSprite(c.w, c.h, pole + 1, ground));
}

/** The same lamp turned to face the other way, its head reaching back over the street. */
export function buildStreetLampMirrored(): PixelSprite {
  const lamp = buildStreetLamp();
  return carryMirroredGlow(lamp, { ...mirrorSprite(lamp), ax: lamp.w - 1 - lamp.ax });
}

/** A lamp with its head straight over the pole, for the streets that run across the view. */
export function buildStreetLampCentred(): PixelSprite {
  const c = new PixelCanvas(34, 74);
  const ground = 70;
  const pole = 7;
  groundShadow(c, pole - 3, ground - 1, 9, 2);
  c.rect(pole - 2, ground - 7, 7, 7, metal[0]).rect(pole - 2, ground - 7, 2, 7, metal[1]);
  c.rect(pole - 2, ground - 7, 7, 1, metal[2]);
  c.rect(pole - 1, ground - 4, 4, 2, ink[1]);
  c.rect(pole, 8, 3, ground - 14, metal[1]).rect(pole, 8, 1, ground - 14, metal[2]).rect(pole + 2, 8, 1, ground - 14, metal[0]);
  // The head sits over the pole, its lit glass turned down onto the street.
  c.rect(pole - 3, 2, 9, 1, metal[2]).rect(pole - 4, 3, 11, 2, metal[1]).rect(pole - 4, 5, 11, 1, metal[0]);
  c.rect(pole - 2, 6, 7, 1, ink[1]);
  c.rect(pole - 2, 7, 7, 1, fire[2]);
  c.rect(pole - 3, 8, 9, 1, fire[2]);
  c.rect(pole - 4, 9, 11, 1, fire[1]);
  for (let x = pole - 2; x < pole + 5; x++) markGlow(c, x, 7, fire[2], fire[1]);
  for (let x = pole - 3; x < pole + 6; x++) markGlow(c, x, 8, fire[2], fire[1]);
  c.outline({ selective: true });
  return carryGlow(c, c.toSprite(c.w, c.h, pole + 1, ground));
}

/** An intersection signal on a mast arm reaching right over the crossing; its red lamp blinks in the lighting. */
export function buildTrafficSignal(): PixelSprite {
  const c = new PixelCanvas(34, 74);
  const ground = 70;
  const pole = 7;
  groundShadow(c, pole - 3, ground - 1, 9, 2);
  c.rect(pole - 2, ground - 7, 7, 7, metal[0]).rect(pole - 2, ground - 7, 2, 7, metal[1]);
  c.rect(pole - 2, ground - 7, 7, 1, metal[2]);
  c.rect(pole, 8, 3, ground - 14, metal[1]).rect(pole, 8, 1, ground - 14, metal[2]).rect(pole + 2, 8, 1, ground - 14, metal[0]);
  // Mast arm over the road, the signal box hanging from its end with the red lamp on top.
  c.rect(pole + 3, 9, 14, 1, metal[2]).rect(pole + 3, 10, 14, 1, metal[0]);
  c.rect(pole + 14, 11, 6, 11, ink[1]).rect(pole + 14, 11, 6, 1, metal[1]);
  c.rect(pole + 15, 12, 4, 3, blood[3]).rect(pole + 16, 11, 2, 1, blood[2]);
  c.rect(pole + 15, 16, 4, 2, ink[0]).rect(pole + 15, 19, 4, 2, ink[0]);
  for (let y = 12; y < 15; y++) for (let x = pole + 15; x < pole + 19; x++) markGlow(c, x, y, blood[3], blood[2]);
  c.outline({ selective: true });
  return carryGlow(c, c.toSprite(c.w, c.h, pole + 1, ground));
}

/** The signal turned to reach the other way, over a crossing on its left. */
export function buildTrafficSignalMirrored(): PixelSprite {
  const signal = buildTrafficSignal();
  return carryMirroredGlow(signal, { ...mirrorSprite(signal), ax: signal.w - 1 - signal.ax });
}

const BARREL = [
  '...MMMMMMMM...',
  '..MkkkkkkkkM..',
  '.MkeEffffEekm.',
  '.mkeEEEEEEekd.',
  '.WmkkkkkkkkdU.',
  '.WwwuuuuuuuuU.',
  '.WwuuuuuuuuuU.',
  '.MmmmmmmmmmdD.',
  '.WwwuuEuEuuuU.',
  '.WwuuEeuEeuuU.',
  '.WwuuuuuuuuuU.',
  '.MmmmmmmmmmdD.',
  '.WwwuuuuuuuuU.',
  '.WwwuuuuuuuuU.',
  '.WwuuuuuuuuuU.',
  '..wuuuuuuuuU..',
];

export function buildFireBarrel(): PixelSprite {
  const c = new PixelCanvas(14, 19);
  const ground = 16;
  groundShadow(c, 2, ground - 1, 11, 3);
  c.grid(0, 0, BARREL, {
    M: metal[2], m: metal[1], d: metal[0], D: ink[1], k: ink[0],
    W: wood[2], w: brick[2], u: brick[1], U: brick[0], e: fire[1], E: fire[2], f: fire[3],
  });
  c.outline({ selective: true });
  return bake(c, 1, 12, ground);
}

const FLAME_FRAMES: readonly (readonly string[])[] = [
  [
    '.......a......',
    '......aa......',
    '......ab...a..',
    '.....aab...a..',
    '..a..abba..a..',
    '..a.aabbba.a..',
    '..aaabbcbaaa..',
    '..aabbccbbaa..',
    '..abbcccbbaa..',
    '...abcdccbba..',
    '...abcddcbba..',
    '...abcddccba..',
    '....bcdddcb...',
    '....abcdcba...',
  ],
  [
    '......a.......',
    '......a.......',
    '.....aa.......',
    '..a..aba......',
    '..aa.abba.a...',
    '..aa.abba.aa..',
    '..ab.abcbaab..',
    '..abaabcbbab..',
    '..abbbcccbba..',
    '..abbccdccba..',
    '...abcddccba..',
    '...abcddcbba..',
    '....bcdddcb...',
    '....abcdcba...',
  ],
  [
    '........a.....',
    '........a..a..',
    '.......aa..a..',
    '...a...ab..a..',
    '...a..aaba.a..',
    '...aa.abba.a..',
    '..aab.abcbaa..',
    '..abbaabcbba..',
    '..abbbbccbba..',
    '..abcbccdcba..',
    '...abccddcba..',
    '...abcddccba..',
    '....bcdddcb...',
    '....abcdcba...',
  ],
  [
    '.....a........',
    '.....aa.......',
    '.....ab..a....',
    '.a...ab..a....',
    '.a..aab..aa...',
    '.aa.abba.ab...',
    '.aabaabcaab...',
    '..abbabcbbba..',
    '..abbbccbbba..',
    '..abcccdccba..',
    '...abcddcbba..',
    '...abcdddcba..',
    '....bcdddcb...',
    '....abcdcba...',
  ],
];

/** Drawn at the barrel's anchor, so the frame carries the barrel's height as empty rows. */
export function buildBarrelFire(): Clip {
  const barrelTop = 13;
  const flameRows = FLAME_FRAMES[0].length;
  const frames = FLAME_FRAMES.map((rows) => {
    const c = new PixelCanvas(14, flameRows + barrelTop);
    c.grid(0, 0, rows, { a: fire[0], b: fire[1], c: fire[2], d: fire[3] });
    return c.toSprite(c.w, c.h, 7, c.h);
  });
  return makeClip(frames, 10);
}
