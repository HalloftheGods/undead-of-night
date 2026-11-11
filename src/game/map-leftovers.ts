// The little marks on a building the team walked out of with supplies still inside, or at a car or dumpster searched and left: one per kind of thing
// left, in a row along the building's foot, so a player can see where to go back to.

import { SUPPLY_KINDS } from '../../shared/leftovers.ts';
import type { SupplyKind } from '../../shared/leftovers.ts';
import { drawOutlinedText, FONT_HEIGHT } from '../engine/bitmap-font.ts';
import { BLINK_HZ, blinkPhase } from './map-cursor.ts';
import type { CursorClock } from './map-cursor.ts';
import type { MapIcon } from './map-sprite.ts';

const INK = '#0b0c10';
export const CLUE_COLOR = '#ffe27a';
export const CLUE_DIM_COLOR = '#8c7426';
/** Each mark is a 5 by 5 glyph on a dark square one pixel bigger all round. */
const GLYPH = 5;
const STEP = GLYPH + 2;
const INSET = 2;

export const LEFTOVER_COLOR: Record<SupplyKind, string> = {
  med: '#ff5d73',
  ammo: '#ffe27a',
  weapon: '#d0d4dc',
  build: '#d9a35f',
  food: '#7be08a',
  gear: '#c58cff',
};

/** Each mark's line in the key, under its "Left behind" heading. */
const LEFTOVER_LABEL: Record<SupplyKind, string> = {
  med: 'Medical',
  ammo: 'Ammo',
  weapon: 'A weapon',
  build: 'Planks and tools',
  food: 'Food and water',
  gear: 'Parts and finds',
};

