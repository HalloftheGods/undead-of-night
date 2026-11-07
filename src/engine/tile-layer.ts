import { TILE_KINDS, TILE_SIZE } from '../../shared/protocol.ts';
import type { TileKind, WorldMap } from '../../shared/protocol.ts';
import type { PixelSprite } from '../art/types.ts';
import type { Tint } from './level-look.ts';
import { drawSprite, spriteCanvas } from './sprite-cache.ts';

const CHUNK_TILES = 16;
export const CHUNK_SIZE = CHUNK_TILES * TILE_SIZE;

/** Stable per-tile pick, so the same street looks the same every time it scrolls in. */
export function tileVariant(col: number, row: number, seed: number, count: number): number {
  let hash = Math.imul(col, 374761393) ^ Math.imul(row, 668265263) ^ seed;
  hash = Math.imul(hash ^ (hash >>> 13), 1274126177);
  return ((hash ^ (hash >>> 16)) >>> 0) % count;
}

/**
 * The ground, pre-rendered to chunk canvases. Decals are stamped straight into
 * the chunks, so a thousand bloodstains cost no more per frame than clean road.
 * A level's tint goes in the same way, painted once when a chunk is made.
 */
export class GroundLayer {
  private readonly map: WorldMap;
  private readonly tiles: Record<TileKind, readonly PixelSprite[]>;
  private readonly chunkCols: number;
  private readonly chunkRows: number;
  private chunks: (HTMLCanvasElement | undefined)[] = [];
  /** Each chunk's context, kept so a burst of bloodstains does not ask the canvas for it every stamp. */
  private readonly contexts = new WeakMap<HTMLCanvasElement, CanvasRenderingContext2D>();
  private tint: Tint | null;

  constructor(map: WorldMap, tiles: Record<TileKind, readonly PixelSprite[]>, tint: Tint | null = null) {
    this.map = map;
    this.tiles = tiles;
    this.tint = tint;
    this.chunkCols = Math.ceil(map.width / CHUNK_SIZE);
    this.chunkRows = Math.ceil(map.height / CHUNK_SIZE);
  }

  /** Back to clean road; chunks rebuild on demand. */
  clear(): void {
    this.chunks = [];
  }

  setTint(tint: Tint | null): void {
    const unchanged = tint === this.tint;
    if (unchanged) return;
    this.tint = tint;
    this.clear();
  }

  private chunk(chunkCol: number, chunkRow: number): HTMLCanvasElement {
    const index = chunkRow * this.chunkCols + chunkCol;
    let canvas = this.chunks[index];
    if (!canvas) {
      canvas = this.paintChunk(chunkCol, chunkRow);
      this.chunks[index] = canvas;
    }
    return canvas;
  }

  private paintChunk(chunkCol: number, chunkRow: number): HTMLCanvasElement {
    const { cols, rows, tiles, seed } = this.map;
    const canvas = document.createElement('canvas');
    canvas.width = CHUNK_SIZE;
    canvas.height = CHUNK_SIZE;
    const ctx = canvas.getContext('2d')!;
    const firstCol = chunkCol * CHUNK_TILES;
    const firstRow = chunkRow * CHUNK_TILES;
    for (let row = firstRow; row < Math.min(rows, firstRow + CHUNK_TILES); row += 1) {
      for (let col = firstCol; col < Math.min(cols, firstCol + CHUNK_TILES); col += 1) {
        const variants = this.tiles[TILE_KINDS[tiles[row * cols + col]]];
        const sprite = variants[tileVariant(col, row, seed, variants.length)];
        ctx.drawImage(spriteCanvas(sprite), (col - firstCol) * TILE_SIZE, (row - firstRow) * TILE_SIZE);
      }
    }
    if (this.tint) {
      ctx.globalAlpha = this.tint.alpha;
      ctx.fillStyle = this.tint.color;
      ctx.fillRect(0, 0, CHUNK_SIZE, CHUNK_SIZE);
      ctx.globalAlpha = 1;
    }
    return canvas;
  }

  draw(ctx: CanvasRenderingContext2D, left: number, top: number, viewW: number, viewH: number): void {
    const col0 = Math.max(0, Math.floor(left / CHUNK_SIZE));
    const row0 = Math.max(0, Math.floor(top / CHUNK_SIZE));
    const col1 = Math.min(this.chunkCols - 1, Math.floor((left + viewW - 1) / CHUNK_SIZE));
    const row1 = Math.min(this.chunkRows - 1, Math.floor((top + viewH - 1) / CHUNK_SIZE));
    for (let row = row0; row <= row1; row += 1) {
      for (let col = col0; col <= col1; col += 1) {
        ctx.drawImage(this.chunk(col, row), col * CHUNK_SIZE - left, row * CHUNK_SIZE - top);
      }
    }
  }

  private contextOf(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
    let ctx = this.contexts.get(canvas);
    if (!ctx) {
      ctx = canvas.getContext('2d')!;
      this.contexts.set(canvas, ctx);
    }
    return ctx;
  }

  /** Paints into every chunk the sprite touches. */
  stamp(sprite: PixelSprite, x: number, y: number, alpha = 1): void {
    const px = Math.round(x);
    const py = Math.round(y);
    const x0 = px - sprite.ax;
    const y0 = py - sprite.ay;
    const col0 = Math.max(0, Math.floor(x0 / CHUNK_SIZE));
    const row0 = Math.max(0, Math.floor(y0 / CHUNK_SIZE));
    const col1 = Math.min(this.chunkCols - 1, Math.floor((x0 + sprite.w - 1) / CHUNK_SIZE));
    const row1 = Math.min(this.chunkRows - 1, Math.floor((y0 + sprite.h - 1) / CHUNK_SIZE));
    for (let row = row0; row <= row1; row += 1) {
      for (let col = col0; col <= col1; col += 1) {
        const ctx = this.contextOf(this.chunk(col, row));
        ctx.globalAlpha = alpha;
        drawSprite(ctx, sprite, px - col * CHUNK_SIZE, py - row * CHUNK_SIZE);
        ctx.globalAlpha = 1;
      }
    }
  }
}
