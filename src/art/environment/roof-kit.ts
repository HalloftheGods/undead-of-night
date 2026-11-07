// Things that sit on roofs. Each draws its own cast shadow to the lower right first.

import type { PixelCanvas } from '../kit.ts';
import type { Legend } from '../kit.ts';
import { RAMPS } from '../palette.ts';
import type { Color } from '../palette.ts';

const { ink, metal, denim, asphalt, concrete, wood } = RAMPS;

const METAL: Legend = {
  k: ink[0], s: ink[1], d: metal[0], m: metal[1], t: metal[2], T: metal[3],
};

const VENT = [
  '...ttT...',
  '.tTTTTTm.',
  'dmmmmmmmd',
  '.kkkkkkk.',
  '...dtm...',
  '...dtm...',
  '...dtm...',
];

const TURBINE = [
  '....ddd....',
  '..dmtttmd..',
  '.dmtTTttmd.',
  '.dmttttmmd.',
  '.ddmmmmddd.',
  '..sdmdmds..',
  '..dmdmdms..',
  '..dmdmdms..',
  '.dmmmmmmmd.',
  '.sssssssss.',
];

const FAN = [
  '..kkkkk..',
  '.kddkddk.',
  'kkddkddkk',
  'kdddmdddk',
  'kkddkddkk',
  '.kddkddk.',
  '..kkkkk..',
];

export function roofVent(canvas: PixelCanvas, x: number, y: number, shadow: Color): void {
  canvas.rect(x + 4, y + 7, 7, 2, shadow);
  canvas.grid(x, y, VENT, METAL);
}

export function turbineVent(canvas: PixelCanvas, x: number, y: number, shadow: Color): void {
  canvas.rect(x + 5, y + 8, 10, 3, shadow);
  canvas.grid(x, y, TURBINE, METAL);
}

/** A condenser box: fan grille on top, louvres on the front. */
export function acUnit(canvas: PixelCanvas, x: number, y: number, w: number, shadow: Color): void {
  const top = 11;
  const front = 8;
  canvas.rect(x + 3, y + top + front - 1, w, 3, shadow).rect(x + w, y + 3, 3, top + front - 2, shadow);
  canvas.rect(x, y, w, top, metal[1]);
  canvas.rect(x, y, w, 1, metal[2]).rect(x, y, 1, top, metal[2]);
  canvas.grid(x + 2, y + 2, FAN, METAL);
  const hasRoomForSecondFan = w > 20;
  if (hasRoomForSecondFan) canvas.grid(x + w - 11, y + 2, FAN, METAL);
  canvas.rect(x, y + top, w, front, metal[0]);
  canvas.rect(x, y + top, w, 1, metal[2]);
  for (let j = 2; j < front - 1; j += 2) canvas.rect(x + 2, y + top + j, w - 4, 1, ink[1]);
  canvas.rect(x + w - 1, y + 1, 1, top + front - 1, metal[0]);
  canvas.rect(x, y + top + front - 1, w, 1, ink[1]);
  // A rust bloom running out of the lower bolt.
  canvas.rect(x + 3, y + top + 3, 1, 3, wood[2]).px(x + 4, y + top + 5, wood[1]);
}

/** A raised hatch with wired glass, the pane at `gone` lost. */
export function skylight(canvas: PixelCanvas, x: number, y: number, w: number, h: number, shadow: Color, gone = 4): void {
  canvas.rect(x + 3, y + h + 1, w, 2, shadow).rect(x + w + 1, y + 3, 2, h, shadow);
  canvas.rect(x - 1, y - 1, w + 2, h + 3, concrete[2]);
  canvas.rect(x - 1, y - 1, w + 2, 1, concrete[3]).rect(x - 1, y - 1, 1, h + 2, concrete[3]);
  canvas.rect(x - 1, y + h + 1, w + 2, 1, concrete[1]);
  canvas.rect(x, y, w, h, denim[0]);
  canvas.rect(x, y, w, 1, ink[1]);
  for (let i = 3; i < w; i += 5) canvas.rect(x + i, y, 1, h, metal[1]);
  canvas.rect(x + 1, y + 2, 2, 2, denim[1]);
  canvas.rect(x + gone, y + 1, 4, h - 1, ink[0]).px(x + gone, y + 1, metal[2]).px(x + gone + 3, y + 3, metal[2]);
}

