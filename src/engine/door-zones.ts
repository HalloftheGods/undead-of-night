// A barely-there dotted border around the ground from which a door can be worked, shown only while the viewer
// stands in it and the key would do something there: the boundary of the door's reach, so a player can see
// how far to stay. Nothing shows on the way up to it, or at a door that has nothing left to give.

import { distanceToBox, findNearbyOpening, interactionBox, reachOf } from '../../shared/building-openings.ts';
import type { BarricadeOpening } from '../../shared/fortifications.ts';
import type { DoorChoice } from '../../shared/door-view.ts';
import { PLAYER_RADIUS } from '../../shared/constants.ts';
import { bodyTouchesDoor } from '../../shared/doors.ts';

/** The border is drawn along the edges of half-tile squares, so it steps with the grid and does not smear. */
const CELL = 8;
const BLINKS_PER_SEC = 0.9;
const BASE_ALPHA = 0.05;
const BLINK_ALPHA = 0.06;
/** The fill under a square where the door cannot be worked, and its dotted red rim is drawn at the same strength. */
const INVALID_ALPHA = 0.1;
const TINT = '255, 232, 180';
/** The zone while the player stands in the doorway itself. */
const TINT_BLOCKING = '255, 70, 70';
/** A dot is this long and the gap after it the same. */
const DOT = 2;

export interface DoorZoneView {
  readonly x: number;
  readonly y: number;
}

/**
 * The door whose zone to draw: the one the viewer stands within reach of, when the key would do something
 * there (`choice` is the game's own answer to that), and none otherwise. A door fully boarded up does nothing.
 */
export function zoneToShow(
  doors: readonly BarricadeOpening[],
  choice: DoorChoice | undefined,
  x: number,
  y: number,
  clearTo?: (opening: BarricadeOpening) => boolean,
): BarricadeOpening | null {
  const works = choice !== undefined && choice.action !== 'boarded';
  return works ? findNearbyOpening(doors, x, y, undefined, clearTo) : null;
}

/** One side of a square as a line of dots, along x when `horizontal`, else along y. */
function dots(ctx: CanvasRenderingContext2D, x: number, y: number, horizontal: boolean): void {
  for (let at = 0; at < CELL; at += DOT * 2) {
    if (horizontal) ctx.fillRect(x + at, y, DOT, 1);
    else ctx.fillRect(x, y + at, 1, DOT);
  }
}

/**
 * `walkable` says whether a point of ground can be stood on and is on the viewer's side of the wall: the border
 * runs round the ground that can be walked, so it hugs furniture and walls and never shows through a wall.
 */
export function drawDoorZone(
  ctx: CanvasRenderingContext2D,
  door: BarricadeOpening,
  left: number,
  top: number,
  time: number,
  steady: boolean,
  blocking = false,
  walkable: (x: number, y: number) => boolean = () => true,
  closing = false,
): void {
  const blink = steady ? 0.5 : 0.5 + 0.5 * Math.sin(time * Math.PI * 2 * BLINKS_PER_SEC);
  const box = interactionBox(door);
  const tint = blocking ? TINT_BLOCKING : TINT;
  const inReach = (x: number, y: number): boolean => distanceToBox(box, x + CELL / 2, y + CELL / 2) <= reachOf(door) && walkable(x + CELL / 2, y + CELL / 2);
  // A door open to be shut will not shut on a body touching it: those squares are in reach but the key does nothing there.
  const touching = (x: number, y: number): boolean => closing && bodyTouchesDoor(door, x + CELL / 2, y + CELL / 2, PLAYER_RADIUS);
  const inZone = (x: number, y: number): boolean => inReach(x, y) && !touching(x, y);
  const reach = reachOf(door);
  const x0 = Math.floor((box.x0 - reach) / CELL) * CELL;
  const x1 = Math.ceil((box.x1 + reach) / CELL) * CELL;
  const y0 = Math.floor((box.y0 - reach) / CELL) * CELL;
  const y1 = Math.ceil((box.y1 + reach) / CELL) * CELL;
  ctx.save();
  ctx.fillStyle = `rgba(${tint}, ${BASE_ALPHA + BLINK_ALPHA * blink})`;
  for (let y = y0; y < y1; y += CELL) {
    for (let x = x0; x < x1; x += CELL) {
      const sx = Math.round(x - left);
      const sy = Math.round(y - top);
      const isUnusable = inReach(x, y) && touching(x, y);
      if (isUnusable) {
        // Ground the key does nothing on: red, all the way round, so no one steps there expecting it to.
        ctx.fillStyle = `rgba(${TINT_BLOCKING}, ${INVALID_ALPHA + BLINK_ALPHA * blink})`;
        ctx.fillRect(sx, sy, CELL, CELL);
        dots(ctx, sx, sy, true);
        dots(ctx, sx, sy + CELL - 1, true);
        dots(ctx, sx, sy, false);
        dots(ctx, sx + CELL - 1, sy, false);
        ctx.fillStyle = `rgba(${tint}, ${BASE_ALPHA + BLINK_ALPHA * blink})`;
        continue;
      }
      const isOutside = !inZone(x, y);
      if (isOutside) continue;
      // Only the squares on the rim draw anything, and only along the sides that face out.
      const opensNorth = !inZone(x, y - CELL);
      const opensSouth = !inZone(x, y + CELL);
      const opensWest = !inZone(x - CELL, y);
      const opensEast = !inZone(x + CELL, y);
      if (opensNorth) dots(ctx, sx, sy, true);
      if (opensSouth) dots(ctx, sx, sy + CELL - 1, true);
      if (opensWest) dots(ctx, sx, sy, false);
      if (opensEast) dots(ctx, sx + CELL - 1, sy, false);
    }
  }
  ctx.restore();
}
