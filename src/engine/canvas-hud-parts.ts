import type { PixelSprite } from '../art/types.ts';
import type { Hotkey, PadArrow } from '../game/canvas-hud-view.ts';
import { drawText, FONT_HEIGHT, textWidth } from './bitmap-font.ts';
import { drawSprite } from './sprite-cache.ts';

export const MARGIN = 6;
export const GAP = 4;
export const PAD = 3;
export const CHIP_H = 12;
export const LINE_GAP = 2;
export const METER_H = 3;
export const METER_TRACK = 'rgba(232, 228, 216, 0.18)';

export const PANEL = 'rgba(11, 12, 16, 0.62)';

const colorCache = new Map<string, string>();

/** A colour from the page's CSS tokens, so the canvas log matches the Vue log in either palette. */
export function cssColor(name: string): string {
  const palette = document.documentElement.dataset.palette ?? '';
  const key = `${palette}:${name}`;
  const cached = colorCache.get(key);
  if (cached !== undefined) return cached;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim() || BONE;
  colorCache.set(key, value);
  return value;
}

/** The text colour of a run-log line, by its tone: the same mapping the Vue log uses (LogLine.vue). */
export function logToneColor(tone: string): string {
  if (tone === 'danger' || tone === 'close') return cssColor('--blood-bright');
  if (tone === 'hope' || tone === 'chain') return cssColor('--amber');
  if (tone === 'quiet') return cssColor('--bone-dim');
  if (tone === 'stamp') return cssColor('--sick');
  return cssColor('--bone');
}
export const BONE = '#e8e4d8';
export const DIM = '#9a968a';
export const AMBER = '#f2a23a';
export const BLOOD = '#e0483c';
export const GOOD = '#8fc46e';

export interface TextLine {
  readonly text: string;
  readonly color: string;
}

export function panel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  ctx.fillStyle = PANEL;
  ctx.fillRect(x, y, w, h);
}

/** A sprite drawn with its left edge at `x`, centred on the row of height `h` starting at `y`. */
export function spriteInRow(ctx: CanvasRenderingContext2D, sprite: PixelSprite, x: number, y: number, h: number): void {
  drawSprite(ctx, sprite, x + sprite.ax, y + Math.round((h - sprite.h) / 2) + sprite.ay);
}

export function meter(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, fraction: number, color: string): void {
  const clamped = Math.max(0, Math.min(1, fraction));
  ctx.fillStyle = METER_TRACK;
  ctx.fillRect(x, y, w, METER_H);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, Math.round(w * clamped), METER_H);
}

const ARROW_ROWS: Readonly<Record<PadArrow, readonly string[]>> = {
  up: ['..#..', '.###.', '#####', '..#..', '..#..'],
  down: ['..#..', '..#..', '#####', '.###.', '..#..'],
  left: ['..#..', '.#...', '#####', '.#...', '..#..'],
  right: ['..#..', '...#.', '#####', '...#.', '..#..'],
};
const ARROW_SIZE = 5;

/** A D-pad arrow drawn pixel by pixel, so it reads the same in the bitmap font as in the art. */
export function drawArrow(ctx: CanvasRenderingContext2D, arrow: PadArrow, x: number, y: number, color: string): void {
  ctx.fillStyle = color;
  ARROW_ROWS[arrow].forEach((row, dy) => {
    [...row].forEach((cell, dx) => {
      if (cell === '#') ctx.fillRect(x + dx, y + dy, 1, 1);
    });
  });
}

/** The width a hotkey tag takes: its letter, and for a D-pad direction the arrow after it. */
export function hotkeyWidth(hotkey: Hotkey): number {
  const arrowWidth = hotkey.arrow ? ARROW_SIZE + 1 : 0;
  return textWidth(hotkey.text) + arrowWidth;
}

/** A hotkey printed at (x, y) in a row of height `h`: "H", or "D" with an arrow. Returns its width. */
export function drawHotkey(ctx: CanvasRenderingContext2D, hotkey: Hotkey, x: number, y: number, h: number, color: string): number {
  const textY = y + Math.round((h - FONT_HEIGHT) / 2);
  drawText(ctx, hotkey.text, x, textY, color);
  if (hotkey.arrow) {
    const arrowY = y + Math.round((h - ARROW_SIZE) / 2);
    drawArrow(ctx, hotkey.arrow, x + textWidth(hotkey.text) + 1, arrowY, color);
  }
  return hotkeyWidth(hotkey);
}

/** Word-wraps text to a width in buffer pixels. A word longer than the width gets a line of its own. */
export function wrapText(text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const candidate = line === '' ? word : `${line} ${word}`;
    if (textWidth(candidate) <= maxWidth || line === '') line = candidate;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line !== '') lines.push(line);
  return lines;
}

/** The height of a panel holding that many lines. */
export function centredHeight(lineCount: number): number {
  return lineCount * (FONT_HEIGHT + LINE_GAP) - LINE_GAP + PAD * 2;
}

/** A panel holding one run of lines, centred on `cx`, with the lines stacked from `y`. Returns its height. */
export function drawCentredLines(ctx: CanvasRenderingContext2D, lines: readonly TextLine[], cx: number, y: number): number {
  if (lines.length === 0) return 0;
  const lineH = FONT_HEIGHT + LINE_GAP;
  const w = Math.max(...lines.map((line) => textWidth(line.text))) + PAD * 2;
  const h = centredHeight(lines.length);
  const x = Math.round(cx - w / 2);
  panel(ctx, x, y, w, h);
  lines.forEach((line, index) => {
    drawText(ctx, line.text, Math.round(cx - textWidth(line.text) / 2), y + PAD + index * lineH, line.color);
  });
  return h;
}
