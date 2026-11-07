// Helpers shared by the effect, pickup and interface art.

import type { Clip, DirClips, PixelSprite } from '../types.ts';
import { dirClips, makeClip, PixelCanvas } from '../kit.ts';
import type { DrawnDir, Legend, Point } from '../kit.ts';
import { RAMPS } from '../palette.ts';

const { bone, fire } = RAMPS;

export type Grid = readonly string[];

/** Hot light: white core out through yellow and amber to a burnt edge. */
export const HOT: Legend = { W: bone[3], Y: fire[3], A: fire[2], O: fire[1], R: fire[0] };

/** Stamps a grid into a cell of a fixed size, so every frame of a clip matches. */
export function cell(w: number, h: number, rows: Grid, legend: Legend, x = 0, y = 0): PixelCanvas {
  return new PixelCanvas(w, h).grid(x, y, rows, legend);
}

function sizeOf(frames: readonly Grid[]): [number, number] {
  return [Math.max(...frames.flatMap((rows) => rows.map((row) => row.length))), Math.max(...frames.map((rows) => rows.length))];
}

function spritesOf(canvases: readonly PixelCanvas[], [ax, ay]: Point): PixelSprite[] {
  return canvases.map((canvas) => canvas.toSprite(canvas.w, canvas.h, ax, ay));
}

export function gridSprite(rows: Grid, legend: Legend, ax: number, ay: number): PixelSprite {
  return PixelCanvas.fromGrid(rows, legend).toSprite(undefined, undefined, ax, ay);
}

export function gridClip(frames: readonly Grid[], legend: Legend, anchor: Point, fps: number, loop = false): Clip {
  const [w, h] = sizeOf(frames);
  return makeClip(spritesOf(frames.map((rows) => cell(w, h, rows, legend)), anchor), fps, loop);
}

function transpose(src: PixelCanvas): PixelCanvas {
  const out = new PixelCanvas(src.h, src.w);
  for (let y = 0; y < src.h; y++) {
    for (let x = 0; x < src.w; x++) {
      const color = src.get(x, y);
      const isPainted = color !== null;
      if (isPainted) out.px(y, x, color);
    }
  }
  return out;
}

function flipY(src: PixelCanvas): PixelCanvas {
  return new PixelCanvas(src.w, src.h).blit(src, 0, 0, { flipY: true });
}

/**
 * All eight facings of a self-lit effect from an E and a SE drawing. Light has no
 * shaded side, so S, N and NE are exact quarter turns and flips: no pixel is resampled.
 */
export function turnedClips(
  east: readonly Grid[],
  southEast: readonly Grid[],
  legend: Legend,
  [ex, ey]: Point,
  [sx, sy]: Point,
  fps: number,
  loop = false,
): DirClips {
  const [ew, eh] = sizeOf(east);
  const [sw, sh] = sizeOf(southEast);
  const e = east.map((rows) => cell(ew, eh, rows, legend));
  const se = southEast.map((rows) => cell(sw, sh, rows, legend));
  const s = e.map(transpose);
  const drawn: Record<DrawnDir, PixelSprite[]> = {
    0: spritesOf(e, [ex, ey]),
    1: spritesOf(se, [sx, sy]),
    2: spritesOf(s, [ey, ex]),
    6: spritesOf(s.map(flipY), [ey, ew - ex]),
    7: spritesOf(se.map(flipY), [sx, sh - sy]),
  };
  return dirClips((dir) => makeClip(drawn[dir], fps, loop));
}
