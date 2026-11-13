// The camp's scrap fence: corrugated sheet, a pallet and a run of salvaged chain-link per section, wired to scaffold posts.
// Sections sit end to end like a town fence's. The mesh and the gaps between boards are see-through, as the sim treats them.

import { PROP_DEFS } from '../../../shared/protocol.ts';
import type { Clip, PixelSprite } from '../types.ts';
import { makeClip, PixelCanvas, seeded, spriteToCanvas } from '../kit.ts';
import { RAMPS } from '../palette.ts';
import { bake } from './common.ts';

const { ink, metal, wood, ash, fire } = RAMPS;

const RISE = 22;
const SHEET_W = 12;
const PALLET_W = 9;

/** Vertical ribs of a tin sheet, lit on every third column, with a rust bloom low down. */
function sheet(c: PixelCanvas, x: number, top: number, w: number, h: number): void {
  for (let col = 0; col < w; col++) c.rect(x + col, top, 1, h, col % 3 === 0 ? metal[2] : metal[1]);
  c.rect(x, top, w, 1, metal[3]).rect(x, top + h - 1, w, 1, ink[1]);
  c.px(x + 2, top + h - 3, fire[0]).px(x + 3, top + h - 2, fire[0]).px(x + w - 3, top + 4, fire[0]);
}

/** Boards with a gap between each, on two rails. */
function pallet(c: PixelCanvas, x: number, top: number, w: number, h: number): void {
  for (let col = 0; col < w; col += 3) c.rect(x + col, top, 2, h, wood[2]).rect(x + col, top, 1, h, wood[3]);
  c.rect(x, top + 3, w, 2, wood[1]).rect(x, top + h - 5, w, 2, wood[1]);
}

/** Diamonds with real holes in them. */
function mesh(c: PixelCanvas, x: number, top: number, w: number, h: number): void {
  for (let row = 0; row < h; row++) {
    for (let col = 0; col < w; col++) {
      const onDiamond = (col + row) % 5 === 0 || (col - row + 50) % 5 === 0;
      if (onDiamond) c.px(x + col, top + row, metal[1]);
    }
  }
  c.rect(x, top, w, 1, metal[2]);
}

export function buildCampFenceH(): PixelSprite {
  const { w, h } = PROP_DEFS.camp_fence_h;
  const ground = RISE + h;
  const c = new PixelCanvas(w, ground + 1);
  const foot = ground - Math.floor(h / 2);
  const top = foot - RISE + 2;
  const tall = foot - top;
  c.rect(0, foot, w, 1, ink[1]);
  sheet(c, 2, top + 2, SHEET_W, tall - 2);
  pallet(c, 2 + SHEET_W + 1, top + 5, PALLET_W, tall - 5);
  mesh(c, 2 + SHEET_W + PALLET_W + 2, top + 1, w - (2 + SHEET_W + PALLET_W + 2), tall - 1);
  // The scaffold post that carries the section, and one strand of wire along the top.
  c.rect(0, top - 2, 2, tall + 3, ash[1]).rect(0, top - 2, 1, tall + 3, ash[2]);
  c.rect(0, top, w, 1, metal[0]);
  for (let x = 5; x < w; x += 9) c.px(x, top - 1, metal[2]);
  return bake(c, 0, w, ground);
}

/** Edge-on runs are drawn wider than their footprint, so the panel's top reads as a rail and not a hairline. */
const EDGE_W = 8;
const EDGE_PAD = (EDGE_W - 6) / 2;

/** A post seen from the south: its cap, and its full height as a face where the run ends. */
function edgePost(c: PixelCanvas, y: number, tall: number): void {
  c.rect(1, y - tall, EDGE_W - 2, tall, ash[1]).rect(1, y - tall, 1, tall, ash[2]).rect(EDGE_W - 2, y - tall, 1, tall, ash[0]);
  c.rect(0, y - tall - 1, EDGE_W, 2, metal[3]).rect(0, y - tall, EDGE_W, 1, metal[2]);
}

