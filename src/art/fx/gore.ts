// Blood and acid bursts. Blood is a hand drawn core plus hand placed droplets that fly
// on an arc: each rises, slows, falls and shrinks. Acid is a gooey blast: a flash, then
// a crown of lumps thrown out of a puddle that seethes and sinks.

import type { Clip } from '../types.ts';
import { makeClip, PixelCanvas } from '../kit.ts';
import type { Legend } from '../kit.ts';
import { RAMPS } from '../palette.ts';
import { cell } from './shared.ts';
import type { Grid } from './shared.ts';

const { acid, blood, bone, rot } = RAMPS;

const BLOOD: Legend = { s: blood[1], t: blood[2], u: blood[3] };
const ACID: Legend = { s: acid[0], t: acid[1], u: acid[2], e: bone[3] };

const BLOOD_W = 48;
const BLOOD_H = 44;
const BLOOD_AX = 24;
const BLOOD_AY = 18;
const BLOOD_FRAMES = 6;
const BLOOD_GRAVITY = 1.1;

const ACID_W = 72;
const ACID_H = 58;
const ACID_AX = 36;
const ACID_AY = 30;
const ACID_GRAVITY = 1.4;

/** Big to small. A droplet steps down this list as it flies and is gone off the end. */
const STAMPS: readonly Grid[] = [
  ['.ut.', 'uuts', 'utts', '.ss.'],
  ['ut.', 'tts', '.s.'],
  ['ut', 'ts'],
  ['u', 's'],
  ['t'],
];

/** Start offset from the core, velocity per frame, and first stamp. */
type Drop = readonly [x: number, y: number, vx: number, vy: number, stamp: number];

// Speeds differ on purpose: a burst that throws everything equally draws a ring.
const BLOOD_DROPS: readonly Drop[] = [
  [-2, -3, -3.6, -3.6, 1], [3, -3, 2.2, -4.6, 0], [-4, 0, -1.6, -2.2, 2], [5, -1, 4, -1.8, 1],
  [-1, -4, -0.6, -5.2, 2], [1, -4, 1, -3, 2], [-3, 2, -3, -0.4, 2], [3, 2, 1.4, -0.6, 2],
  [-5, -2, -4.6, -2.6, 2], [6, -2, 3.2, -3.4, 2],
];

const BLOOD_CORES: readonly Grid[] = [
  [
    '..t.u..',
    '.uuuts.',
    'tuuutts',
    '.uttss.',
    '..s.s..',
  ],
  [
    '.....u..t....',
    '.t...ut.t..t.',
    '..ut.uuttuts.',
    '...uuuuutts..',
    'tuuuuuttttss.',
    '...uutttss...',
    '..ts.tts.ss..',
    '.t...ts..s...',
    '.....s.......',
  ],
  [
    '...t.u.......',
    '.ut..utt..t..',
    '..uttuts.ss..',
    '.t..ts...t...',
    '.ts.ts.utss..',
    '...tts.uts...',
    '.t..s...s..s.',
  ],
];

function flyDrops(canvas: PixelCanvas, drops: readonly Drop[], t: number, ax: number, ay: number, gravity: number, legend: Legend): void {
  for (const [x, y, vx, vy, stamp] of drops) {
    const rows = STAMPS[stamp + Math.floor(t / 3)];
    if (!rows) continue;
    const px = Math.round(ax + x + vx * t - rows[0].length / 2);
    const py = Math.round(ay + y + vy * t + gravity * t * t - rows.length / 2);
    canvas.grid(px, py, rows, legend);
  }
}

function bloodFrame(frame: number): PixelCanvas {
  const canvas = new PixelCanvas(BLOOD_W, BLOOD_H);
  const hasDropsFlying = frame > 0;
  if (hasDropsFlying) flyDrops(canvas, BLOOD_DROPS, frame - 1, BLOOD_AX, BLOOD_AY, BLOOD_GRAVITY, BLOOD);
  const core = BLOOD_CORES[frame];
  if (core) canvas.grid(BLOOD_AX - Math.floor(core[0].length / 2), BLOOD_AY - Math.floor(core.length / 2), core, BLOOD);
  return canvas.outline({ color: blood[0] });
}

export function buildBloodBurst(): Clip {
  const frames = Array.from({ length: BLOOD_FRAMES }, (_, i) => bloodFrame(i).toSprite(BLOOD_W, BLOOD_H, BLOOD_AX, BLOOD_AY));
  return makeClip(frames, 16, false);
}

const ACID_SWELL: Grid = [
  '.....sstts.....',
  '...sttuuutts...',
  '..stuuuuuuuts..',
  '.stuuueeuuuuts.',
  '.tuuueeeeuuuts.',
  'stuuueeeeuuuuts',
  'stuuuueeuuuuuts',
  'stuuuuuuuuuutts',
  '.stuuuuuuuuuts.',
  '.sttuuuuuutts..',
  '..sstttttttss..',
  '....ssssssss...',
];

