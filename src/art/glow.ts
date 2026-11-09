// Pixels that light themselves. Art marks them as it paints (a pumpkin's carved face, say) and the
// renderer draws them again after the lightmap, so the night stays exactly as dark and only these
// few pixels burn. The marks ride along with the baked sprite, the way a zombie's eyes are found.

import type { PixelCanvas } from './kit.ts';
import type { Color } from './palette.ts';
import type { PixelSprite } from './types.ts';

/** One self-lit pixel, in sprite pixels, with the colour it burns and the dimmer one it spreads in. */
export interface GlowPixel {
  readonly x: number;
  readonly y: number;
  readonly core: Color;
  readonly halo: Color;
}

const onCanvas = new WeakMap<PixelCanvas, GlowPixel[]>();
const onSprite = new WeakMap<PixelSprite, readonly GlowPixel[]>();

/** Marks a pixel already painted on the canvas as self-lit. Does not paint it. */
export function markGlow(canvas: PixelCanvas, x: number, y: number, core: Color, halo: Color): void {
  if (!canvas.inBounds(x, y)) return;
  const marks = onCanvas.get(canvas) ?? [];
  marks.push({ x, y, core, halo });
  onCanvas.set(canvas, marks);
}

/** Forgets every mark on the canvas: the light behind it has gone out. */
export function clearGlow(canvas: PixelCanvas): void {
  onCanvas.delete(canvas);
}

/**
 * Hands a canvas's marks to the sprite baked from its top-left corner at the same scale. A mark
 * only survives where the pixel under it is still the colour it was marked in, so a recolour or
 * a later paint-over cannot leave a glow on something that no longer shines.
 */
export function carryGlow(canvas: PixelCanvas, sprite: PixelSprite): PixelSprite {
  const marks = (onCanvas.get(canvas) ?? []).filter(({ x, y, core }) => x < sprite.w && y < sprite.h && canvas.get(x, y) === core);
  if (marks.length > 0) onSprite.set(sprite, marks);
  return sprite;
}

/** The self-lit pixels of a baked sprite; empty for nearly all of them. */
export function glowOf(sprite: PixelSprite): readonly GlowPixel[] {
  return onSprite.get(sprite) ?? [];
}
