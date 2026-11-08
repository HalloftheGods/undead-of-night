// A teammate on the map screen: a ping that keeps rippling out from them, a blinking dot and their
// name, all in their team colour, so a room can find each other at a glance.

import { displayName } from '../../shared/callsign.ts';
import type { PlayerEntity } from '../../shared/protocol.ts';
import { drawOutlinedText, FONT_HEIGHT, textWidth } from '../engine/bitmap-font.ts';
import { BLINK_HZ, blinkPhase } from './map-cursor.ts';
import type { CursorClock, MapSize } from './map-cursor.ts';
import { teamColor, teamDimColor } from './team-colors.ts';

const INK = '#0b0c10';
const DOWN_COLOR = '#e0463a';
const PING_PERIOD_MS = 1000 / BLINK_HZ;
/** The ping grows from just outside the dot to this far out, in map pixels, then starts again. */
const PING_MIN = 4;
const PING_MAX = 11;
/** Where the ring rests for someone who asked for less motion. */
const PING_STILL = 6;
const DOT_HALF = 2;
const LABEL_GAP = 4;
const LABEL_MARGIN = 2;

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

/** The name's top edge: above the marker, or below it when above would leave the map. */
export function teammateLabelTop(y: number, mapHeight: number): number {
  const above = y - PING_STILL - LABEL_GAP - FONT_HEIGHT;
  const fitsAbove = above >= LABEL_MARGIN;
  const top = fitsAbove ? above : y + PING_STILL + LABEL_GAP;
  return Math.min(top, mapHeight - FONT_HEIGHT - LABEL_MARGIN);
}

/** The name's centre, pulled in so the whole name stays on the map. */
export function teammateLabelCenter(x: number, labelWidth: number, mapWidth: number): number {
  const half = Math.ceil(labelWidth / 2);
  return Math.max(LABEL_MARGIN + half, Math.min(x, mapWidth - LABEL_MARGIN - half));
}

/** Where DOWN goes: on the side of the marker the name left free, or over the name at the map's foot. */
export function teammateDownTop(y: number, nameTop: number, mapHeight: number): number {
  const isNameAbove = nameTop < y;
  const below = isNameAbove ? y + PING_STILL + LABEL_GAP : nameTop + FONT_HEIGHT + LABEL_GAP;
  const fitsBelow = below + FONT_HEIGHT + LABEL_MARGIN <= mapHeight;
  return fitsBelow ? below : nameTop - FONT_HEIGHT - LABEL_GAP;
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

/** Draws one teammate's locator at map pixel (x, y). */
export function drawTeammateLocator(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  player: Pick<PlayerEntity, 'name' | 'skin' | 'status'>,
  clock: CursorClock,
  size: MapSize,
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
  const text = teammateLabel(player);
  const top = teammateLabelTop(y, size.height);
  drawOutlinedText(ctx, text, teammateLabelCenter(x, textWidth(text), size.width), top, color, INK);
  if (!isDown) return;
  const downTop = teammateDownTop(y, top, size.height);
  drawOutlinedText(ctx, 'DOWN', teammateLabelCenter(x, textWidth('DOWN'), size.width), downTop, DOWN_COLOR, INK);
}
