import { backDoorBox, partitionBoxes } from './building-plans.ts';
import { settleVan } from './exit-van.ts';
import type { Point } from './flow-field.ts';
import { isStorey, voidBoxes } from './storeys.ts';
import { BUILDING_DEFS, DOOR_WIDTH, PROP_DEFS, TILE_SIZE, WALL_THICKNESS } from './protocol.ts';
import type { BuildingInstance, PropInstance, WorldMap } from './protocol.ts';

export interface Box {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

interface SolidIndex {
  /** Boxes touching each tile, row-major. */
  readonly buckets: readonly (readonly Box[])[];
  /** 1 where any solid overlaps the tile. Flow fields and spawning treat these as walls. */
  readonly blocked: Uint8Array;
}

const NO_BOXES: readonly Box[] = [];
const indexes = new WeakMap<WorldMap, SolidIndex>();
const walls = new WeakMap<readonly BuildingInstance[], readonly Box[]>();
const footprints = new WeakMap<readonly BuildingInstance[], Int32Array>();

export function propBox(prop: PropInstance): Box {
  const def = PROP_DEFS[prop.kind];
  return { x0: prop.x - def.w / 2, y0: prop.y - def.h, x1: prop.x + def.w / 2, y1: prop.y };
}

export function isSolidProp(prop: PropInstance): boolean {
  return PROP_DEFS[prop.kind].h > 0;
}

/** The whole footprint, walls included. */
export function buildingBox(building: BuildingInstance): Box {
  const { w, h } = BUILDING_DEFS[building.kind];
  return { x0: building.x, y0: building.y, x1: building.x + w, y1: building.y + h };
}

/** The opening in the south wall. */
export function doorBox(building: BuildingInstance): Box {
  const { doorX, h } = BUILDING_DEFS[building.kind];
  const left = building.x + doorX - DOOR_WIDTH / 2;
  return { x0: left, y0: building.y + h - WALL_THICKNESS, x1: left + DOOR_WIDTH, y1: building.y + h };
}

/** The north wall, in one piece or either side of a back door. */
function northWall(building: BuildingInstance, x0: number, y0: number, x1: number): Box[] {
  const back = backDoorBox(building);
  const y1 = y0 + WALL_THICKNESS;
  if (!back) return [{ x0, y0, x1, y1 }];
  return [{ x0, y0, x1: back.x0, y1 }, { x0: back.x1, y0, x1, y1 }];
}

/** A floor above or below has no door of its own: its stairs are the way in. */
function closedWalls(building: BuildingInstance): Box[] {
  const { x0, y0, x1, y1 } = buildingBox(building);
  return [
    { x0, y0, x1, y1: y0 + WALL_THICKNESS },
    { x0, y0, x1: x0 + WALL_THICKNESS, y1 },
    { x0: x1 - WALL_THICKNESS, y0, x1, y1 },
    { x0, y0: y1 - WALL_THICKNESS, x1, y1 },
    ...partitionBoxes(building),
  ];
}

function wallsOf(building: BuildingInstance): Box[] {
  if (isStorey(building)) return closedWalls(building);
  const { x0, y0, x1, y1 } = buildingBox(building);
  const door = doorBox(building);
  return [
    ...northWall(building, x0, y0, x1),
    { x0, y0, x1: x0 + WALL_THICKNESS, y1 },
    { x0: x1 - WALL_THICKNESS, y0, x1, y1 },
    { x0, y0: door.y0, x1: door.x0, y1 },
    { x0: door.x1, y0: door.y0, x1, y1 },
    ...partitionBoxes(building),
  ];
}

/** Every wall of every building, with the door gaps left out, or the map's own walls if it has them. Shared, do not write to it. */
export function wallBoxes(map: Pick<WorldMap, 'buildings' | 'walls'>): readonly Box[] {
  if (map.walls) return map.walls;
  const cached = walls.get(map.buildings);
  if (cached) return cached;
  const boxes = map.buildings.flatMap(wallsOf);
  walls.set(map.buildings, boxes);
  return boxes;
}

function footprintIndex(map: WorldMap): Int32Array {
  const cached = footprints.get(map.buildings);
  if (cached) return cached;
  const owners = new Int32Array(map.cols * map.rows).fill(-1);
  map.buildings.forEach((building, index) => {
    const { x0, y0, x1, y1 } = buildingBox(building);
    for (let row = y0 / TILE_SIZE; row < y1 / TILE_SIZE; row++) {
      for (let col = x0 / TILE_SIZE; col < x1 / TILE_SIZE; col++) owners[row * map.cols + col] = index;
    }
  });
  footprints.set(map.buildings, owners);
  return owners;
}

/** The building whose footprint holds this point, door gap included, or null outdoors. */
export function buildingAt(map: WorldMap, x: number, y: number): BuildingInstance | null {
  const col = Math.floor(x / TILE_SIZE);
  const row = Math.floor(y / TILE_SIZE);
  const isOffGrid = col < 0 || row < 0 || col >= map.cols || row >= map.rows;
  if (isOffGrid) return null;
  const owner = footprintIndex(map)[row * map.cols + col];
  return owner < 0 ? null : map.buildings[owner];
}

/**
 * Where a point stands in the town's own plan: on a floor above or below, the same spot in the house it
 * belongs to. Distances that ignore walls, such as hearing and dozing off, are measured between these.
 */
export function groundOf(map: WorldMap, x: number, y: number): Point {
  const here = isBelowTown(map, y) ? buildingAt(map, x, y) : null;
  const house = here?.of === undefined ? null : map.buildings.find((building) => building.id === here.of);
  return house && here ? { x: house.x + x - here.x, y: house.y + y - here.y } : { x, y };
}

function isBelowTown(map: WorldMap, y: number): boolean {
  return map.townRows !== undefined && y >= map.townRows * TILE_SIZE;
}

function solidIndex(map: WorldMap): SolidIndex {
  const cached = indexes.get(map);
  if (cached) return cached;

  // Most tiles are open, so they all share one empty list until something lands on them.
  const buckets = new Array<readonly Box[]>(map.cols * map.rows).fill(NO_BOXES);
  const blocked = new Uint8Array(map.cols * map.rows);
  const addBox = (box: Box): void => {
    const minCol = Math.max(0, Math.floor(box.x0 / TILE_SIZE));
    const maxCol = Math.min(map.cols - 1, Math.ceil(box.x1 / TILE_SIZE) - 1);
    const minRow = Math.max(0, Math.floor(box.y0 / TILE_SIZE));
    const maxRow = Math.min(map.rows - 1, Math.ceil(box.y1 / TILE_SIZE) - 1);
    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        const index = row * map.cols + col;
        buckets[index] = buckets[index] === NO_BOXES ? [box] : [...buckets[index], box];
        blocked[index] = 1;
      }
    }
  };
  for (const prop of map.props) {
    if (isSolidProp(prop)) addBox(propBox(prop));
  }
  for (const wall of wallBoxes(map)) addBox(wall);
  for (const dark of voidBoxes(map, buildingBox)) addBox(dark);
  const index: SolidIndex = { buckets, blocked };
  // Settling the van's spot reads these solids, so they are cached first and the van joins them after.
  indexes.set(map, index);
  const van = settleVan(map);
  if (van) addBox(van);
  return index;
}

