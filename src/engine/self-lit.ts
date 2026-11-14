// Things that burn by themselves: a jack-o'-lantern's carved face, lit from inside. Like the
// zombies' eyes they are drawn after the lightmap, so the night stays exactly as dark and only
// these few pixels glow. The art marks them (art/glow.ts); this paints them.

import type { GlowPixel } from '../art/glow.ts';
import type { Color } from '../art/palette.ts';
import { paintEyes } from './zombie-eyes.ts';
import type { EyePixel } from './zombie-eyes.ts';
import type { PixelSprite } from '../art/types.ts';

/** A body standing in the scene, in screen pixels at its feet. Anything behind it must not shine through. */
export interface Body {
  readonly x: number;
  readonly y: number;
}

/** How far either side of its feet, and how far up, a figure hides what stands behind it. */
export const BODY_HALF_WIDTH = 9;
export const BODY_REACH = 30;

const css = (color: Color): string => `#${color.toString(16).padStart(6, '0')}`;

const asEyes = new WeakMap<readonly GlowPixel[], readonly EyePixel[]>();

/** The same pixels in the form the eye painter takes, converted once per list. */
function paintable(pixels: readonly GlowPixel[]): readonly EyePixel[] {
  let eyes = asEyes.get(pixels);
  if (!eyes) {
    eyes = pixels.map(({ x, y, core, halo }) => ({ x, y, core: css(core), halo: css(halo) }));
    asEyes.set(pixels, eyes);
  }
  return eyes;
}

/** True when a figure stands in front of this pixel, so its glow would paint over them. */
export function isCovered(x: number, y: number, bodies: readonly Body[]): boolean {
  return bodies.some((body) => Math.abs(body.x - x) <= BODY_HALF_WIDTH && body.y > y && body.y - y <= BODY_REACH);
}

/**
 * Paints a sprite's self-lit pixels, the sprite's anchor at x, y on screen.
 * `strength` fades the whole thing, for a shell that is opening.
 */
export function paintSelfLit(
  ctx: CanvasRenderingContext2D,
  pixels: readonly GlowPixel[],
  sprite: PixelSprite,
  x: number,
  y: number,
  _light: number,
  strength: number,
  bodies: readonly Body[],
): void {
  if (pixels.length === 0 || strength <= 0) return;
  const eyes = paintable(pixels);
  const left = Math.round(x - sprite.ax);
  const top = Math.round(y - sprite.ay);
  const clear = bodies.length === 0 ? eyes : eyes.filter((eye) => !isCovered(left + eye.x, top + eye.y, bodies));
  paintEyes(ctx, clear, sprite, x, y, 1, strength);
}
