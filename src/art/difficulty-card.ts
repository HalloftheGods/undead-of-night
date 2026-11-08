// The difficulty page's card art: one small hand-drawn scene per difficulty, in the same
// style as the survivor busts. Each grid lives in difficulty/<id>.ts.

import type { Legend } from './kit.ts';
import { PixelCanvas } from './kit.ts';
import type { PixelSprite } from './types.ts';

/** Every card picture is this many art pixels, so the four sit side by side at one scale. */
export const CARD_W = 56;
export const CARD_H = 40;

export interface CardDef {
  /** CARD_H rows of CARD_W characters. '.' is empty; any other character is looked up in `legend`. */
  readonly rows: readonly string[];
  /** Colours come from RAMPS only (src/art/palette.ts). */
  readonly legend: Legend;
}

export function cardOf(def: CardDef): PixelSprite {
  return PixelCanvas.fromGrid(def.rows, def.legend).toSprite(CARD_W, CARD_H, CARD_W / 2, CARD_H);
}

/** The Play page's portrait cards: the same scene with more sky above it, never stretched. */
export const TALL_H = 72;
const SKY_ROWS = TALL_H - CARD_H;

/**
 * How a scene grows into a portrait card. Open sky is `fill` near the scene with a sparse sprinkle of `dot`,
 * dithering up into `high` when the night darkens overhead; a scene whose top is a wall repeats its top row instead.
 */
export type CardReach = { readonly fill: string; readonly dot: string; readonly high?: string } | 'repeat';

/** A sparse, fixed scatter: about one cell in 45 gets a dot, the same every build. */
function dotted(x: number, y: number): boolean {
  let mixed = Math.imul(x, 374761393) ^ Math.imul(y, 668265263);
  mixed = Math.imul(mixed ^ (mixed >>> 13), 1274126177);
  mixed ^= mixed >>> 16;
  return (mixed >>> 0) % 45 === 0;
}

/** The sky colour at a row: `high` over the top half, a checkered band, then `fill` down to the scene. */
function skyFill(fill: string, high: string, x: number, y: number): string {
  const mid = Math.floor(SKY_ROWS / 2);
  const isBand = y >= mid - 1 && y <= mid;
  const isHigh = y < mid - 1;
  if (isBand) return (x + y) % 2 === 0 ? high : fill;
  return isHigh ? high : fill;
}

function skyRow(def: CardDef, reach: CardReach, y: number): string {
  const isRepeat = reach === 'repeat';
  if (isRepeat) return def.rows[0];
  const high = reach.high ?? reach.fill;
  return Array.from({ length: CARD_W }, (_, x) => (dotted(x, y) ? reach.dot : skyFill(reach.fill, high, x, y))).join('');
}

/** The scene as a portrait: SKY_ROWS added above it. */
export function tallRows(def: CardDef, reach: CardReach): readonly string[] {
  const above = Array.from({ length: SKY_ROWS }, (_, y) => skyRow(def, reach, y));
  return [...above, ...def.rows];
}

export function tallCardOf(def: CardDef, reach: CardReach): PixelSprite {
  return PixelCanvas.fromGrid(tallRows(def, reach), def.legend).toSprite(CARD_W, TALL_H, CARD_W / 2, TALL_H);
}