/** Row-major, 1 where a solid overlaps the tile. Shared, do not write to it. */
export function blockedTiles(map: WorldMap): Uint8Array {
  return solidIndex(map).blocked;
}

export function isBlockedAt(map: WorldMap, x: number, y: number): boolean {
  const col = Math.floor(x / TILE_SIZE);
  const row = Math.floor(y / TILE_SIZE);
  const isOffGrid = col < 0 || row < 0 || col >= map.cols || row >= map.rows;
  if (isOffGrid) return true;
  return solidIndex(map).blocked[row * map.cols + col] === 1;
}

export function circleHitsSolid(map: WorldMap, x: number, y: number, r: number): boolean {
  const { buckets } = solidIndex(map);
  const minCol = Math.max(0, Math.floor((x - r) / TILE_SIZE));
  const maxCol = Math.min(map.cols - 1, Math.floor((x + r) / TILE_SIZE));
  const minRow = Math.max(0, Math.floor((y - r) / TILE_SIZE));
  const maxRow = Math.min(map.rows - 1, Math.floor((y + r) / TILE_SIZE));
  const r2 = r * r;

  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      for (const box of buckets[row * map.cols + col]) {
        const dx = x - Math.max(box.x0, Math.min(x, box.x1));
        const dy = y - Math.max(box.y0, Math.min(y, box.y1));
        const isTouching = dx * dx + dy * dy < r2;
        if (isTouching) return true;
      }
    }
  }
  return false;
}

