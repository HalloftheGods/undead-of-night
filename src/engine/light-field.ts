import { BAYER_CELLS, buildLightBands, DITHER_STEPS, lightLevels } from './light-dither.ts';
import type { LightBands } from './light-dither.ts';

export type Rgb = readonly [number, number, number];

/** Screen pixels, right and bottom exclusive. */
export interface ScreenRect {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

/** Light is worked out once per 2x2 pixels; the dither runs at full resolution over it. */
const CELL = 2;
const TABLE_SIZE = 256;
/** Cells per stretch of a row that can be written as one flat colour. */
const SPAN_CELLS = 16;
const SPAN_SHIFT = 4;

/** How a pool dies away, indexed by squared distance as a share of the radius squared. */
const POOL_FALLOFF = Float32Array.from({ length: TABLE_SIZE }, (_, i) => (1 - i / TABLE_SIZE) ** 2);
/** A beam holds its strength most of the way out, then goes quickly. */
const BEAM_FALLOFF = Float32Array.from({ length: TABLE_SIZE }, (_, i) => (1 - (i / TABLE_SIZE) ** 2) ** 1.25);
/** Across the beam, by share of the half-width: a hot middle and a long soft edge. */
const BEAM_EDGE = Float32Array.from({ length: TABLE_SIZE }, (_, i) => {
  const t = Math.min(1, Math.max(0, (i / TABLE_SIZE - 0.16) / 0.84));
  return (1 - t * t * (3 - 2 * t)) ** 1.35;
});

/** An opaque pixel as a signed word: Int32Array keeps the hot loop off doubles, which Uint32Array would not. */
function pack(r: number, g: number, b: number): number {
  return -16777216 | (b << 16) | (g << 8) | r;
}

export interface Beam {
  readonly x: number;
  readonly y: number;
  readonly angle: number;
  readonly reach: number;
  /** tan of the half-angle. */
  readonly tanHalf: number;
  /** Stop distance per ray, the rays spaced evenly in tan(angle) across the beam. */
  readonly rays: Float32Array;
  readonly color: Rgb;
  readonly strength: number;
}

/**
 * A lightmap in plain typed arrays: lights add into float cells, then each cell
 * is quantised to two levels of its own hue and stippled between them. One
 * decision per pixel keeps all three channels stepping together, so the dark
 * has no colour fringes, and nothing here needs a canvas read-back.
 */
export class LightField {
  private width = 0;
  private height = 0;
  private cols = 0;
  private rows = 0;
  private left = 0;
  private top = 0;
  /** 0 or 1: cells are pinned to the world, so light edges do not crawl as the camera moves. */
  private offsetX = 0;
  private offsetY = 0;
  private red = new Float32Array(0);
  private green = new Float32Array(0);
  private blue = new Float32Array(0);
  private lowColor = new Int32Array(0);
  private highColor = new Int32Array(0);
  private mix = new Uint8Array(0);
  /** Per span of a cell row, 1 when every cell in it is one colour with no stipple. */
  private flatSpans = new Uint8Array(0);
  private spanCols = 0;
  private bands: LightBands;

  /** anchors are the flat brightnesses that should come out without a pattern. */
  constructor(anchors: readonly number[]) {
    this.bands = buildLightBands(lightLevels(anchors));
  }

  /** A new ambient means new flat brightnesses. Once a level, not once a frame. */
  setAnchors(anchors: readonly number[]): void {
    this.bands = buildLightBands(lightLevels(anchors));
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.cols = (width >> 1) + 2;
    this.rows = (height >> 1) + 2;
    const cells = this.cols * this.rows;
    this.red = new Float32Array(cells);
    this.green = new Float32Array(cells);
    this.blue = new Float32Array(cells);
    this.lowColor = new Int32Array(cells);
    this.highColor = new Int32Array(cells);
    this.mix = new Uint8Array(cells);
    this.spanCols = Math.ceil(this.cols / SPAN_CELLS);
    this.flatSpans = new Uint8Array(this.spanCols * this.rows);
  }

  begin(left: number, top: number, ambient: Rgb): void {
    this.left = left;
    this.top = top;
    this.offsetX = left & 1;
    this.offsetY = top & 1;
    this.red.fill(ambient[0]);
    this.green.fill(ambient[1]);
    this.blue.fill(ambient[2]);
  }

  private colOf(x: number): number {
    return Math.floor((x + this.offsetX) / CELL);
  }

  private rowOf(y: number): number {
    return Math.floor((y + this.offsetY) / CELL);
  }

