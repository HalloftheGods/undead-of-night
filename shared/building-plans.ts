// What a building is besides its four walls: a back door in the north wall for some, and inside walls that
// split a home into rooms. Both are per kind, so every house in every town is built the same way, and both
// are walls like any other: they block bodies, bullets and sight, and the flow fields route around them.

import { DOOR_WIDTH, WALL_THICKNESS } from './protocol.ts';
import type { BuildingInstance, BuildingKind } from './protocol.ts';

/** Pixels from a footprint's top left corner. */
interface Rect {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

/**
 * The middle of each back door, from the footprint's left. A door spans whole tiles, so the flow
 * fields see it open: the middle sits on a tile edge. Shops that keep their back walls lined with
 * shelves, and the gun shop, which would rather not have one, are left without.
 */
export const BACK_DOORS: Readonly<Partial<Record<BuildingKind, number>>> = {
  house: 80,
  apartment: 80,
  clinic: 48,
  police: 128,
  garage: 64,
  warehouse: 160,
  grocery: 176,
};

const T = WALL_THICKNESS;

/** A hall from the front door to the back, with a flat on each side through a doorway. The floor above has the same. */
const APARTMENT_HALL: readonly Rect[] = [
  { x0: 58, y0: T, x1: 64, y1: 48 },
  { x0: 58, y0: 80, x1: 64, y1: 90 },
  { x0: 96, y0: T, x1: 102, y1: 48 },
  { x0: 96, y0: 80, x1: 102, y1: 90 },
];

/**
 * Inside walls. Every doorway between them is a door wide, so a brute can follow anyone through,
 * and lines up with the tile grid for the same reason as the back doors.
 */
export const PARTITIONS: Readonly<Partial<Record<BuildingKind, readonly Rect[]>>> = {
  // A bedroom on the west and a kitchen with the back door on the east, both opening onto the living room.
  house: [{ x0: 54, y0: T, x1: 54 + T, y1: 56 }],
  upstairs: [{ x0: 54, y0: T, x1: 54 + T, y1: 56 }],
  // A hall from the front door to the back, with a room on each side through a doorway.
  apartment: APARTMENT_HALL,
  apartment_upstairs: APARTMENT_HALL,
};

/** The opening in the north wall, in the world, or null for a building without one. */
export function backDoorBox(building: BuildingInstance): Rect | null {
  const middle = BACK_DOORS[building.kind];
  const hasNoBackDoor = middle === undefined;
  if (hasNoBackDoor) return null;
  const x0 = building.x + middle - DOOR_WIDTH / 2;
  return { x0, y0: building.y, x1: x0 + DOOR_WIDTH, y1: building.y + WALL_THICKNESS };
}

/** The inside walls, in the world. */
export function partitionBoxes(building: BuildingInstance): Rect[] {
  const inside = PARTITIONS[building.kind] ?? [];
  return inside.map((r) => ({ x0: building.x + r.x0, y0: building.y + r.y0, x1: building.x + r.x1, y1: building.y + r.y1 }));
}
