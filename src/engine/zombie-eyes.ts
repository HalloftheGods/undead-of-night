// Glowing eyes. A zombie in the dark gives itself away by its eyes and nothing else: they are
// drawn after the lightmap, so the night stays exactly as dark and only these few pixels light
// themselves. Each type keeps the eye colour its art already has, so the colour still tells you
// what is coming. From behind there are no eyes to see, and the art already draws none.

import type { ZombieType } from '../../shared/protocol.ts';
import { RAMPS } from '../art/palette.ts';
import type { Color } from '../art/palette.ts';
import type { PixelSprite } from '../art/types.ts';

interface EyeSpec {
  /** The palette colours the art paints this type's eyes in. */
  readonly colors: readonly Color[];
  /** The dimmer ramp step the glow spreads in. */
  readonly halo: Color;
  /**
   * Only rows this far down the figure count, top to bottom of its painted pixels. The other
   * types paint their eye colour nowhere else, so they look at the whole figure (a raised arm
   * pushes the head down the bounds). The bloater's acid green also streaks its belly: its eyes
   * sit at 0.07 to 0.14 of the way down in every frame and the belly starts at 0.29.
   */
  readonly headShare: number;
}

export const EYE_SPECS: Readonly<Record<ZombieType, EyeSpec>> = {
  walker: { colors: [RAMPS.fire[2]], halo: RAMPS.fire[1], headShare: 1 },
  screamer: { colors: [RAMPS.fire[2]], halo: RAMPS.fire[1], headShare: 1 },
  runner: { colors: [RAMPS.blood[3]], halo: RAMPS.blood[2], headShare: 1 },
  brute: { colors: [RAMPS.fire[2], RAMPS.fire[3]], halo: RAMPS.fire[1], headShare: 1 },
  bloater: { colors: [RAMPS.acid[2]], halo: RAMPS.acid[1], headShare: 0.2 },
};

/** One eye pixel, in sprite pixels. */
export interface EyePixel {
  readonly x: number;
  readonly y: number;
  readonly core: string;
  readonly halo: string;
}

/** At or below this light the eyes glow in full: moonlight tops out near 52, a room near 31. */
export const EYE_DARK_LIGHT = 60;
/** At or above it the beam shows the face itself, so the glow drops to its floor. */
export const EYE_LIT_LIGHT = 150;
/** What is left of the glow in full light: a glint, not a lamp. */
export const EYE_LIT_FLOOR = 0.25;
/** The spread around each eye, added over the dark. Faint on purpose: it marks, it does not light. */
const HALO_ALPHA = 0.32;
/** Every few seconds the eyes shut for a moment, each zombie on its own beat. */
const BLINK_CYCLE_SEC = 5.3;
const BLINK_SEC = 0.13;

const css = (color: Color): string => `#${color.toString(16).padStart(6, '0')}`;

const found = new Map<ZombieType, WeakMap<PixelSprite, readonly EyePixel[]>>();

/** The eye pixels in one frame of a zombie, found once per frame and kept. */
export function eyesOf(sprite: PixelSprite, type: ZombieType): readonly EyePixel[] {
  let byType = found.get(type);
  if (!byType) {
    byType = new WeakMap();
    found.set(type, byType);
  }
  let eyes = byType.get(sprite);
  if (!eyes) {
    eyes = findEyes(sprite, EYE_SPECS[type]);
    byType.set(sprite, eyes);
  }
  return eyes;
}

function findEyes(sprite: PixelSprite, spec: EyeSpec): readonly EyePixel[] {
  const { w, h, rgba } = sprite;
  let top = -1;
  let bottom = -1;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (rgba[(y * w + x) * 4 + 3] === 0) continue;
      if (top < 0) top = y;
      bottom = y;
    }
  }
  if (top < 0) return [];
  const lastRow = top + Math.floor((bottom - top) * spec.headShare);
  const halo = css(spec.halo);
  const eyes: EyePixel[] = [];
  for (let y = top; y <= lastRow; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * 4;
      if (rgba[i + 3] === 0) continue;
      const color = (rgba[i] << 16) | (rgba[i + 1] << 8) | rgba[i + 2];
      if (spec.colors.includes(color)) eyes.push({ x, y, core: css(color), halo });
    }
  }
  return eyes;
}

/** 1 in the dark, easing down to EYE_LIT_FLOOR where the light already shows the face. */
export function eyeGlow(light: number): number {
  const lit = Math.min(1, Math.max(0, (light - EYE_DARK_LIGHT) / (EYE_LIT_LIGHT - EYE_DARK_LIGHT)));
  return 1 - lit * (1 - EYE_LIT_FLOOR);
}

/** A stable 0..1 offset per zombie, so a horde does not blink in time. */
export function eyePhase(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) % 997;
  return hash / 997;
}

export function blinking(time: number, phase: number): boolean {
  const cycle = (time / BLINK_CYCLE_SEC + phase) % 1;
  return cycle * BLINK_CYCLE_SEC < BLINK_SEC;
}

/**
 * Paints the eyes of a sprite standing on its anchor at x, y (screen pixels), scaled like
 * drawSpriteScaled. Hard square pixels: a dim additive plus around each eye, then the eye in
 * its own colour on top.
 */
export function paintEyes(
  ctx: CanvasRenderingContext2D,
  eyes: readonly EyePixel[],
  sprite: PixelSprite,
  x: number,
  y: number,
  scale: number,
  glow: number,
): void {
  if (eyes.length === 0 || glow <= 0) return;
  const size = Math.max(1, Math.round(scale));
  const left = Math.round(x - sprite.ax * scale);
  const top = Math.round(y - sprite.ay * scale);
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = HALO_ALPHA * glow;
  for (const eye of eyes) {
    const px = left + Math.floor(eye.x * scale);
    const py = top + Math.floor(eye.y * scale);
    ctx.fillStyle = eye.halo;
    ctx.fillRect(px - size, py, size * 3, size);
    ctx.fillRect(px, py - size, size, size * 3);
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = glow;
  for (const eye of eyes) {
    ctx.fillStyle = eye.core;
    ctx.fillRect(left + Math.floor(eye.x * scale), top + Math.floor(eye.y * scale), size, size);
  }
  ctx.globalAlpha = 1;
}
