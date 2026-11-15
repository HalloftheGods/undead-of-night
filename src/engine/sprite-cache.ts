import type { Clip, PixelSprite } from '../art/types.ts';
import { bayerThreshold } from './light-dither.ts';

/** Steps in a dithered fade. */
export const FADE_STEPS = 8;

const canvases = new WeakMap<PixelSprite, HTMLCanvasElement>();
const silhouettes = new WeakMap<PixelSprite, HTMLCanvasElement>();
const fades = new WeakMap<PixelSprite, (HTMLCanvasElement | undefined)[]>();
const dataUrls = new WeakMap<PixelSprite, string>();
const bodyHeights = new WeakMap<PixelSprite, number>();
const outlines = new WeakMap<PixelSprite, Map<string, HTMLCanvasElement>>();

function upload(width: number, height: number, rgba: Uint8ClampedArray): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const pixels = new ImageData(new Uint8ClampedArray(rgba), width, height);
  canvas.getContext('2d')!.putImageData(pixels, 0, 0);
  return canvas;
}

export function spriteCanvas(sprite: PixelSprite): HTMLCanvasElement {
  let canvas = canvases.get(sprite);
  if (!canvas) {
    canvas = upload(sprite.w, sprite.h, sprite.rgba);
    canvases.set(sprite, canvas);
  }
  return canvas;
}

/** All-white copy, for hit flashes and see-through-walls outlines. */
export function silhouetteCanvas(sprite: PixelSprite): HTMLCanvasElement {
  let canvas = silhouettes.get(sprite);
  if (!canvas) {
    const white = new Uint8ClampedArray(sprite.rgba);
    for (let i = 0; i < white.length; i += 4) {
      white[i] = 255;
      white[i + 1] = 255;
      white[i + 2] = 255;
    }
    canvas = upload(sprite.w, sprite.h, white);
    silhouettes.set(sprite, canvas);
  }
  return canvas;
}

/** The sprite with step/FADE_STEPS of its pixels knocked out through the dither matrix. */
export function fadedCanvas(sprite: PixelSprite, step: number): HTMLCanvasElement {
  let steps = fades.get(sprite);
  if (!steps) {
    steps = [];
    fades.set(sprite, steps);
  }
  let canvas = steps[step];
  if (!canvas) {
    const holed = new Uint8ClampedArray(sprite.rgba);
    const gone = step / FADE_STEPS;
    for (let y = 0; y < sprite.h; y += 1) {
      for (let x = 0; x < sprite.w; x += 1) {
        const knockedOut = bayerThreshold(x, y) < gone;
        if (knockedOut) holed[(y * sprite.w + x) * 4 + 3] = 0;
      }
    }
    canvas = upload(sprite.w, sprite.h, holed);
    steps[step] = canvas;
  }
  return canvas;
}

/** PNG at native size; the overlay scales it up with image-rendering: pixelated. */
export function spriteDataUrl(sprite: PixelSprite): string {
  let url = dataUrls.get(sprite);
  if (!url) {
    url = spriteCanvas(sprite).toDataURL('image/png');
    dataUrls.set(sprite, url);
  }
  return url;
}

export function drawSprite(ctx: CanvasRenderingContext2D, sprite: PixelSprite, x: number, y: number): void {
  ctx.drawImage(spriteCanvas(sprite), x - sprite.ax, y - sprite.ay);
}

/** A sprite drawn bigger, pixels kept square, still standing on its anchor. */
export function drawSpriteScaled(ctx: CanvasRenderingContext2D, sprite: PixelSprite, x: number, y: number, scale: number, silhouette = false): void {
  const smoothing = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  const canvas = silhouette ? silhouetteCanvas(sprite) : spriteCanvas(sprite);
  ctx.drawImage(canvas, Math.round(x - sprite.ax * scale), Math.round(y - sprite.ay * scale), Math.round(sprite.w * scale), Math.round(sprite.h * scale));
  ctx.imageSmoothingEnabled = smoothing;
}