  private centreX(col: number): number {
    return col * CELL - this.offsetX + 0.5;
  }

  private centreY(row: number): number {
    return row * CELL - this.offsetY + 0.5;
  }

  /** Screen coordinates. With clip, nothing lands outside that rectangle. */
  addPool(x: number, y: number, radius: number, color: Rgb, strength: number, clip?: ScreenRect): void {
    const firstCol = Math.max(0, this.colOf(Math.max(x - radius, clip?.x0 ?? -Infinity)));
    const lastCol = Math.min(this.cols - 1, this.colOf(Math.min(x + radius, (clip?.x1 ?? Infinity) - 1)));
    const firstRow = Math.max(0, this.rowOf(Math.max(y - radius, clip?.y0 ?? -Infinity)));
    const lastRow = Math.min(this.rows - 1, this.rowOf(Math.min(y + radius, (clip?.y1 ?? Infinity) - 1)));
    const scale = TABLE_SIZE / (radius * radius);
    const [r, g, b] = color;
    for (let row = firstRow; row <= lastRow; row += 1) {
      const dy = this.centreY(row) - y;
      const base = row * this.cols;
      for (let col = firstCol; col <= lastCol; col += 1) {
        const dx = this.centreX(col) - x;
        const slot = ((dx * dx + dy * dy) * scale) | 0;
        const pastRadius = slot >= TABLE_SIZE;
        if (pastRadius) continue;
        const light = POOL_FALLOFF[slot] * strength;
        this.red[base + col] += r * light;
        this.green[base + col] += g * light;
        this.blue[base + col] += b * light;
      }
    }
  }

  private beamBounds(beam: Beam): ScreenRect {
    let x0 = beam.x;
    let x1 = beam.x;
    let y0 = beam.y;
    let y1 = beam.y;
    const last = beam.rays.length - 1;
    for (let i = 0; i <= last; i += 1) {
      const turn = beam.angle + Math.atan(beam.tanHalf * ((i / last) * 2 - 1));
      const endX = beam.x + Math.cos(turn) * beam.rays[i];
      const endY = beam.y + Math.sin(turn) * beam.rays[i];
      x0 = Math.min(x0, endX);
      x1 = Math.max(x1, endX);
      y0 = Math.min(y0, endY);
      y1 = Math.max(y1, endY);
    }
    return { x0, y0, x1, y1 };
  }

  addBeam(beam: Beam): void {
    const bounds = this.beamBounds(beam);
    const firstCol = Math.max(0, this.colOf(bounds.x0));
    const lastCol = Math.min(this.cols - 1, this.colOf(bounds.x1));
    const firstRow = Math.max(0, this.rowOf(bounds.y0));
    const lastRow = Math.min(this.rows - 1, this.rowOf(bounds.y1));
    const { rays, tanHalf, strength } = beam;
    const cos = Math.cos(beam.angle);
    const sin = Math.sin(beam.angle);
    const distScale = TABLE_SIZE / (beam.reach * beam.reach);
    const raySteps = rays.length - 1;
    const [r, g, b] = beam.color;
    for (let row = firstRow; row <= lastRow; row += 1) {
      const dy = this.centreY(row) - beam.y;
      const base = row * this.cols;
      for (let col = firstCol; col <= lastCol; col += 1) {
        const dx = this.centreX(col) - beam.x;
        const along = dx * cos + dy * sin;
        const behind = along <= 0;
        if (behind) continue;
        const across = (dy * cos - dx * sin) / along;
        const edge = Math.abs(across) / tanHalf;
        const distSq = dx * dx + dy * dy;
        const slot = (distSq * distScale) | 0;
        const outOfBeam = edge >= 1 || slot >= TABLE_SIZE;
        if (outOfBeam) continue;
        const stop = rays[Math.round(((across / tanHalf + 1) / 2) * raySteps)];
        const blocked = distSq > stop * stop;
        if (blocked) continue;
        const light = BEAM_FALLOFF[slot] * BEAM_EDGE[(edge * TABLE_SIZE) | 0] * strength;
        this.red[base + col] += r * light;
        this.green[base + col] += g * light;
        this.blue[base + col] += b * light;
      }
    }
  }

  private isInside(col: number, row: number, room: ScreenRect): boolean {
    const x = this.centreX(col);
    const y = this.centreY(row);
    return x >= room.x0 && x < room.x1 && y >= room.y0 && y < room.y1;
  }

