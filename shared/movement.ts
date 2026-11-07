import type { WorldMap } from './protocol.ts';
import { circleHitsSolid } from './world-query.ts';

/** Small enough that stopping distance from a wall barely depends on the frame rate. */
const MAX_SUBSTEP = 1;

/**
 * Moves a circle along a direction at a fixed speed, sliding along solids one
 * axis at a time. The client's prediction and the sim both run this, so any
 * change here changes both.
 */
export function stepMovement(
  map: WorldMap,
  x: number,
  y: number,
  dirX: number,
  dirY: number,
  speed: number,
  dt: number,
  radius: number,
): { x: number; y: number } {
  const length = Math.hypot(dirX, dirY);
  const isStill = !(length > 0) || !(speed > 0) || !(dt > 0);
  if (isStill) return { x, y };

  const distance = speed * dt;
  const steps = Math.ceil(distance / MAX_SUBSTEP);
  const stepX = ((dirX / length) * distance) / steps;
  const stepY = ((dirY / length) * distance) / steps;
  const maxX = map.width - radius;
  const maxY = map.height - radius;
  let px = x;
  let py = y;

  for (let i = 0; i < steps; i++) {
    const movesSideways = stepX !== 0;
    if (movesSideways) {
      const nx = Math.min(maxX, Math.max(radius, px + stepX));
      const isSideClear = !circleHitsSolid(map, nx, py, radius);
      if (isSideClear) px = nx;
    }
    const movesVertically = stepY !== 0;
    if (movesVertically) {
      const ny = Math.min(maxY, Math.max(radius, py + stepY));
      const isVerticalClear = !circleHitsSolid(map, px, ny, radius);
      if (isVerticalClear) py = ny;
    }
  }
  return { x: px, y: py };
}