/** A stair housing: flat lid, a front face and a steel door. */
export function bulkhead(canvas: PixelCanvas, x: number, y: number, w: number, top: number, front: number, shadow: Color): void {
  canvas.rect(x + 3, y + top + front - 1, w, 3, shadow).rect(x + w, y + 3, 3, top + front - 2, shadow);
  canvas.rect(x, y, w, top, concrete[1]);
  canvas.rect(x, y, w, 1, concrete[3]).rect(x, y, 1, top, concrete[3]).rect(x + 1, y + 1, w - 2, 1, concrete[2]);
  canvas.rect(x, y + top, w, front, concrete[0]).rect(x, y + top, w, 1, concrete[2]);
  canvas.rect(x + w - 1, y, 1, top + front, asphalt[2]);
  const door = x + Math.floor(w / 2) - 4;
  canvas.rect(door, y + top + 2, 8, front - 2, metal[0]).rect(door, y + top + 2, 8, 1, metal[1]).px(door + 6, y + top + 6, metal[3]);
}

const TANK_TOP = 14;

/** A timber water tank on steel legs: it stands proud of the roofline. */
export function waterTank(canvas: PixelCanvas, x: number, y: number, shadow: Color): void {
  const w = 28;
  const staves = y + TANK_TOP;
  canvas.rect(x + 6, y + 41, w, 4, shadow);
  for (const leg of [x + 2, x + 13, x + w - 3]) canvas.rect(leg, staves + 16, 2, 12, metal[0]).rect(leg, staves + 16, 1, 12, metal[1]);
  canvas.line(x + 2, y + 42, x + 15, staves + 17, metal[0]).line(x + w - 2, y + 42, x + 14, staves + 17, metal[0]);
  canvas.rect(x, staves, w, 17, wood[1]);
  for (let i = x + 2; i < x + w; i += 3) canvas.rect(i, staves, 1, 17, wood[0]);
  canvas.rect(x, staves, 3, 17, wood[2]).rect(x + w - 2, staves, 2, 17, wood[0]);
  for (const hoop of [staves + 4, staves + 11]) canvas.rect(x, hoop, w, 1, metal[1]);
  canvas.poly([[x - 1, staves], [x + 13, y], [x + 14, y], [x + w, staves]], metal[0]);
  canvas.line(x - 1, staves, x + 13, y, metal[2]).rect(x - 1, staves, w + 2, 1, metal[1]);
  canvas.line(x + 6, staves - 1, x + 13, y + 2, metal[1]);
}

/** A dish on a stub mount, turned towards a sky that no longer answers. */
export function dish(canvas: PixelCanvas, x: number, y: number, shadow: Color): void {
  canvas.rect(x + 3, y + 10, 9, 2, shadow);
  canvas.grid(x, y, [
    '...TTTt...',
    '.TTTttmm..',
    'TTttttmmd.',
    'TtttmmmdD.',
    '.ttmmmdDD.',
    '..mmddDD..',
    '....dm....',
    '....dm....',
    '...dmmd...',
    '...sssss..',
  ], { ...METAL, D: metal[0] });
}

/** A lattice radio mast from the row `foot` up to the row `y`. */
export function radioMast(canvas: PixelCanvas, x: number, y: number, foot: number): void {
  canvas.rect(x, y, 1, foot - y, metal[2]).rect(x + 3, y + 4, 1, foot - y - 4, metal[0]);
  for (let j = y + 4; j < foot - 3; j += 4) canvas.line(x, j, x + 3, j + 3, metal[1]);
  canvas.rect(x - 2, y + 2, 5, 1, metal[2]);
  canvas.px(x, y, RAMPS.blood[3]);
}

/** A hand-laid patch of fresher tar: the outline is a list of row spans. */
export function tarPatch(canvas: PixelCanvas, x: number, y: number, spans: readonly (readonly [number, number])[]): void {
  spans.forEach(([from, length], row) => canvas.rect(x + from, y + row, length, 1, asphalt[1]));
}
