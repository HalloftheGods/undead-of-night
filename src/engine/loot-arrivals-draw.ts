// How the canvas loot window shows an item arriving while it is open (game/inventory/pickup-arrivals.ts): the item
// hops from where it lay in the world into its cell, growing to size, with a short trail; then the cell flashes and
// a ring and four sparks burst out from it.

import type { Arrival } from '../game/inventory/pickup-arrivals.ts';
import { arrivalCamera, easeOut, hop } from '../game/inventory/pickup-arrivals.ts';

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

/** Where and how big the item is as it sets off: its world spot a size up, or the cell it left at that cell's size. */
function start(arrival: Arrival, cell: Box): { x: number; y: number; w: number; h: number; hop: number } | null {
  const left = arrival.origin?.buffer;
  if (left) return { x: left.x + left.w / 2, y: left.y + left.h / 2, w: left.w, h: left.h, hop: HOP_PX / 2 };
  const camera = arrivalCamera();
  if (!camera || !arrival.from) return null;
  const from = camera.toBuffer(arrival.from);
  return { x: from.x, y: from.y, w: cell.w * (1 + START_GROW), h: cell.h * (1 + START_GROW), hop: HOP_PX };
}

/** The flight's box at progress t, or null when there is nowhere to fly from (it then only pops). */
export function flightBox(arrival: Arrival, cell: Box, t: number): Box | null {
  const from = start(arrival, cell);
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
export function drawFlight(ctx: CanvasRenderingContext2D, arrival: Arrival, cell: Box, t: number, drawItem: DrawItemIn): boolean {
  const box = flightBox(arrival, cell, t);
  if (!box) return false;
  for (let i = 1; i <= TRAIL; i += 1) {
    const back = flightBox(arrival, cell, Math.max(0, t - i * 0.05));
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
