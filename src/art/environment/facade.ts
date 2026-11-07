// Parts of a front wall: glass, window treatments, brick courses and grime.

import type { PixelCanvas } from '../kit.ts';
import type { Legend } from '../kit.ts';
import { RAMPS } from '../palette.ts';
import type { Color } from '../palette.ts';

const { ink, metal, denim, wood, bone, fire, brick } = RAMPS;

/** Rust weeps from the laps and runs down sheeting, in columns of hand-set length. */
export function rust(canvas: PixelCanvas, x: number, y: number, lengths: readonly number[]): void {
  lengths.forEach((length, i) => {
    const long = length > 6;
    canvas.rect(x + i, y, 1, length, wood[1]);
    if (long) canvas.rect(x + i, y, 1, length - 5, wood[2]);
  });
}

export type WindowKind = 'dark' | 'cracked' | 'boarded' | 'lit' | 'blind';

/** Three tones of the surround: shadowed side, face, lit edge. */
export type Trim = readonly [Color, Color, Color];

const SHATTER: Legend = { x: ink[0], k: ink[1], c: metal[2], b: metal[1] };
const HOLE = [
  'c.....b..',
  '.b...c...',
  '..c.xx..b',
  '...xxxxb.',
  '..xxxxx..',
  'bcxxxxxc.',
  '...xxk...',
  '..c..b...',
  '.b....c..',
];

/** Dark panes with one hard diagonal glint, inside a recess that shades its top and left. */
export function glass(canvas: PixelCanvas, x: number, y: number, w: number, h: number): void {
  canvas.rect(x, y, w, h, denim[0]);
  const put = (i: number, j: number, color: Color) => {
    const isInsideWindow = i >= x && i < x + w && j >= y && j < y + h;
    if (isInsideWindow) canvas.px(i, j, color);
  };
  const start = x + Math.round(w * 0.62);
  for (let j = 0; j < h; j++) {
    put(start - j, y + j, denim[1]);
    put(start - j + 1, y + j, denim[1]);
    put(start - j + 4, y + j, denim[1]);
  }
  canvas.rect(x, y, w, 1, ink[1]).rect(x, y, 1, h, ink[1]);
}

function planks(canvas: PixelCanvas, x: number, y: number, w: number, h: number): void {
  canvas.rect(x, y, w, h, ink[1]);
  const board = (bx: number, by: number, bw: number, tone: number) => {
    canvas.rect(bx, by, bw, 3, wood[tone]);
    canvas.rect(bx, by, bw, 1, wood[tone + 1]);
    canvas.rect(bx, by + 2, bw, 1, wood[tone - 1]);
    canvas.px(bx + 1, by + 1, bone[1]).px(bx + bw - 2, by + 1, bone[1]);
  };
  const rows = Math.max(2, Math.floor(h / 4));
  for (let i = 0; i < rows; i++) {
    const by = y + Math.round(((i + 0.5) * h) / rows) - 1;
    const overhang = i % 2 === 0 ? 1 : 0;
    board(x - overhang, by, w + overhang + (i % 3 === 1 ? 1 : 0), i % 3 === 2 ? 1 : 2);
  }
}

function lit(canvas: PixelCanvas, x: number, y: number, w: number, h: number): void {
  canvas.rect(x, y, w, h, fire[1]);
  canvas.rect(x + 1, y + Math.floor(h / 2), w - 2, Math.ceil(h / 2) - 1, fire[2]);
  // A drawn blind and the shape of a room behind it.
  canvas.rect(x, y, w, Math.floor(h / 3), wood[2]);
  canvas.rect(x, y + Math.floor(h / 3), w, 1, wood[1]);
  canvas.rect(x, y, 1, h, fire[0]);
}

function blind(canvas: PixelCanvas, x: number, y: number, w: number, h: number): void {
  glass(canvas, x, y, w, h);
  const drop = Math.round(h * 0.55);
  for (let j = 0; j < drop; j++) canvas.rect(x, y + j, w, 1, j % 2 === 0 ? bone[0] : metal[1]);
  // One slat hanging loose.
  canvas.line(x + 1, y + drop - 1, x + w - 2, y + drop + 1, bone[0]);
}

/** A window opening with head, jambs and a sill, filled by its kind. */
export function windowUnit(canvas: PixelCanvas, x: number, y: number, w: number, h: number, kind: WindowKind, trim: Trim): void {
  const [dark, face, light] = trim;
  canvas.rect(x - 1, y - 2, w + 2, 2, face).rect(x - 1, y - 2, w + 2, 1, light);
  canvas.rect(x - 1, y, 1, h, light).rect(x + w, y, 1, h, dark);
  if (kind === 'boarded') planks(canvas, x, y, w, h);
  else if (kind === 'lit') lit(canvas, x, y, w, h);
  else if (kind === 'blind') blind(canvas, x, y, w, h);
  else glass(canvas, x, y, w, h);
  const hasMullions = kind !== 'boarded' && w >= 9;
  if (hasMullions) {
    const mid = x + Math.floor(w / 2);
    canvas.rect(mid, y, 1, h, face).rect(x, y + Math.floor(h * 0.45), w, 1, face);
  }
  const isCracked = kind === 'cracked';
  if (isCracked) canvas.grid(x + Math.floor((w - 9) / 2), y + Math.floor((h - 9) / 2), HOLE, SHATTER);
  canvas.rect(x - 2, y + h, w + 4, 1, light).rect(x - 1, y + h + 1, w + 2, 1, dark);
}

const COURSES: Legend = { h: brick[2], m: brick[0] };

// Only a few ragged patches of courses are drawn. A whole wall of them turns to noise.
const BRICK_PATCHES: readonly (readonly string[])[] = [
  [
    '..hhh.hhhh......',
    '..mmmmmmmmmm....',
    'hh.hhhh.hhh.hh..',
    'mmmmmmmmmmmmmm..',
    '...hhh.hhhh.hhh.',
    '....mmmmmmmmm...',
  ],
  [
    '......hhhh.hh...',
    '...mmmmmmmmm....',
    '.hhh.hhh.hhhh...',
    'mmmmmmmmmm......',
    'hhhh.hh.........',
  ],
  [
    '.hhh.hh.',
    '.mmmmmm.',
    'hh.hhh..',
    'mmmmm...',
  ],
];

export function brickPatch(canvas: PixelCanvas, x: number, y: number, pattern: number): void {
  canvas.grid(x, y, BRICK_PATCHES[pattern], COURSES);
}

/** Grime climbing a wall from the ground, a ragged band in one darker tone. */
export function grime(canvas: PixelCanvas, x: number, ground: number, w: number, heights: readonly number[], color: Color): void {
  for (let i = 0; i < w; i++) {
    const height = heights[Math.floor(i / 3) % heights.length];
    canvas.rect(x + i, ground - height, 1, height, color);
  }
}

/** Steel bars across an opening, drawn over whatever fills it. */
export function bars(canvas: PixelCanvas, x: number, y: number, w: number, h: number): void {
  for (let i = x + 1; i < x + w; i += 3) canvas.rect(i, y, 1, h, metal[1]).px(i, y, metal[3]);
  canvas.rect(x, y + Math.floor(h / 2), w, 1, metal[0]).rect(x, y, w, 1, metal[2]).rect(x, y + h - 1, w, 1, metal[0]);
}

/** Rain streaks below a sill or a broken gutter. */
export function streak(canvas: PixelCanvas, x: number, y: number, lengths: readonly number[], color: Color): void {
  lengths.forEach((length, i) => canvas.rect(x + i, y, 1, length, color));
}