/** Pixels lit in each glyph, as [x, y] from its top left. */
const GLYPH_PIXELS: Record<SupplyKind, readonly (readonly [number, number])[]> = {
  // A first-aid cross.
  med: [[2, 0], [2, 1], [0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [2, 3], [2, 4]],
  // Three rounds standing up.
  ammo: [[0, 1], [0, 2], [0, 3], [0, 4], [2, 0], [2, 1], [2, 2], [2, 3], [2, 4], [4, 1], [4, 2], [4, 3], [4, 4]],
  // A pistol side on.
  weapon: [[0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [3, 3], [4, 3], [3, 4], [4, 4]],
  // A hammer, head across the top.
  build: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [2, 1], [2, 2], [2, 3], [2, 4]],
  // A tin can with a rim.
  food: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [0, 4], [1, 4], [2, 4], [3, 4], [4, 4]],
  // A diamond, for parts, kits and anything else worth having.
  gear: [[2, 0], [1, 1], [2, 1], [3, 1], [0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [1, 3], [2, 3], [3, 3], [2, 4]],
};

/** The kinds a building still holds, in the key's order. */
export function leftoverKinds(supplies: Partial<Record<SupplyKind, number>>): SupplyKind[] {
  return SUPPLY_KINDS.filter((kind) => (supplies[kind] ?? 0) > 0);
}

/** Draws the row of marks inside a building's footprint, from its bottom left corner. */
export function drawLeftovers(
  ctx: CanvasRenderingContext2D,
  box: { readonly x0: number; readonly y1: number },
  supplies: Partial<Record<SupplyKind, number>>,
): void {
  const top = box.y1 - INSET - GLYPH;
  leftoverKinds(supplies).forEach((kind, index) => {
    paintMark(ctx, box.x0 + INSET + index * STEP, top, kind);
  });
}

/** Draws the same row of marks centred on a spot, for a container standing out in the open. */
export function drawLeftoversAt(ctx: CanvasRenderingContext2D, x: number, y: number, supplies: Partial<Record<SupplyKind, number>>): void {
  const kinds = leftoverKinds(supplies);
  const left = x - Math.floor((kinds.length * STEP - 1) / 2);
  kinds.forEach((kind, index) => {
    paintMark(ctx, left + index * STEP, y - Math.floor(GLYPH / 2), kind);
  });
}

function paintMark(ctx: CanvasRenderingContext2D, left: number, top: number, kind: SupplyKind): void {
  ctx.fillStyle = INK;
  ctx.fillRect(left - 1, top - 1, GLYPH + 2, GLYPH + 2);
  ctx.fillStyle = LEFTOVER_COLOR[kind];
  for (const [dx, dy] of GLYPH_PIXELS[kind]) ctx.fillRect(left + dx, top + dy, 1, 1);
}

/** What the marks mean, for the key beside the map. */
export const LEFTOVER_KEY: readonly { readonly icon: MapIcon; readonly label: string }[] = SUPPLY_KINDS.map((kind) => ({
  label: LEFTOVER_LABEL[kind],
  icon: { w: GLYPH + 2, h: GLYPH + 2, paint: (ctx) => paintMark(ctx, 1, 1, kind) },
}));

/** Draws a crisp 1px pixel circle around (cx, cy). */
export function drawPixelCircle(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  color: string,
): void {
  const isInvalid = radius <= 0;
  if (isInvalid) return;
  ctx.fillStyle = color;
  let x = radius;
  let y = 0;
  let err = 0;

  while (x >= y) {
    ctx.fillRect(cx + x, cy + y, 1, 1);
    ctx.fillRect(cx + y, cy + x, 1, 1);
    ctx.fillRect(cx - y, cy + x, 1, 1);
    ctx.fillRect(cx - x, cy + y, 1, 1);
    ctx.fillRect(cx - x, cy - y, 1, 1);
    ctx.fillRect(cx - y, cy - x, 1, 1);
    ctx.fillRect(cx + y, cy - x, 1, 1);
    ctx.fillRect(cx + x, cy - y, 1, 1);

    y += 1;
    err += 1 + 2 * y;
    const shouldStepX = 2 * (err - x) + 1 > 0;
    if (shouldStepX) {
      x -= 1;
      err += 1 - 2 * x;
    }
  }
}

/** Draws a pixel circle with a 1px dark border on both sides for contrast on any map terrain. */
export function drawOutlinedPixelCircle(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  color: string,
  outlineColor = INK,
): void {
  const hasInner = radius > 1;
  if (hasInner) drawPixelCircle(ctx, cx, cy, radius - 1, outlineColor);
  drawPixelCircle(ctx, cx, cy, radius + 1, outlineColor);
  drawPixelCircle(ctx, cx, cy, radius, color);
}

/** Draws a glowing, blinking circle and label around a building marked by a map clue. */
export function drawClueCache(
  ctx: CanvasRenderingContext2D,
  box: { readonly x0: number; readonly y0: number; readonly x1: number; readonly y1: number },
  clock: CursorClock,
  label = 'CACHE',
): void {
  const cx = Math.round((box.x0 + box.x1) / 2);
  const cy = Math.round((box.y0 + box.y1) / 2);
  const halfW = (box.x1 - box.x0) / 2;
  const halfH = (box.y1 - box.y0) / 2;
  const baseRadius = Math.ceil(Math.hypot(halfW, halfH)) + 3;

  const phase = blinkPhase(clock.nowMs, clock.reducedMotion);
  const isBright = phase === 'bright';
  const color = isBright ? CLUE_COLOR : CLUE_DIM_COLOR;

  if (isBright) {
    ctx.fillStyle = 'rgba(255, 226, 122, 0.2)';
    ctx.fillRect(box.x0, box.y0, box.x1 - box.x0, box.y1 - box.y0);
  }

  const period = 1000 / BLINK_HZ;
  const beat = (((clock.nowMs % period) + period) % period) / period;
  const pulseRadius = baseRadius + Math.round(beat * 4);
  const shouldPulse = !clock.reducedMotion && isBright && pulseRadius > baseRadius;
  if (shouldPulse) {
    drawPixelCircle(ctx, cx, cy, pulseRadius, CLUE_DIM_COLOR);
  }

  drawOutlinedPixelCircle(ctx, cx, cy, baseRadius, color, INK);
  drawOutlinedText(ctx, label, cx, box.y0 - FONT_HEIGHT - 3, color, INK);
}

export const CLUE_ICON: MapIcon = {
  w: 11,
  h: 11,
  paint: (ctx) => {
    drawOutlinedPixelCircle(ctx, 5, 5, 4, CLUE_COLOR, INK);
    ctx.fillStyle = CLUE_COLOR;
    ctx.fillRect(5, 5, 1, 1);
  },
};

