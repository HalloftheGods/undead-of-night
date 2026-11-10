// Grid drawing board for 56x72 portrait book covers.
// Characters in, CardDef rows out. Matches the pattern from src/art/styles/grid.ts.

import { CARD_W, TALL_H } from '../difficulty-card.ts';
import { PixelCanvas, type Legend } from '../kit.ts';
import type { PixelSprite } from '../types.ts';

export class CardGrid {
  private readonly cells: string[][];

  constructor(fill: string) {
    this.cells = Array.from({ length: TALL_H }, () => Array.from({ length: CARD_W }, () => fill));
  }

  put(x: number, y: number, letter: string): void {
    const onBoard = x >= 0 && x < CARD_W && y >= 0 && y < TALL_H;
    if (onBoard) this.cells[y][x] = letter;
  }

  get(x: number, y: number): string {
    const onBoard = x >= 0 && x < CARD_W && y >= 0 && y < TALL_H;
    return onBoard ? this.cells[y][x] : '';
  }

  rect(x: number, y: number, w: number, h: number, letter: string): this {
    for (let row = y; row < y + h; row += 1) {
      for (let col = x; col < x + w; col += 1) this.put(col, row, letter);
    }
    return this;
  }

  disc(cx: number, cy: number, r: number, letter: string): this {
    for (let row = cy - r; row <= cy + r; row += 1) {
      for (let col = cx - r; col <= cx + r; col += 1) {
        const inside = (col - cx) ** 2 + (row - cy) ** 2 <= r * r + r / 2;
        if (inside) this.put(col, row, letter);
      }
    }
    return this;
  }

  line(x0: number, y0: number, x1: number, y1: number, letter: string): this {
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    let x = x0;
    let y = y0;
    for (;;) {
      this.put(x, y, letter);
      const done = x === x1 && y === y1;
      if (done) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y += sy;
      }
    }
    return this;
  }

  dither(x: number, y: number, w: number, h: number, a: string, b: string): this {
    for (let row = y; row < y + h; row += 1) {
      for (let col = x; col < x + w; col += 1) {
        this.put(col, row, (col + row) % 2 === 0 ? a : b);
      }
    }
    return this;
  }

  stamp(x: number, y: number, grid: readonly string[]): this {
    grid.forEach((line, j) => {
      for (let i = 0; i < line.length; i += 1) {
        const ch = line[i];
        const opaque = ch !== '.' && ch !== ' ';
        if (opaque) this.put(x + i, y + j, ch);
      }
    });
    return this;
  }

  frame(x: number, y: number, w: number, h: number, letter: string): this {
    this.rect(x, y, w, 1, letter).rect(x, y + h - 1, w, 1, letter);
    this.rect(x, y, 1, h, letter).rect(x + w - 1, y, 1, h, letter);
    return this;
  }

  rows(): readonly string[] {
    return this.cells.map((line) => line.join(''));
  }

  toSprite(legend: Legend): PixelSprite {
    return PixelCanvas.fromGrid(this.rows(), legend).toSprite(CARD_W, TALL_H, CARD_W / 2, TALL_H);
  }
}
