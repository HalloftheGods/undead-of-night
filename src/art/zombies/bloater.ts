// The bloater: a walking gut. It waddles side to side on stub legs while the belly lags
// behind and throbs, and its death is a rupture.

import { ZOMBIES } from '../../../shared/constants.ts';
import { dirClips, makeClip } from '../kit.ts';
import type { DrawnDir, PixelCanvas } from '../kit.ts';
import type { PixelSprite, ZombieArt } from '../types.ts';
import { posed, steadyClip } from './body.ts';
import type { BodyPlan, Pose } from './body.ts';
import { flatFrame, stamp } from './rig.ts';
import type { Stamp } from './rig.ts';
import {
  ACID_POOL, BLOATER_FACINGS, BLOATER_HAND, BLOATER_LEGEND, BLOATER_MARKS, DROPS, PUSTULE_SPOTS, PUSTULES, RUPTURE, SACK, SLUMP,
} from './bloater-art.ts';

const PLAN: BodyPlan = {
  cell: 44,
  ox: 22,
  oy: 37,
  legend: BLOATER_LEGEND,
  hipWidth: 6,
  hipHeight: 5,
  shoulderWidth: 9,
  shoulderHeight: 15,
  neckHeight: 5,
  thigh: 3,
  shin: 3,
  upperArm: 4,
  foreArm: 4,
  legs: [
    { upper: ['eddcb'], lower: ['ddccb'] },
    { upper: ['eddcb'], lower: ['ddccb'] },
  ],
  arms: [
    { upper: ['dcb'], lower: ['dcb'] },
    { upper: ['dcb'], lower: ['dcb'] },
  ],
  hands: [BLOATER_HAND, BLOATER_HAND],
  facings: BLOATER_FACINGS,
  headOnTop: true,
};

/** The row and column swell() grows or shrinks a belly through. */
function swellAt(art: Stamp): { rowAt: number; colAt: number } {
  return { rowAt: Math.floor(art.rows.length * 0.55), colAt: Math.floor(art.rows[0].length * 0.5) };
}

/** Where one belly row or column (a) ends up after swell() inserts d copies of line `at`, or removes -d lines from it. */
function swellAxis(a: number, at: number, d: number): number[] {
  const before = a < at;
  const grows = d >= 0;
  const insertedAt = grows && a === at;
  const removed = !grows && !before && a < at - d;
  if (before) return [a];
  if (insertedAt) return Array.from({ length: d + 1 }, (_, i) => at + i);
  if (removed) return [];
  return [a + d];
}

/** Where a single point (a pustule's corner) lands: the last line its source maps to, or `at` if it was removed. */
function swellPoint(a: number, at: number, d: number): number {
  const lands = swellAxis(a, at, d);
  return lands.length > 0 ? lands[lands.length - 1] : at;
}

/** Grows or shrinks a belly through its plain middle row and column, so its outline stays clean. */
function swell(art: Stamp, dw: number, dh: number): Stamp {
  const { rowAt, colAt } = swellAt(art);
  const rows = [...art.rows];
  const isTaller = dh > 0;
  if (isTaller) rows.splice(rowAt, 0, ...Array<string>(dh).fill(rows[rowAt]));
  const isShorter = dh < 0;
  if (isShorter) rows.splice(rowAt, -dh);
  const wide = rows.map((row) => {
    const isWider = dw > 0;
    if (isWider) return row.slice(0, colAt) + row[colAt].repeat(dw) + row.slice(colAt);
    const isNarrower = dw < 0;
    if (isNarrower) return row.slice(0, colAt) + row.slice(colAt - dw);
    return row;
  });
  return stamp(wide, art.px + Math.ceil(dw / 2), art.py + dh);
}

interface Belly {
  readonly dw: number;
  readonly dh: number;
  /** Pustule ripeness shift for the throb. */
  readonly ripe: number;
}

function drawBloater(dir: DrawnDir, pose: Pose, belly: Belly): PixelSprite {
  const shaped = swell(BLOATER_FACINGS[dir].torso, belly.dw, belly.dh);
  const { figure, torso } = posed(PLAN, dir, { ...pose, morph: () => shaped });
  const left = Math.round(torso.x) - shaped.px;
  const top = Math.round(torso.y) - shaped.py;
  const { rowAt, colAt } = swellAt(BLOATER_FACINGS[dir].torso);
  figure.layer(0.1, (c: PixelCanvas) => {
    // Marks stretch with the skin under them: each pixel goes where swell() puts its row and column.
    for (const [mx, my, rows] of BLOATER_MARKS[dir]) {
      rows.forEach((row, r) => {
        for (let k = 0; k < row.length; k++) {
          const color = BLOATER_LEGEND[row[k]] ?? null;
          const isGap = color === null;
          if (isGap) continue;
          for (const ny of swellAxis(my + r, rowAt, belly.dh)) {
            for (const nx of swellAxis(mx + k, colAt, belly.dw)) c.px(left + nx, top + ny, color);
          }
        }
      });
    }
    // Pustules ride the same mapping, so they stay on the skin they were drawn on.
    for (const [x, y, size] of PUSTULE_SPOTS[dir]) {
      const ripe = Math.max(0, Math.min(PUSTULES.length - 1, size + belly.ripe));
      c.grid(left + swellPoint(x, colAt, belly.dw), top + swellPoint(y, rowAt, belly.dh), PUSTULES[ripe], BLOATER_LEGEND);
    }
  }, false);
  return figure.bake();
}

