// The camp's scrap fence: corrugated sheet, a pallet and a run of salvaged chain-link per section, wired to scaffold posts.
// Sections sit end to end like a town fence's. The mesh and the gaps between boards are see-through, as the sim treats them.

import { PROP_DEFS } from '../../../shared/protocol.ts';
import type { PixelSprite } from '../types.ts';
import { PixelCanvas } from '../kit.ts';
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

export function buildCampFenceV(): PixelSprite {
  const { w, h } = PROP_DEFS.camp_fence_v;
  const ground = RISE + h;
  const c = new PixelCanvas(w, ground + 1);
  const mid = Math.floor(w / 2);
  const foot = ground - 1;
  // Edge-on, the section is a strip: tin for the north half of the run, boards and mesh for the rest.
  c.rect(mid - 1, 0, 2, Math.floor(foot / 2), metal[1]).rect(mid - 1, 0, 1, Math.floor(foot / 2), metal[2]);
  for (let y = Math.floor(foot / 2); y < foot; y += 3) c.px(mid - 1, y, wood[2]).px(mid, y, wood[1]);
  const top = foot - RISE + 1;
  c.rect(mid - 2, top, 3, RISE, ash[1]).rect(mid - 2, top, 1, RISE, ash[2]);
  c.rect(mid - 3, top, 5, 1, metal[2]).rect(mid - 2, foot, 4, 1, ink[1]);
  return bake(c, 0, w, ground);
}

/** A pipe-framed gate on the east fence, seen edge-on: two leaves chained at the middle. */
export function buildCampGate(): PixelSprite {
  const { w, h } = PROP_DEFS.camp_gate;
  const ground = RISE + h;
  const c = new PixelCanvas(w, ground + 1);
  const mid = Math.floor(w / 2);
  const foot = ground - 1;
  for (let y = 0; y < foot; y += 2) c.px(mid - 1, y, metal[1]).px(mid, y, metal[0]);
  c.rect(mid - 2, 0, 1, foot, metal[3]).rect(mid + 1, 0, 1, foot, metal[0]);
  for (const postY of [foot - RISE + 1, Math.floor(foot / 2) - Math.floor(RISE / 2)]) {
    c.rect(mid - 2, postY, 3, RISE, ash[1]).rect(mid - 2, postY, 1, RISE, ash[2]).rect(mid - 3, postY, 5, 1, metal[3]);
  }
  c.rect(mid - 2, Math.floor(foot / 2) + 6, 4, 2, fire[1]);
  c.rect(mid - 2, foot, 4, 1, ink[1]);
  return bake(c, 0, w, ground);
}

export function buildCampPost(): PixelSprite {
  const { w, h } = PROP_DEFS.camp_post;
  const ground = RISE + h + 2;
  const c = new PixelCanvas(w, ground + 1);
  const foot = ground - 1;
  const top = foot - RISE - 2;
  c.rect(1, top, 4, foot - top, ash[1]).rect(1, top, 1, foot - top, ash[2]).rect(4, top, 1, foot - top, ash[0]);
  c.rect(0, top, 6, 1, metal[3]).rect(1, foot, 5, 1, ink[1]);
  return bake(c, 0, w, ground);
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