  /**
   * Shuts the viewer in: the room falls back toward its own dark, with whatever
   * lamps reached it taken away, and everything else sinks by outsideScale.
   */
  enclose(room: ScreenRect, roomAmbient: Rgb, outsideScale: number, amount: number): void {
    const outside = 1 + (outsideScale - 1) * amount;
    for (let row = 0; row < this.rows; row += 1) {
      for (let col = 0; col < this.cols; col += 1) {
        const i = row * this.cols + col;
        if (this.isInside(col, row, room)) {
          this.red[i] += (roomAmbient[0] - this.red[i]) * amount;
          this.green[i] += (roomAmbient[1] - this.green[i]) * amount;
          this.blue[i] += (roomAmbient[2] - this.blue[i]) * amount;
        } else {
          this.red[i] *= outside;
          this.green[i] *= outside;
          this.blue[i] *= outside;
        }
      }
    }
  }

  /** Brightest channel at a screen point, 0..255 and past it where lights stack. */
  brightness(x: number, y: number): number {
    const col = this.colOf(x);
    const row = this.rowOf(y);
    const offField = col < 0 || row < 0 || col >= this.cols || row >= this.rows;
    if (offField) return 0;
    const i = row * this.cols + col;
    return Math.max(this.red[i], this.green[i], this.blue[i]);
  }

  /** Most of a night is one flat colour, so a cell that matches its neighbour costs three compares. */
  private quantise(): void {
    const { red, green, blue, lowColor, highColor, mix, flatSpans, cols, rows, spanCols } = this;
    const { low: lowLevels, high: highLevels } = this.bands;
    flatSpans.fill(1);
    let lastR = -1;
    let lastG = -1;
    let lastB = -1;
    let low = 0;
    let high = 0;
    let steps = 0;
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const i = row * cols + col;
        const r = red[i];
        const g = green[i];
        const b = blue[i];
        const changed = r !== lastR || g !== lastG || b !== lastB;
        if (changed) {
          lastR = r;
          lastG = g;
          lastB = b;
          const peak = Math.max(r, g, b, 1e-3);
          // Stacked lights hold their hue at full brightness rather than washing out to white.
          const value = peak < 255 ? peak : 255;
          const whole = value | 0;
          const lowLevel = lowLevels[whole];
          const highLevel = highLevels[whole];
          const toLow = lowLevel / peak;
          const toHigh = highLevel / peak;
          low = pack((r * toLow) | 0, (g * toLow) | 0, (b * toLow) | 0);
          high = pack((r * toHigh) | 0, (g * toHigh) | 0, (b * toHigh) | 0);
          steps = (((value - lowLevel) / (highLevel - lowLevel)) * DITHER_STEPS + 0.5) | 0;
        }
        lowColor[i] = low;
        highColor[i] = high;
        mix[i] = steps;
        const span = row * spanCols + (col >> SPAN_SHIFT);
        const firstInSpan = (col & (SPAN_CELLS - 1)) === 0;
        const breaksSpan = steps !== 0 || (!firstInSpan && low !== lowColor[i - 1]);
        if (breaksSpan) flatSpans[span] = 0;
      }
    }
  }

  /**
   * One row of pixels. Most spans are flat. The rest pick their colour without a
   * branch, because a dither pattern is the worst case for a branch predictor.
   */
  private writeRow(pixels: Int32Array, y: number): void {
    const { cols, width, left, top, offsetX, offsetY, lowColor, highColor, mix, flatSpans, spanCols } = this;
    const cellY = (y + offsetY) >> 1;
    const cellRow = cellY * cols;
    const bayerRow = ((y + top) & 3) << 2;
    const rowStart = y * width;
    for (let span = 0; span < spanCols; span += 1) {
      const firstCell = span << SPAN_SHIFT;
      const x0 = Math.max(0, firstCell * CELL - offsetX);
      const x1 = Math.min(width, (firstCell + SPAN_CELLS) * CELL - offsetX);
      const flat = flatSpans[cellY * spanCols + span] === 1;
      if (flat) {
        pixels.fill(lowColor[cellRow + firstCell], rowStart + x0, rowStart + x1);
        continue;
      }
      for (let x = x0; x < x1; x += 1) {
        const cell = cellRow + ((x + offsetX) >> 1);
        const useHigh = (BAYER_CELLS[bayerRow | ((x + left) & 3)] - mix[cell]) >> 31;
        pixels[rowStart + x] = (highColor[cell] & useHigh) | (lowColor[cell] & ~useHigh);
      }
    }
  }

  /** Writes width*height RGBA pixels, as little-endian words. */
  write(pixels: Int32Array): void {
    this.quantise();
    for (let y = 0; y < this.height; y += 1) this.writeRow(pixels, y);
  }
}