const WALK: readonly (readonly [Pose, Belly])[] = [
  [{ feet: [[3, -6, 0], [-3, 6, 0]], hands: [[5, -3, -4], [3, 3, -5]], body: [0, -2, -1], lean: 0, head: [0, -1, -1] }, { dw: 2, dh: -2, ripe: 0 }],
  [{ feet: [[1, -6, 0], [-3, 6, 2]], hands: [[4, -3, -5], [4, 3, -5]], body: [0, -2, 0], lean: 0, head: [0, -1, 0] }, { dw: 0, dh: 0, ripe: 0 }],
  [{ feet: [[-1, -6, 0], [1, 6, 2]], hands: [[3, -3, -4], [5, 3, -5]], body: [0, -1, 1], lean: 0, head: [0, 0, 0] }, { dw: -1, dh: 2, ripe: 1 }],
  [{ feet: [[-3, -6, 0], [3, 6, 0]], hands: [[3, -3, -5], [5, 3, -4]], body: [0, 2, -1], lean: 0, head: [0, 1, -1] }, { dw: 2, dh: -2, ripe: 0 }],
  [{ feet: [[-3, -6, 2], [1, 6, 0]], hands: [[4, -3, -5], [4, 3, -5]], body: [0, 2, 0], lean: 0, head: [0, 1, 0] }, { dw: 0, dh: 0, ripe: 0 }],
  [{ feet: [[1, -6, 2], [-1, 6, 0]], hands: [[5, -3, -5], [3, 3, -4]], body: [0, 1, 1], lean: 0, head: [0, 0, 0] }, { dw: -1, dh: 2, ripe: 1 }],
];

const ATTACK: readonly (readonly [Pose, Belly])[] = [
  [{ feet: [[1, -6, 0], [-1, 6, 0]], hands: [[-2, -3, -2], [-2, 3, -2]], body: [-2, 0, 0], lean: -1, head: [-1, 0, 1] }, { dw: 0, dh: 1, ripe: 0 }],
  [{ feet: [[1, -6, 0], [-1, 6, 0]], hands: [[-3, -3, 3], [-3, 3, 3]], body: [-3, 0, 1], lean: -2, head: [-1, 0, 2] }, { dw: -1, dh: 2, ripe: 1 }],
  [{ feet: [[3, -6, 0], [0, 6, 0]], hands: [[7, -2, 0], [7, 2, 0]], body: [4, 0, -1], lean: 2, head: [1, 0, -1] }, { dw: 2, dh: -2, ripe: 1 }],
  [{ feet: [[3, -6, 0], [0, 6, 0]], hands: [[6, -3, -5], [6, 3, -5]], body: [3, 0, -1], lean: 1, head: [1, 0, 0] }, { dw: 1, dh: -1, ripe: 0 }],
];

const STAND: Pose = { feet: [[0, -6, 0], [0, 6, 0]], hands: [[0, -3, -4], [0, 3, -4]], body: [0, 0, 0], lean: 0, head: [0, 0, 0] };
const SHUDDER: Pose = { ...STAND, hands: [[1, -5, 1], [1, 5, 1]], head: [0, 0, 1] };

type Grids = readonly (readonly [number, number, readonly string[]])[];

/** Parts are outlined with the figure; decals (drops, the pool) are painted flat after, only into empty pixels. */
function aftermath(parts: Grids, decals: Grids = []): PixelSprite {
  const shift = (list: Grids): Grids => list.map(([x, y, rows]) => [x + 2, y, rows]);
  return flatFrame(PLAN.cell, PLAN.ox, PLAN.oy, BLOATER_LEGEND, shift(parts), shift(decals));
}

/** Swells past what skin can hold, splits, and leaves a sack in a pool. */
function rupture(): PixelSprite[] {
  const [small, wide] = ACID_POOL;
  const burst = posed(PLAN, 2, { ...SHUDDER, morph: (art) => swell(art, 4, 3) }).figure;
  burst.layer(1, (c: PixelCanvas) => c.grid(7, 8, RUPTURE, BLOATER_LEGEND), false);
  return [
    drawBloater(2, STAND, { dw: 2, dh: 2, ripe: 1 }),
    drawBloater(2, SHUDDER, { dw: 4, dh: 3, ripe: 2 }),
    burst.bake(),
    aftermath([[9, 21, SLUMP]], DROPS),
    aftermath([[5, 23, SACK]]),
    aftermath([[5, 23, SACK]], [[5, 30, small]]),
    aftermath([[5, 23, SACK]], [[3, 30, wide]]),
  ];
}

export function buildBloater(): ZombieArt {
  return {
    walk: dirClips((dir) => makeClip(steadyClip(PLAN, dir, WALK.map(([pose]) => pose)).map((pose, i) => drawBloater(dir, pose, WALK[i][1])), 7)),
    attack: dirClips((dir) => makeClip(ATTACK.map(([pose, belly]) => drawBloater(dir, pose, belly)), 3 / ZOMBIES.bloater.windupSec, false)),
    death: makeClip(rupture(), 9, false),
  };
}
