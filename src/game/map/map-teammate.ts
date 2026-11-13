// A teammate on the map screen: a ping that keeps rippling out from them, a blinking dot and their
// name, all in their team colour, so a room can find each other at a glance.

import { displayName } from '@shared/callsign.ts';
import type { PlayerEntity } from '@shared/protocol.ts';
import { drawOutlinedText, FONT_HEIGHT, textWidth } from '@engine/bitmap-font.ts';
import { BLINK_HZ, blinkPhase } from './map-cursor.ts';
import type { CursorClock, MapSize } from './map-cursor.ts';
import { teamColor, teamDimColor } from '@game/team-colors.ts';

const INK = '#0b0c10';
export const DOWN_COLOR = '#e0463a';
const PING_PERIOD_MS = 1000 / BLINK_HZ;
/** The ping grows from just outside the dot to this far out, in map pixels, then starts again. */
const PING_MIN = 4;
const PING_MAX = 11;
/** Where the ring rests for someone who asked for less motion. */
const PING_STILL = 6;
const DOT_HALF = 2;
const LABEL_GAP = 4;
const LABEL_MARGIN = 2;
/** A downed teammate's name is followed on the same row by this, in red. */
export const DOWN_WORD = 'DOWN';
const WORD_GAP = 4;

/** What the map writes beside a teammate: their callsign, or their survivor's name in a public room. */
export function teammateLabel(player: Pick<PlayerEntity, 'name' | 'skin'>): string {
  return displayName(player.name, player.skin).toUpperCase();
}

/** How far out the ping has spread right now: a steady ring when motion is turned down. */
export function pingRadius(nowMs: number, reducedMotion: boolean): number {
  if (reducedMotion) return PING_STILL;
  const beat = (((nowMs % PING_PERIOD_MS) + PING_PERIOD_MS) % PING_PERIOD_MS) / PING_PERIOD_MS;
  return Math.round(PING_MIN + (PING_MAX - PING_MIN) * beat);
}

/** A label's footprint on the map, so later labels can keep off it. */
export interface LabelBox {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

export interface LabelSpot {
  /** Left edge of the label row. */
  readonly left: number;
  readonly top: number;
}

/** Rows a name may sit on, nearest first: above the marker, below it, then further out on each side. */
const ROW_STEP = FONT_HEIGHT + 3;
const ROW_TRIES = 3;

function boxesMeet(a: LabelBox, b: LabelBox): boolean {
  return a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
}

/**
 * Where a teammate's label row goes: the nearest row around the marker that stays on the map and
 * keeps off every label already in `taken`, which it then joins. With nowhere clear, the nearest row on the map.
 */
export function teammateLabelSpot(x: number, y: number, labelWidth: number, size: MapSize, taken: LabelBox[]): LabelSpot {
  const left = Math.max(LABEL_MARGIN, Math.min(Math.round(x - labelWidth / 2), size.width - LABEL_MARGIN - labelWidth));
  const above = y - PING_STILL - LABEL_GAP - FONT_HEIGHT;
  const below = y + PING_STILL + LABEL_GAP;
  const rows: number[] = [];
  for (let step = 0; step < ROW_TRIES; step += 1) rows.push(above - step * ROW_STEP, below + step * ROW_STEP);
  const onMap = rows.filter((top) => top >= LABEL_MARGIN && top + FONT_HEIGHT + LABEL_MARGIN <= size.height);
  const boxAt = (top: number): LabelBox => ({ x0: left - 1, y0: top - 1, x1: left + labelWidth + 1, y1: top + FONT_HEIGHT + 1 });
  const clear = onMap.find((top) => !taken.some((other) => boxesMeet(boxAt(top), other)));
  const top = clear ?? onMap[0] ?? Math.max(LABEL_MARGIN, Math.min(above, size.height - FONT_HEIGHT - LABEL_MARGIN));
  taken.push(boxAt(top));
  return { left, top };
}

function strokeSquare(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number): void {
  const side = radius * 2 + 1;
  ctx.fillRect(x - radius, y - radius, side, 1);
  ctx.fillRect(x - radius, y + radius, side, 1);
  ctx.fillRect(x - radius, y - radius, 1, side);
  ctx.fillRect(x + radius, y - radius, 1, side);
}

function drawPing(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string): void {
  ctx.fillStyle = INK;
  strokeSquare(ctx, x, y, radius + 1);
  strokeSquare(ctx, x, y, radius - 1);
  ctx.fillStyle = color;
  strokeSquare(ctx, x, y, radius);
}

/** Draws one teammate's locator at map pixel (x, y). Their name keeps off the labels in `taken`, and joins them. */
export function drawTeammateLocator(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  player: Pick<PlayerEntity, 'name' | 'skin' | 'status'>,
  clock: CursorClock,
  size: MapSize,
  taken: LabelBox[] = [],
): void {
  const color = teamColor(player.skin);
  const isBright = blinkPhase(clock.nowMs, clock.reducedMotion) === 'bright';
  const dotColor = isBright ? color : teamDimColor(player.skin);
  drawPing(ctx, x, y, pingRadius(clock.nowMs, clock.reducedMotion), dotColor);

  ctx.fillStyle = INK;
  ctx.fillRect(x - DOT_HALF - 1, y - DOT_HALF - 1, DOT_HALF * 2 + 3, DOT_HALF * 2 + 3);
  ctx.fillStyle = dotColor;
  ctx.fillRect(x - DOT_HALF, y - DOT_HALF, DOT_HALF * 2 + 1, DOT_HALF * 2 + 1);

  const isDown = player.status !== 'alive';
  const name = teammateLabel(player);
  const nameWidth = textWidth(name);
  const downWidth = isDown ? WORD_GAP + textWidth(DOWN_WORD) : 0;
  const spot = teammateLabelSpot(x, y, nameWidth + downWidth, size, taken);
  drawOutlinedText(ctx, name, spot.left + nameWidth / 2, spot.top, color, INK);
  if (!isDown) return;
  drawOutlinedText(ctx, DOWN_WORD, spot.left + nameWidth + WORD_GAP + textWidth(DOWN_WORD) / 2, spot.top, DOWN_COLOR, INK);
}
