// Shared by every prop: baking to the footprint anchor and grounding shadows.

import type { PixelSprite } from '../types.ts';
import type { PixelCanvas } from '../kit.ts';
import { RAMPS } from '../palette.ts';
import { carryGlow } from '../glow.ts';

/**
 * Bakes a prop. left is the footprint's left edge on the canvas and ground its bottom
 * edge, so the anchor lands on the footprint's bottom centre whatever the art does.
 */
export function bake(canvas: PixelCanvas, left: number, footprintW: number, ground: number): PixelSprite {
  return carryGlow(canvas, canvas.toSprite(canvas.w, canvas.h, left + footprintW / 2, ground));
}

/**
 * A hard contact shadow below the ground line. It is drawn under the prop, and stays
 * below the footprint so nobody walking beside the prop is ever painted over.
 */
export function groundShadow(canvas: PixelCanvas, x: number, y: number, w: number, depth: number): PixelCanvas {
  for (let row = 0; row < depth; row++) canvas.rect(x + row, y + row, w - row, 1, RAMPS.ink[1]);
  return canvas;
}
