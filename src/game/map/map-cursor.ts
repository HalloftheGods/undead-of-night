// The "You are here" cursor on the map screen: a blinking target around the local player that reads on every biome's colours.

import { dirFromAngle } from '@art/types.ts';
import { drawOutlinedText, FONT_HEIGHT, textWidth } from '@engine/bitmap-font.ts';
import { drawArrow } from '@engine/overlay-renderer.ts';

/** The cursor's colour, and the swatch for it in the key. */
export const CURSOR_COLOR = '#62c9ff';
/** The same colour with the light turned down, for the off beat of the blink. Still plainly visible. */
export const CURSOR_DIM_COLOR = '#3a86a8';
const CURSOR_INK = '#0b0c10';
const ARROW_BRIGHT = '#ffffff';

export const BLINK_HZ = 1.5;
const BLINK_PERIOD_MS = 1000 / BLINK_HZ;
/** Share of each beat spent bright; the rest is dim, never gone. */
const BRIGHT_SHARE = 0.62;
/** How long the long label stays up after the map opens. */
export const LONG_LABEL_MS = 5000;

/** Half the side of the target, in map pixels, and the length and thickness of each corner bracket. */
const HALF = 10;
const ARM = 6;
const THICK = 2;
/** Space between the target and its label. */
const LABEL_GAP = HALF + 4;
const LABEL_MARGIN = 2;

export type BlinkPhase = 'bright' | 'dim';

/** Which half of the beat it is. Someone who asked for less motion gets the bright half always. */
export function blinkPhase(nowMs: number, reducedMotion: boolean): BlinkPhase {
  if (reducedMotion) return 'bright';
  const beat = (((nowMs % BLINK_PERIOD_MS) + BLINK_PERIOD_MS) % BLINK_PERIOD_MS) / BLINK_PERIOD_MS;
  return beat < BRIGHT_SHARE ? 'bright' : 'dim';
}

/** The words beside the cursor: the full sentence while the map is new, then just YOU. */
export function cursorLabel(sinceOpenedMs: number): string {
  return sinceOpenedMs < LONG_LABEL_MS ? 'YOU ARE HERE' : 'YOU';
}

export interface LabelSpot {
  readonly left: number;
  readonly top: number;
  readonly side: 'right' | 'left';
}

/** Where the label sits: right of the cursor, or left of it when the right would run off the map. Always inside the map. */
export function labelSpot(x: number, y: number, labelWidth: number, mapWidth: number, mapHeight: number): LabelSpot {
  const rightStart = x + LABEL_GAP;
  const fitsRight = rightStart + labelWidth <= mapWidth - LABEL_MARGIN;
  const wanted = fitsRight ? rightStart : x - LABEL_GAP - labelWidth;
  const left = Math.max(LABEL_MARGIN, Math.min(wanted, mapWidth - labelWidth - LABEL_MARGIN));
  const top = Math.max(LABEL_MARGIN, Math.min(Math.round(y - FONT_HEIGHT / 2), mapHeight - FONT_HEIGHT - LABEL_MARGIN));
  return { left, top, side: fitsRight ? 'right' : 'left' };
}

type Rect = readonly [x: number, y: number, w: number, h: number];

/** Four corner brackets around the centre, as rectangles relative to it. */
export function bracketRects(): readonly Rect[] {
  const rects: Rect[] = [];
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      const x0 = sx < 0 ? -HALF : HALF - THICK + 1;
      const y0 = sy < 0 ? -HALF : HALF - THICK + 1;
      const armX = sx < 0 ? -HALF : HALF - ARM + 1;
      const armY = sy < 0 ? -HALF : HALF - ARM + 1;
      rects.push([armX, y0, ARM, THICK], [x0, armY, THICK, ARM]);
    }
  }
  return rects;
}

export interface CursorClock {
  readonly nowMs: number;
  /** When the map screen opened, on the same clock. */
  readonly openedMs: number;
  readonly reducedMotion: boolean;
}

export interface MapSize {
  readonly width: number;
  readonly height: number;
}

/** Draws the cursor and its label for the local player at map pixel (x, y). */
export function drawCursor(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, clock: CursorClock, size: MapSize): void {
  const bright = blinkPhase(clock.nowMs, clock.reducedMotion) === 'bright';
  const color = bright ? CURSOR_COLOR : CURSOR_DIM_COLOR;
  const rects = bracketRects();
  ctx.fillStyle = CURSOR_INK;
  for (const [rx, ry, w, h] of rects) ctx.fillRect(x + rx - 1, y + ry - 1, w + 2, h + 2);
  ctx.fillStyle = color;
  for (const [rx, ry, w, h] of rects) ctx.fillRect(x + rx, y + ry, w, h);
  drawArrow(ctx, { x, y, dir: dirFromAngle(angle) }, bright ? ARROW_BRIGHT : color);

  const text = cursorLabel(clock.nowMs - clock.openedMs);
  const width = textWidth(text);
  const spot = labelSpot(x, y, width, size.width, size.height);
  drawOutlinedText(ctx, text, spot.left + width / 2, spot.top, color, CURSOR_INK);
}
