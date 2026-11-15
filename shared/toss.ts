import type { WorldMap } from './protocol.ts';
import { isBlockedAt } from './world-query.ts';

export interface WorldPoint {
  readonly x: number;
  readonly y: number;
}

/** How far a survivor can toss an item along the ground, in px. */
export const TOSS_RANGE = 130;
/** The walk along a toss line, in px: fine enough that a wall a tile thick is never skipped. */
const STEP = 4;

/**
 * Where an item tossed from `from` toward `aim` comes to rest. The aim is clamped to `TOSS_RANGE` along the line, then
 * the line is walked in 4 px steps and the last walkable point before a wall or building edge is returned. Aiming at
 * your own feet lands there; a start already inside a wall lands there too.
 */
export function tossLanding(map: WorldMap, from: WorldPoint, aim: WorldPoint): WorldPoint {
  const dx = aim.x - from.x;
  const dy = aim.y - from.y;
  const dist = Math.hypot(dx, dy);
  const isAtFeet = dist < 1e-6;
  if (isAtFeet) return { x: from.x, y: from.y };
  const reach = Math.min(dist, TOSS_RANGE);
  const ux = dx / dist;
  const uy = dy / dist;
  let last = { x: from.x, y: from.y };
  for (let d = STEP; d < reach + STEP; d += STEP) {
    const at = Math.min(d, reach);
    const x = from.x + ux * at;
    const y = from.y + uy * at;
    const isWall = isBlockedAt(map, x, y);
    if (isWall) return last;
    last = { x, y };
    const isThere = at >= reach;
    if (isThere) break;
  }
  return last;
}

