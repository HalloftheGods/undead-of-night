// Where a car may be: the one rule the sim and the client's prediction share, so they cannot drift apart.

import { circleHitsSolid, buildingAt } from './world-query.ts';
import type { WorldMap } from './protocol.ts';

/** True when a closed or boarded door is in the circle's way; each side supplies its own door state. */
export type DoorBlocks = (x: number, y: number, r: number) => boolean;

/** A car may stand here: open ground or inside an Auto Garage. Every other building refuses cars. */
export function carMayStandAt(map: WorldMap, x: number, y: number): boolean {
  const building = buildingAt(map, x, y);
  return building === null || building.kind === 'garage';
}

/** Any of the circle's centre or edge points inside a building that is not a garage: a car never noses into a house. */
export function touchesForbiddenBuilding(map: WorldMap, x: number, y: number, r: number): boolean {
  const points: ReadonlyArray<readonly [number, number]> = [[x, y], [x - r, y], [x + r, y], [x, y - r], [x, y + r]];
  return points.some(([px, py]) => !carMayStandAt(map, px, py));
}

/** What a car cannot drive into: the map's edge, any other building, solids (garage walls included) and doors that are shut. */
export function carBlockedAt(map: WorldMap, x: number, y: number, r: number, doorBlocks: DoorBlocks): boolean {
  const offMap = x < r || y < r || x > map.width - r || y > map.height - r;
  if (offMap) return true;
  return touchesForbiddenBuilding(map, x, y, r) || circleHitsSolid(map, x, y, r) || doorBlocks(x, y, r);
}