const ACID_BLAST: Grid = [
  '............t.......u.........',
  '...t.......st......ut.....s...',
  '....ut.....ut.....tu.....ts...',
  '.....uts...uttssstuu...ttt....',
  '......uutttuuuuuuuutttuut.....',
  '...s..ttuuuuuuuuuuuuuuuut.t...',
  '.....tuuuuuueeeeeuuuuuuts.....',
  '..stuuuuuueeeeeeeeeuuuuuttss..',
  'tuuuuuuuueeeeeeeeeeeuuuuuuuttu',
  '.sstuuuuueeeeeeeeeeeeuuuuutss.',
  '....ttuuuueeeeeeeeeeuuuuut....',
  '...s.tuuuuuueeeeeeuuuuuutt.s..',
  '......tuuuuuuuuuuuuuuuutt.....',
  '.....tutttuuuuuuuuutttuuts....',
  '....uts...ttssstussst..tts....',
  '...t.......ut.....ts.....s....',
  '...........st......ts.........',
  '...........t........s.........',
];

/** The blast opening into a crown of tendrils around the puddle it leaves. */
const ACID_CROWN: Grid = [
  '..............t.......u.................',
  '......u.......ut......tu.........t......',
  '.......ut.....ut......ut........ut......',
  '.......utt....utt....utt.......utt......',
  '...s....utt...utts..utts...s..utts...t..',
  '..ut.....uttt.utts.uttts..ut.uttt...ut..',
  '...utt...uttttuttttuttttt.utuuttt..utt..',
  '....uttt..uttttttttttttttuttttts.uttt...',
  '.....uttttttttttsssssttttttttttstttts...',
  '...t..utttttsssssssssssssstttttttts.....',
  '..ut...uttsssssttttttttsssssstttts..t...',
  '.utttttttssstttttuuttttttsssssttttttts..',
  '...ssttttssttuuutttttttuuttsssstttss....',
  '.....uttsssttttttttuutttttsssstts.......',
  '....utttssstttuutttttttttttssstts.......',
  '...utts.sssstttttttttttttssssssttts.....',
  '..ut.....ssssssssttsssssssss...stts.....',
  '.ts....s...sssssssssssss...t.....tt.....',
  '......ts.....ts...ss...tt....s....s.....',
  '.....ts......t....s....t.....ts.........',
];

/** Globs flung off the crown; they fly from the crown frame on. */
const ACID_DROPS: readonly Drop[] = [
  [-14, -8, -4.5, -5, 0], [14, -8, 4.5, -5.5, 0], [-20, 0, -4.5, -2.5, 0], [20, -1, 5, -3, 1],
  [-6, -10, -2, -6, 1], [7, -10, 2.5, -6.5, 0], [-15, 6, -5, -0.5, 1], [15, 7, 5, -0.5, 0],
  [0, -10, 0.3, -7, 2], [-24, 2, -3.5, -3, 2], [24, 2, 3.5, -3.5, 2],
];

interface Puddle {
  readonly rx: number;
  readonly ry: number;
  /** x, y and radius of each. */
  readonly bubbles: readonly (readonly [number, number, number])[];
}

/** The sinking puddle after the crown collapses. */
const ACID_PUDDLES: readonly Puddle[] = [
  { rx: 13, ry: 8, bubbles: [[31, 31, 3], [41, 28, 3], [37, 35, 2]] },
  { rx: 10, ry: 6, bubbles: [[33, 29, 2], [40, 32, 3]] },
  { rx: 6, ry: 4, bubbles: [[37, 30, 2]] },
];

function acidPuddle(index: number): PixelCanvas {
  const canvas = new PixelCanvas(ACID_W, ACID_H);
  const { rx, ry, bubbles } = ACID_PUDDLES[index];
  canvas.ellipse(ACID_AX, ACID_AY + 2, rx, ry, acid[0]);
  canvas.ellipse(ACID_AX - 1, ACID_AY + 1, rx - 2, ry - 2, acid[1]);
  for (const [x, y, r] of bubbles) {
    canvas.ellipseOutline(x, y, r, r * 0.8, acid[2]);
    canvas.px(x - 1, y - 1, bone[3]);
  }
  flyDrops(canvas, ACID_DROPS, index + 1, ACID_AX, ACID_AY, ACID_GRAVITY, ACID);
  return canvas.outline({ color: rot[0] });
}

function acidCrown(): PixelCanvas {
  const canvas = new PixelCanvas(ACID_W, ACID_H);
  flyDrops(canvas, ACID_DROPS, 0, ACID_AX, ACID_AY, ACID_GRAVITY, ACID);
  canvas.grid(ACID_AX - 20, ACID_AY - 10, ACID_CROWN, ACID);
  return canvas.outline({ color: rot[0] });
}

export function buildAcidBurst(): Clip {
  const drawn = [
    cell(ACID_W, ACID_H, ACID_SWELL, ACID, ACID_AX - 7, ACID_AY - 6).outline({ color: rot[0] }),
    cell(ACID_W, ACID_H, ACID_BLAST, ACID, ACID_AX - 15, ACID_AY - 9).outline({ color: rot[0] }),
    acidCrown(),
    ...ACID_PUDDLES.map((_, i) => acidPuddle(i)),
  ];
  return makeClip(drawn.map((canvas) => canvas.toSprite(ACID_W, ACID_H, ACID_AX, ACID_AY)), 12, false);
}
