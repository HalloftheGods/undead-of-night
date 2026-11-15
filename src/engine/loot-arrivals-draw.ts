// How the canvas loot window draws an item's motion (game/inventory/move-motion.ts): the item hops from where it lay
// in the world, or from the cell it was shown in, into its cell, growing to size, with a short trail; then the cell
// flashes and a ring and four sparks burst out from it. A puff is a three-frame dust burst over an emptied cell, and a
// refused cell shakes red.

import type { Motion } from '../game/inventory/move-motion.ts';
import { activePuffs, arrivalCamera, easeOut, hop } from '../game/inventory/move-motion.ts';

interface Box {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** Draws the item's picture in a box (the window's own item drawer). */
export type DrawItemIn = (box: Box) => void;

const FLASH = '#fff6d8';
const SPARK = '#ffd36b';
/** How high the hop rises at its top, in buffer pixels. */
const HOP_PX = 26;
/** How much bigger than its cell the item starts its flight. */
const START_GROW = 0.6;
const TRAIL = 4;
const DUST = '#b9ad8f';
const REFUSED = '#e0463a';

/** Where and how big the item is as it sets off: its world spot a size up, or the cell it left at that cell's size. */
function start(motion: Motion, cell: Box): { x: number; y: number; w: number; h: number; hop: number } | null {
  const origin = motion.from;
  const left = origin && 'cell' in origin ? origin.cell.buffer : undefined;
  if (left) return { x: left.x + left.w / 2, y: left.y + left.h / 2, w: left.w, h: left.h, hop: HOP_PX / 2 };
  const camera = arrivalCamera();
  const world = origin && 'world' in origin ? origin.world : null;
  if (!camera || !world) return null;
  const from = camera.toBuffer(world);
  return { x: from.x, y: from.y, w: cell.w * (1 + START_GROW), h: cell.h * (1 + START_GROW), hop: HOP_PX };
}

/** The flight's box at progress t, or null when there is nowhere to fly from (it then only pops). */
export function flightBox(motion: Motion, cell: Box, t: number): Box | null {
  const from = start(motion, cell);
  if (!from) return null;
  const e = easeOut(t);
  const cx = cell.x + cell.w / 2;
  const cy = cell.y + cell.h / 2;
  const x = from.x + (cx - from.x) * e;
  const y = from.y + (cy - from.y) * e - hop(t) * from.hop;
  const w = Math.max(4, Math.round(from.w + (cell.w - from.w) * e));
  const h = Math.max(4, Math.round(from.h + (cell.h - from.h) * e));
  return { x: Math.round(x - w / 2), y: Math.round(y - h / 2), w, h };
}

/** The item on its way: a fading trail of sparks behind it, then the item itself. */
export function drawFlight(ctx: CanvasRenderingContext2D, motion: Motion, cell: Box, t: number, drawItem: DrawItemIn): boolean {
  const box = flightBox(motion, cell, t);
  if (!box) return false;
  for (let i = 1; i <= TRAIL; i += 1) {
    const back = flightBox(motion, cell, Math.max(0, t - i * 0.05));
    if (!back) continue;
    ctx.globalAlpha = (1 - i / (TRAIL + 1)) * 0.8;
    ctx.fillStyle = SPARK;
    ctx.fillRect(Math.round(back.x + back.w / 2) - 1, Math.round(back.y + back.h / 2) - 1, 2, 2);
  }
  ctx.globalAlpha = 1;
  drawItem(box);
  return true;
}

/** The landing: the cell flashes white and fades, a ring opens out and four sparks fly from its corners. */
export function drawPop(ctx: CanvasRenderingContext2D, cell: Box, t: number): void {
  const fade = 1 - t;
  ctx.globalAlpha = fade * 0.75;
  ctx.fillStyle = FLASH;
  ctx.fillRect(cell.x, cell.y, cell.w, cell.h);
  const grow = Math.round(easeOut(t) * 6);
  ctx.globalAlpha = fade;
  ctx.fillStyle = SPARK;
  const x0 = cell.x - grow;
  const y0 = cell.y - grow;
  const w = cell.w + grow * 2;
  const h = cell.h + grow * 2;
  ctx.fillRect(x0, y0, w, 1);
  ctx.fillRect(x0, y0 + h - 1, w, 1);
  ctx.fillRect(x0, y0, 1, h);
  ctx.fillRect(x0 + w - 1, y0, 1, h);
  const out = Math.round(easeOut(t) * 10);
  for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    const sx = dx < 0 ? cell.x - out : cell.x + cell.w + out - 2;
    const sy = dy < 0 ? cell.y - out : cell.y + cell.h + out - 2;
    ctx.fillRect(sx, sy, 2, 2);
  }
  ctx.globalAlpha = 1;
}

/** Every puff in the air: three frames of dust spreading over the cell the item was taken from, fading as it goes. */
export function drawPuffs(ctx: CanvasRenderingContext2D): void {
  for (const { origin, t } of activePuffs()) {
    const cell = origin.buffer;
    if (!cell) continue;
    const frame = Math.min(2, Math.floor(t * 3));
    const spread = 2 + frame * 3;
    ctx.globalAlpha = 0.8 * (1 - t);
    ctx.fillStyle = DUST;
    const cx = Math.round(cell.x + cell.w / 2);
    const cy = Math.round(cell.y + cell.h / 2);
    for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1], [0, 1], [-1, 0], [1, 0]] as const) {
      const size = frame === 2 ? 1 : 2;
      ctx.fillRect(cx + dx * spread - 1, cy + dy * spread - 1, size, size);
    }
  }
  ctx.globalAlpha = 1;
}

/** A refused cell: a red frame that jolts side to side and fades over the shake. */
export function drawShake(ctx: CanvasRenderingContext2D, cell: Box, t: number): void {
  const jolt = Math.round(Math.sin(t * Math.PI * 6) * 2 * (1 - t));
  ctx.globalAlpha = 1 - t;
  ctx.fillStyle = REFUSED;
  const x = cell.x + jolt;
  ctx.fillRect(x, cell.y, cell.w, 1);
  ctx.fillRect(x, cell.y + cell.h - 1, cell.w, 1);
  ctx.fillRect(x, cell.y, 1, cell.h);
  ctx.fillRect(x + cell.w - 1, cell.y, 1, cell.h);
  ctx.globalAlpha = 1;
}
