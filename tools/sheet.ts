// A true-colour drawing surface for contact sheets, with a small built-in pixel font.

import type { PixelSprite } from '../src/art/types.ts';

// 3x5 glyphs: five rows of three bits, top to bottom.
const GLYPHS: Record<string, readonly number[]> = {
  A: [2, 5, 7, 5, 5], B: [6, 5, 6, 5, 6], C: [3, 4, 4, 4, 3], D: [6, 5, 5, 5, 6], E: [7, 4, 6, 4, 7],
  F: [7, 4, 6, 4, 4], G: [3, 4, 5, 5, 3], H: [5, 5, 7, 5, 5], I: [7, 2, 2, 2, 7], J: [1, 1, 1, 5, 2],
  K: [5, 5, 6, 5, 5], L: [4, 4, 4, 4, 7], M: [5, 7, 7, 5, 5], N: [6, 5, 5, 5, 5], O: [2, 5, 5, 5, 2],
  P: [6, 5, 6, 4, 4], Q: [2, 5, 5, 7, 3], R: [6, 5, 6, 5, 5], S: [3, 4, 2, 1, 6], T: [7, 2, 2, 2, 2],
  U: [5, 5, 5, 5, 3], V: [5, 5, 5, 5, 2], W: [5, 5, 7, 7, 5], X: [5, 5, 2, 5, 5], Y: [5, 5, 2, 2, 2],
  Z: [7, 1, 2, 4, 7], 0: [7, 5, 5, 5, 7], 1: [2, 6, 2, 2, 7], 2: [6, 1, 2, 4, 7], 3: [6, 1, 2, 1, 6],
  4: [5, 5, 7, 1, 1], 5: [7, 4, 6, 1, 6], 6: [3, 4, 7, 5, 7], 7: [7, 1, 2, 2, 2], 8: [7, 5, 7, 5, 7],
  9: [7, 5, 7, 1, 6], '/': [1, 1, 2, 4, 4], '-': [0, 0, 7, 0, 0], _: [0, 0, 0, 0, 7], '+': [0, 2, 7, 2, 0],
  '.': [0, 0, 0, 0, 2],
};

export class Sheet {
  readonly w: number;
  readonly h: number;
  readonly data: Uint8ClampedArray;

  constructor(w: number, h: number, background: number) {
    this.w = w;
    this.h = h;
    this.data = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) this.write(i, background);
  }

  private write(index: number, color: number): void {
    this.data[index * 4] = color >> 16;
    this.data[index * 4 + 1] = (color >> 8) & 255;
    this.data[index * 4 + 2] = color & 255;
    this.data[index * 4 + 3] = 255;
  }

  set(x: number, y: number, color: number): void {
    const isOnSheet = x >= 0 && y >= 0 && x < this.w && y < this.h;
    if (isOnSheet) this.write(y * this.w + x, color);
  }

  hline(x: number, y: number, w: number, color: number): void {
    for (let i = 0; i < w; i++) this.set(x + i, y, color);
  }

  /** Multiplies a pixel by per-channel factors. */
  tint(x: number, y: number, r: number, g: number, b: number): void {
    const isOffSheet = x < 0 || y < 0 || x >= this.w || y >= this.h;
    if (isOffSheet) return;
    const i = (y * this.w + x) * 4;
    this.data[i] *= r;
    this.data[i + 1] *= g;
    this.data[i + 2] *= b;
  }

  /** A rectangle of this picture, clipped to it. */
  cropped(x: number, y: number, w: number, h: number): Sheet {
    const out = new Sheet(Math.min(w, this.w - x), Math.min(h, this.h - y), 0);
    for (let j = 0; j < out.h; j++) {
      const from = ((y + j) * this.w + x) * 4;
      out.data.set(this.data.subarray(from, from + out.w * 4), j * out.w * 4);
    }
    return out;
  }

  /** The same picture scaled up by an integer factor, nearest neighbour. */
  scaled(factor: number): Sheet {
    const out = new Sheet(this.w * factor, this.h * factor, 0);
    for (let y = 0; y < out.h; y++) {
      for (let x = 0; x < out.w; x++) {
        const from = (Math.floor(y / factor) * this.w + Math.floor(x / factor)) * 4;
        const to = (y * out.w + x) * 4;
        out.data[to] = this.data[from];
        out.data[to + 1] = this.data[from + 1];
        out.data[to + 2] = this.data[from + 2];
      }
    }
    return out;
  }
}

export function drawSprite(sheet: Sheet, sprite: PixelSprite, x: number, y: number, scale: number): void {
  for (let j = 0; j < sprite.h; j++) {
    for (let i = 0; i < sprite.w; i++) {
      const at = (j * sprite.w + i) * 4;
      const isTransparent = sprite.rgba[at + 3] === 0;
      if (isTransparent) continue;
      const color = (sprite.rgba[at] << 16) | (sprite.rgba[at + 1] << 8) | sprite.rgba[at + 2];
      for (let v = 0; v < scale; v++) for (let u = 0; u < scale; u++) sheet.set(x + i * scale + u, y + j * scale + v, color);
    }
  }
}

export function drawText(sheet: Sheet, text: string, x: number, y: number, color: number): void {
  let pen = x;
  for (const letter of text) {
    const glyph = GLYPHS[letter];
    if (glyph) {
      glyph.forEach((bits, row) => {
        for (let col = 0; col < 3; col++) {
          const isLitBit = (bits & (4 >> col)) !== 0;
          if (isLitBit) sheet.set(pen + col, y + row, color);
        }
      });
    }
    pen += 4;
  }
}