type EdgeKind = 'tin' | 'pallet' | 'mesh';

/** One row of each material, seen edge-on: tin ribs, pallet slats with their gaps, and mesh zigzagging. */
const EDGE_ROW: Record<EdgeKind, (c: PixelCanvas, y: number) => void> = {
  tin: (c, y) => c.rect(2, y, 4, 1, y % 2 === 0 ? metal[2] : metal[1]),
  pallet: (c, y) => c.rect(2, y, 4, 1, y % 3 === 0 ? wood[0] : wood[2]),
  mesh: (c, y) => c.px(3 + (y % 2), y, metal[1]),
};

/** One stretch of an edge-on run from `y0` to `y1`, lit on the west lip and shaded on the east. Tin carries a little rust. */
function edgeRun(c: PixelCanvas, y0: number, y1: number, kind: EdgeKind): void {
  for (let y = y0; y < y1; y++) EDGE_ROW[kind](c, y);
  c.rect(2, y0, 1, y1 - y0, kind === 'mesh' ? metal[2] : metal[3]);
  c.rect(6, y0, 1, y1 - y0, ink[1]);
  const isTin = kind === 'tin';
  if (isTin) c.px(4, y0 + 3, fire[0]).px(3, y1 - 3, fire[0]);
}

export function buildCampFenceV(): PixelSprite {
  const { h } = PROP_DEFS.camp_fence_v;
  const ground = RISE + h;
  const c = new PixelCanvas(EDGE_W, ground + 1);
  const foot = ground - 1;
  // The run's top, from its north end raised by the fence's height to its south end at the ground.
  const north = foot - h - RISE + 2;
  edgeRun(c, north, north + 14, 'tin');
  edgeRun(c, north + 14, north + 26, 'pallet');
  edgeRun(c, north + 26, foot - RISE + 6, 'mesh');
  for (let y = north; y < foot - RISE + 6; y += 5) c.px(1, y, metal[0]);
  edgePost(c, north + 2, 2);
  edgePost(c, foot, RISE);
  c.rect(1, foot, EDGE_W - 2, 1, ink[1]);
  return bake(c, EDGE_PAD, PROP_DEFS.camp_fence_v.w, ground);
}

/** The gate seen edge-on: two pipe-framed mesh leaves chained shut in the middle, a heavy post at each end. */
export function buildCampGate(): PixelSprite {
  const { h } = PROP_DEFS.camp_gate;
  const ground = RISE + h;
  const c = new PixelCanvas(EDGE_W, ground + 1);
  const foot = ground - 1;
  const north = foot - h - RISE + 2;
  const middle = Math.floor((north + foot - RISE) / 2);
  for (const [y0, y1] of [[north, middle - 1], [middle + 2, foot - RISE + 4]] as const) {
    edgeRun(c, y0, y1, 'mesh');
    c.rect(2, y0, 4, 1, metal[3]).rect(2, y1 - 1, 4, 1, metal[1]);
  }
  // Chain wrapped twice round both leaves, and the padlock hanging off it.
  c.rect(1, middle - 2, EDGE_W - 2, 5, ink[1]);
  for (let y = middle - 2; y < middle + 3; y += 2) c.rect(1, y, EDGE_W - 2, 1, metal[3]);
  c.rect(2, middle + 3, 4, 3, fire[1]).rect(3, middle + 3, 2, 1, fire[2]);
  edgePost(c, north + 3, 3);
  edgePost(c, middle + 12, 6);
  edgePost(c, foot, RISE + 2);
  c.rect(1, foot, EDGE_W - 2, 1, ink[1]);
  return bake(c, EDGE_PAD, PROP_DEFS.camp_gate.w, ground);
}

export function buildCampPost(): PixelSprite {
  const { h } = PROP_DEFS.camp_post;
  const ground = RISE + h;
  const c = new PixelCanvas(EDGE_W, ground + 1);
  const foot = ground - 1;
  edgeRun(c, foot - h - RISE + 4, foot - RISE + 4, 'pallet');
  edgePost(c, foot, RISE);
  c.rect(1, foot, EDGE_W - 2, 1, ink[1]);
  return bake(c, EDGE_PAD, PROP_DEFS.camp_post.w, ground);
}