/** Slab test: fraction of the segment at which it enters the box, or Infinity. */
function segmentEntersBox(box: Box, x0: number, y0: number, dx: number, dy: number): number {
  let tMin = 0;
  let tMax = 1;
  const isVertical = dx === 0;
  if (isVertical) {
    const missesSideways = x0 < box.x0 || x0 > box.x1;
    if (missesSideways) return Infinity;
  } else {
    const a = (box.x0 - x0) / dx;
    const b = (box.x1 - x0) / dx;
    tMin = Math.max(tMin, Math.min(a, b));
    tMax = Math.min(tMax, Math.max(a, b));
  }
  const isHorizontal = dy === 0;
  if (isHorizontal) {
    const missesVertically = y0 < box.y0 || y0 > box.y1;
    if (missesVertically) return Infinity;
  } else {
    const a = (box.y0 - y0) / dy;
    const b = (box.y1 - y0) / dy;
    tMin = Math.max(tMin, Math.min(a, b));
    tMax = Math.min(tMax, Math.max(a, b));
  }
  return tMin <= tMax ? tMin : Infinity;
}

/** First point where the segment enters a solid, walking the tile grid so length costs nothing extra. */
export function segmentHitsSolid(
  map: WorldMap,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): { x: number; y: number } | null {
  const { buckets } = solidIndex(map);
  const dx = x1 - x0;
  const dy = y1 - y0;
  let col = Math.floor(x0 / TILE_SIZE);
  let row = Math.floor(y0 / TILE_SIZE);
  const stepCol = dx > 0 ? 1 : -1;
  const stepRow = dy > 0 ? 1 : -1;
  const deltaX = dx === 0 ? Infinity : TILE_SIZE / Math.abs(dx);
  const deltaY = dy === 0 ? Infinity : TILE_SIZE / Math.abs(dy);
  let nextX = dx === 0 ? Infinity : ((col + (dx > 0 ? 1 : 0)) * TILE_SIZE - x0) / dx;
  let nextY = dy === 0 ? Infinity : ((row + (dy > 0 ? 1 : 0)) * TILE_SIZE - y0) / dy;
  let best = Infinity;

  for (;;) {
    const isOnGrid = col >= 0 && row >= 0 && col < map.cols && row < map.rows;
    if (isOnGrid) {
      for (const box of buckets[row * map.cols + col]) {
        const t = segmentEntersBox(box, x0, y0, dx, dy);
        const isNearerHit = t < best;
        if (isNearerHit) best = t;
      }
    }
    const exit = Math.min(nextX, nextY);
    const isDone = best <= exit || exit >= 1;
    if (isDone) break;
    const crossesColumnFirst = nextX < nextY;
    if (crossesColumnFirst) {
      nextX += deltaX;
      col += stepCol;
    } else {
      nextY += deltaY;
      row += stepRow;
    }
  }
  return best <= 1 ? { x: x0 + dx * best, y: y0 + dy * best } : null;
}
