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
  // Out the back of the hospital's supply room, and of the school's gym.
  hospital: 64,
  school: 64,
  police: 128,
  garage: 64,
  warehouse: 160,
  grocery: 176,
};

const T = WALL_THICKNESS;

/** A hall from the front door to the back, with a flat on each side through a doorway. */
const APARTMENT_HALL: readonly Rect[] = [
  { x0: 58, y0: T, x1: 64, y1: 48 },
  { x0: 58, y0: 80, x1: 64, y1: 90 },
  { x0: 96, y0: T, x1: 102, y1: 48 },
  { x0: 96, y0: 80, x1: 102, y1: 90 },
];

/** A wall along a corridor at `y`, solid over each span and open in the doorways between them. */
function corridorWall(y: number, spans: readonly (readonly [number, number])[]): Rect[] {
  return spans.map(([x0, x1]) => ({ x0, y0: y, x1, y1: y + T }));
}

/** Walls between rooms off a corridor, from `y0` to `y1`, at each `x`. */
function roomWalls(xs: readonly number[], y0: number, y1: number): Rect[] {
  return xs.map((x) => ({ x0: x, y0, x1: x + T, y1 }));
}

/**
 * The hospital's ground floor: a corridor from the stairs at the west end to the east wall. Along the
 * back, the supply room (out the back door), the operating room and two exam rooms. Along the front,
 * imaging, the lobby with reception straight in from the front door, and the emergency bay.
 */
const HOSPITAL_FLOOR: readonly Rect[] = [
  ...corridorWall(74, [[T, 64], [96, 144], [176, 224], [256, 272], [304, 314]]),
  ...roomWalls([106, 208, 256], T, 74),
  ...corridorWall(128, [[T, 48], [80, 144], [176, 240], [272, 314]]),
  ...roomWalls([96, 218], 134, 186),
];

/** The wards upstairs: four patient rooms each side of the same corridor. */
const HOSPITAL_WARDS: readonly Rect[] = [
  ...corridorWall(74, [[T, 32], [64, 112], [144, 192], [224, 272], [304, 314]]),
  ...roomWalls([80, 160, 240], T, 74),
  ...corridorWall(128, [[T, 32], [64, 112], [144, 192], [224, 272], [304, 314]]),
  ...roomWalls([80, 160, 240], 134, 186),
];

/**
 * The school's ground floor: the main hall runs the width of it, lined with lockers. The gym (out the
 * back door) and two classrooms open off the back of it; the office, the entrance lobby from the front
 * door and the cafeteria off the front.
 */
const SCHOOL_FLOOR: readonly Rect[] = [
  ...corridorWall(58, [[T, 96], [128, 160], [192, 224], [256, 282]]),
  ...roomWalls([138, 208], T, 58),
  ...corridorWall(112, [[T, 64], [96, 128], [160, 176], [208, 282]]),
  ...roomWalls([112, 170], 118, 170),
];

/** Upstairs, the same hall: two classrooms and the science lab along the back, the library and a classroom along the front. */
const SCHOOL_UPSTAIRS: readonly Rect[] = [
  ...corridorWall(58, [[T, 32], [64, 128], [160, 224], [256, 282]]),
  ...roomWalls([96, 186], T, 58),
  ...corridorWall(112, [[T, 64], [96, 192], [224, 282]]),
  ...roomWalls([138], 118, 170),
];

/**
 * Inside walls. Every doorway between them is a door wide, so a brute can follow anyone through,
 * and lines up with the tile grid for the same reason as the back doors.
 */
export const PARTITIONS: Readonly<Partial<Record<BuildingKind, readonly Rect[]>>> = {
  // A bedroom on the west and a kitchen with the back door on the east, both opening onto the living room.
  // A house with a floor above or below leaves this wall out: see `partitionsOf`. The floor above is one room.
  house: [{ x0: 54, y0: T, x1: 54 + T, y1: 56 }],
  // A hall from the front door to the back, with a room on each side through a doorway.
  apartment: APARTMENT_HALL,
  // The floor above is one open floor. The hall below runs from the front door to the back door; up here there is
  // neither, so the same walls were a dead-end corridor and two stubs to snag on. The furniture sets the flats apart.
  apartment_upstairs: [],
  hospital: HOSPITAL_FLOOR,
  hospital_upstairs: HOSPITAL_WARDS,
  school: SCHOOL_FLOOR,
  school_upstairs: SCHOOL_UPSTAIRS,
};

/** The opening in the north wall, in the world, or null for a building without one. */
export function backDoorBox(building: BuildingInstance): Rect | null {
  const middle = BACK_DOORS[building.kind];
  const hasNoBackDoor = middle === undefined;
  if (hasNoBackDoor) return null;
  const x0 = building.x + middle - DOOR_WIDTH / 2;
  return { x0, y0: building.y, x1: x0 + DOOR_WIDTH, y1: building.y + WALL_THICKNESS };
}

/** Kinds that are one open room when their stairs lead somewhere, the stairs standing in the wall's corner. */
const OPEN_WITH_STAIRS: ReadonlySet<BuildingKind> = new Set(['house']);

/** The inside walls of a kind, from its footprint's top left, with or without a flight of stairs in it. */
export function partitionsOf(kind: BuildingKind, hasStairs: boolean): readonly Rect[] {
  const openPlan = hasStairs && OPEN_WITH_STAIRS.has(kind);
  return openPlan ? [] : PARTITIONS[kind] ?? [];
}

/** The inside walls, in the world. */
export function partitionBoxes(building: BuildingInstance, hasStairs = false): Rect[] {
  const inside = partitionsOf(building.kind, hasStairs);
  return inside.map((r) => ({ x0: building.x + r.x0, y0: building.y + r.y0, x1: building.x + r.x1, y1: building.y + r.y1 }));
}