export function drawSilhouette(ctx: CanvasRenderingContext2D, sprite: PixelSprite, x: number, y: number): void {
  ctx.drawImage(silhouetteCanvas(sprite), x - sprite.ax, y - sprite.ay);
}

/** The empty pixels touching the sprite (4-way), in one colour: a 1px rim, a pixel bigger than the sprite on every side. */
export function outlineRgba(sprite: PixelSprite, rgb: readonly [number, number, number]): Uint8ClampedArray {
  const w = sprite.w + 2;
  const h = sprite.h + 2;
  const out = new Uint8ClampedArray(w * h * 4);
  const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < sprite.w && y < sprite.h && sprite.rgba[(y * sprite.w + x) * 4 + 3] !== 0;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const sx = x - 1;
      const sy = y - 1;
      if (solid(sx, sy)) continue;
      const touches = solid(sx - 1, sy) || solid(sx + 1, sy) || solid(sx, sy - 1) || solid(sx, sy + 1);
      if (!touches) continue;
      const i = (y * w + x) * 4;
      out[i] = rgb[0];
      out[i + 1] = rgb[1];
      out[i + 2] = rgb[2];
      out[i + 3] = 255;
    }
  }
  return out;
}

function hexRgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Draws a 1px rim of `color` (#rrggbb) around the sprite where it stands, for picking one figure out of a scene. */
export function drawOutline(ctx: CanvasRenderingContext2D, sprite: PixelSprite, x: number, y: number, color: string): void {
  let byColor = outlines.get(sprite);
  if (!byColor) {
    byColor = new Map();
    outlines.set(sprite, byColor);
  }
  let canvas = byColor.get(color);
  if (!canvas) {
    canvas = upload(sprite.w + 2, sprite.h + 2, outlineRgba(sprite, hexRgb(color)));
    byColor.set(color, canvas);
  }
  ctx.drawImage(canvas, x - sprite.ax - 1, y - sprite.ay - 1);
}

function firstOpaqueRow(sprite: PixelSprite): number {
  for (let y = 0; y < sprite.h; y += 1) {
    for (let x = 0; x < sprite.w; x += 1) {
      const opaque = sprite.rgba[(y * sprite.w + x) * 4 + 3] !== 0;
      if (opaque) return y;
    }
  }
  return sprite.ay;
}

/** Pixels from the anchor up to the top of the painted figure, ignoring empty padding. */
export function bodyHeight(sprite: PixelSprite): number {
  const height = bodyHeights.get(sprite) ?? sprite.ay - firstOpaqueRow(sprite);
  bodyHeights.set(sprite, height);
  return height;
}

export function clipDuration(clip: Clip): number {
  return clip.frames.length / clip.fps;
}

/** The index of the frame showing `seconds` into the clip. */
export function clipIndex(clip: Clip, seconds: number): number {
  const count = clip.frames.length;
  const index = Math.floor(Math.max(0, seconds) * clip.fps);
  return clip.loop ? index % count : Math.min(index, count - 1);
}

export function clipFrame(clip: Clip, seconds: number): PixelSprite {
  return clip.frames[clipIndex(clip, seconds)];
}

/** The index of the frame at a progress through the clip, 0..1. */
export function clipIndexAt(clip: Clip, progress: number): number {
  return Math.min(clip.frames.length - 1, Math.floor(progress * clip.frames.length));
}

/** A frame chosen by progress through the clip, 0..1. */
export function clipFrameAt(clip: Clip, progress: number): PixelSprite {
  return clip.frames[clipIndexAt(clip, progress)];
}

/** The index of the frame for a distance covered, one frame per stride. */
export function strideIndex(clip: Clip, distance: number, stridePx: number): number {
  return Math.floor(distance / stridePx) % clip.frames.length;
}

/** A frame chosen by distance covered, one frame per stride. */
export function strideFrame(clip: Clip, distance: number, stridePx: number): PixelSprite {
  return clip.frames[strideIndex(clip, distance, stridePx)];
}