const RATTLE_PAD = 2;
/** How far the top of a section swings on each frame, in pixels: a shove one way, back, a harder shove, back. */
const RATTLE_LEANS = [-1, 1, -2, 0];

/** The section sheared over by `by` pixels at its top, foot planted, with sparks off the wire and dust kicked from its foot. */
function leanFrame(base: PixelSprite, by: number, rng: () => number): PixelSprite {
  const src = spriteToCanvas(base);
  const c = new PixelCanvas(src.w + RATTLE_PAD * 2, src.h);
  for (let y = 0; y < src.h; y++) {
    const up = base.ay - y;
    const shift = up > 0 ? Math.round((by * up) / base.ay) : 0;
    for (let x = 0; x < src.w; x++) {
      const color = src.get(x, y);
      const isInked = color !== null;
      if (isInked) c.px(x + RATTLE_PAD + shift, y, color);
    }
  }
  const top = Math.max(1, base.ay - RISE - 2);
  for (let i = 0; i < 3; i++) {
    const sx = RATTLE_PAD + Math.floor(rng() * src.w);
    c.px(sx, top + Math.floor(rng() * 4), i === 0 ? fire[3] : fire[2]);
  }
  for (const side of [0, c.w - 2]) c.px(side + Math.floor(rng() * 2), base.ay - 1, ash[1]).px(side + 1, base.ay - 2 - Math.floor(rng() * 2), ash[2]);
  return c.toSprite(c.w, c.h, base.ax + RATTLE_PAD, base.ay);
}

/** A section about to give: it rocks on its posts while the horde leans on the far side. */
export function buildFenceRattle(base: PixelSprite, seed: number): Clip {
  const rng = seeded(seed);
  return makeClip(RATTLE_LEANS.map((by) => leanFrame(base, by, rng)), 10);
}

/** A section on its face in the dirt: the sheet buckled, the pallet split, the mesh torn off its post. */
export function buildCampFenceDownH(): PixelSprite {
  const { w } = PROP_DEFS.camp_fence_down_h;
  const deep = 10;
  const c = new PixelCanvas(w, deep + 1);
  c.rect(1, 2, SHEET_W + 2, deep - 3, metal[1]).rect(1, 2, SHEET_W + 2, 1, metal[2]);
  for (let x = 2; x < SHEET_W + 2; x += 3) c.rect(x, 3, 1, deep - 5, metal[0]);
  for (let x = SHEET_W + 5; x < SHEET_W + 5 + PALLET_W; x += 3) c.rect(x, 3, 2, deep - 4, wood[1]);
  for (let x = SHEET_W + PALLET_W + 6; x < w - 1; x += 2) c.px(x, 4 + (x % 3), metal[1]).px(x, 7 - (x % 2), metal[0]);
  c.rect(0, deep - 1, 3, 1, ash[1]);
  return bake(c, 0, w, deep);
}

export function buildCampFenceDownV(): PixelSprite {
  const long = PROP_DEFS.camp_fence_v.h;
  const wide = 12;
  const c = new PixelCanvas(wide, long + 1);
  c.rect(2, 1, wide - 4, Math.floor(long / 2), metal[1]).rect(2, 1, 1, Math.floor(long / 2), metal[2]);
  for (let y = 3; y < Math.floor(long / 2); y += 3) c.rect(3, y, wide - 6, 1, metal[0]);
  for (let y = Math.floor(long / 2) + 2; y < long - 2; y += 3) c.rect(1, y, wide - 3, 2, wood[1]);
  c.rect(wide - 3, long - 3, 3, 1, ash[1]);
  return bake(c, Math.floor((wide - PROP_DEFS.camp_fence_down_v.w) / 2), PROP_DEFS.camp_fence_down_v.w, long);
}
