import { backDoorBox, partitionBoxes } from './building-plans.ts';
import { settleVan } from './exit-van.ts';
import type { Point } from './flow-field.ts';
import { buildingsWithStairs, isStorey, voidBoxes } from './storeys.ts';
import { BUILDING_DEFS, DOOR_WIDTH, PROP_DEFS, TILE_KINDS, TILE_SIZE, WALL_THICKNESS } from './protocol.ts';
import type { BuildingInstance, PropInstance, WorldMap } from './protocol.ts';
import { isSewerBuilding } from './map-protocol.ts';

export interface Box {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

interface SolidIndex {
  /** Boxes touching each tile, row-major. Edited in place as cars are lifted and parked. */
  readonly buckets: (readonly Box[])[];
  /** 1 where any solid overlaps the tile. Flow fields and spawning treat these as walls, and hold it by reference. */
  readonly blocked: Uint8Array;
  /** The box each solid prop put in the buckets, by its index in the map's props; null for a prop that is not solid. */
  readonly propBoxes: readonly (Box | null)[];
  /** Props taken out of the index: a parked car someone got into. */
  readonly lifted: Set<number>;
  /** Solids that come and go, by key: a car at rest. */
  readonly dynamic: Map<string, Box>;
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
  // A manhole cover is flat and a sewer ladder is bolted to a wall: each is walked up to, and used by anyone with a key to press.
  const isFitting = prop.kind === 'manhole' || prop.kind === 'sewer_ladder';
  return !isFitting && PROP_DEFS[prop.kind].h > 0;
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
function closedWalls(building: BuildingInstance, hasStairs: boolean): Box[] {
  const { x0, y0, x1, y1 } = buildingBox(building);
  return [
    { x0, y0, x1, y1: y0 + WALL_THICKNESS },
    { x0, y0, x1: x0 + WALL_THICKNESS, y1 },
    { x0: x1 - WALL_THICKNESS, y0, x1, y1 },
    { x0, y0: y1 - WALL_THICKNESS, x1, y1 },
    ...partitionBoxes(building, hasStairs),
  ];
}

function wallsOf(building: BuildingInstance, hasStairs: boolean): Box[] {
  // The sewers are walled by the dark around them, so their pieces run together into one tunnel.
  if (isSewerBuilding(building)) return [];
  if (isStorey(building)) return closedWalls(building, hasStairs);
  const { x0, y0, x1, y1 } = buildingBox(building);
  const door = doorBox(building);
  return [
    ...northWall(building, x0, y0, x1),
    { x0, y0, x1: x0 + WALL_THICKNESS, y1 },
    { x0: x1 - WALL_THICKNESS, y0, x1, y1 },
    { x0, y0: door.y0, x1: door.x0, y1 },
    { x0: door.x1, y0: door.y0, x1, y1 },
    ...partitionBoxes(building, hasStairs),
  ];
}

/** Every wall of every building, with the door gaps left out, or the map's own walls if it has them. Shared, do not write to it. */
export function wallBoxes(map: Pick<WorldMap, 'buildings' | 'walls'>): readonly Box[] {
  if (map.walls) return map.walls;
  const cached = walls.get(map.buildings);
  if (cached) return cached;
  const withStairs = buildingsWithStairs(map.buildings);
  const boxes = map.buildings.flatMap((building) => wallsOf(building, withStairs.has(building.id)));
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
  if (here && isSewerBuilding(here)) return streetAbove(map, x, y);
  const house = here?.of === undefined ? null : map.buildings.find((building) => building.id === here.of);
  return house && here ? { x: house.x + x - here.x, y: house.y + y - here.y } : { x, y };
}

/** Someone in the sewers is on the street over them: the maze lies tile for tile under the town, so noise and shots carry straight up. */
function streetAbove(map: WorldMap, x: number, y: number): Point {
  return { x, y: y - (map.sewers?.top ?? 0) * TILE_SIZE };
}

function isBelowTown(map: WorldMap, y: number): boolean {
  return map.townRows !== undefined && y >= map.townRows * TILE_SIZE;
}

/** The sewers' brick and rock, a row of tiles at a time: solid, since nothing walks through a wall. */
function rockBoxes(map: WorldMap): Box[] {
  if (!map.sewers) return [];
  const boxes: Box[] = [];
  const solid = (col: number, row: number): boolean => {
    const kind = TILE_KINDS[map.tiles[row * map.cols + col]];
    return kind === 'void' || kind === 'sewer_wall';
  };
  for (let row = map.sewers.top; row < map.rows; row++) {
    let start = -1;
    for (let col = 0; col <= map.cols; col++) {
      const isSolid = col < map.cols && solid(col, row);
      if (isSolid && start < 0) start = col;
      if (!isSolid && start >= 0) {
        boxes.push({ x0: start * TILE_SIZE, y0: row * TILE_SIZE, x1: col * TILE_SIZE, y1: (row + 1) * TILE_SIZE });
        start = -1;
      }
    }
  }
  return boxes;
}

interface TileSpan {
  readonly minCol: number;
  readonly maxCol: number;
  readonly minRow: number;
  readonly maxRow: number;
}

function tileSpan(map: WorldMap, box: Box): TileSpan {
  return {
    minCol: Math.max(0, Math.floor(box.x0 / TILE_SIZE)),
    maxCol: Math.min(map.cols - 1, Math.ceil(box.x1 / TILE_SIZE) - 1),
    minRow: Math.max(0, Math.floor(box.y0 / TILE_SIZE)),
    maxRow: Math.min(map.rows - 1, Math.ceil(box.y1 / TILE_SIZE) - 1),
  };
}

function eachTile(map: WorldMap, box: Box, visit: (index: number) => void): void {
  const { minCol, maxCol, minRow, maxRow } = tileSpan(map, box);
  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) visit(row * map.cols + col);
  }
}

function addBox(map: WorldMap, index: Pick<SolidIndex, 'buckets' | 'blocked'>, box: Box): void {
  eachTile(map, box, (tile) => {
    const bucket = index.buckets[tile];
    index.buckets[tile] = bucket === NO_BOXES ? [box] : [...bucket, box];
    index.blocked[tile] = 1;
  });
}

/** Takes one box out by identity, and re-marks each tile it touched from what is left there. */
function removeBox(map: WorldMap, index: SolidIndex, box: Box): void {
  eachTile(map, box, (tile) => {
    const left = index.buckets[tile].filter((other) => other !== box);
    index.buckets[tile] = left.length === 0 ? NO_BOXES : left;
    index.blocked[tile] = left.length === 0 ? 0 : 1;
  });
}

function solidIndex(map: WorldMap): SolidIndex {
  const cached = indexes.get(map);
  if (cached) return cached;

  // Most tiles are open, so they all share one empty list until something lands on them.
  const buckets = new Array<readonly Box[]>(map.cols * map.rows).fill(NO_BOXES);
  const blocked = new Uint8Array(map.cols * map.rows);
  const grid = { buckets, blocked };
  const propBoxes = map.props.map((prop) => (isSolidProp(prop) ? propBox(prop) : null));
  for (const box of propBoxes) {
    if (box) addBox(map, grid, box);
  }
  for (const wall of wallBoxes(map)) addBox(map, grid, wall);
  for (const dark of voidBoxes(map, buildingBox)) addBox(map, grid, dark);
  for (const rock of rockBoxes(map)) addBox(map, grid, rock);
  const index: SolidIndex = { buckets, blocked, propBoxes, lifted: new Set(), dynamic: new Map() };
  // Settling the van's spot reads these solids, so they are cached first and the van joins them after.
  indexes.set(map, index);
  const van = settleVan(map);
  if (van) addBox(map, grid, van);
  return index;
}

/** Takes a map prop out of collision, for a parked car that is now a vehicle of its own. Does nothing twice. */
export function liftProp(map: WorldMap, propIndex: number): void {
  const index = solidIndex(map);
  const box = index.propBoxes[propIndex];
  const isLiftable = box !== null && box !== undefined && !index.lifted.has(propIndex);
  if (!isLiftable) return;
  index.lifted.add(propIndex);
  removeBox(map, index, box);
}

/** Whether `liftProp` has taken this prop out of collision. */
export function isLifted(map: WorldMap, propIndex: number): boolean {
  return solidIndex(map).lifted.has(propIndex);
}

/** Places, moves or (with null) removes a solid that comes and goes under its own key, such as a resting car. */
export function setSolid(map: WorldMap, key: string, box: Box | null): void {
  const index = solidIndex(map);
  const had = index.dynamic.get(key);
  if (had) removeBox(map, index, had);
  if (!box) {
    index.dynamic.delete(key);
    return;
  }
  const own: Box = { x0: box.x0, y0: box.y0, x1: box.x1, y1: box.y1 };
  index.dynamic.set(key, own);
  addBox(map, index, own);
}

/** Back to the map as built: lifted props return and keyed solids go, for a town started over on the same map. */
export function restoreSolids(map: WorldMap): void {
  const index = indexes.get(map);
  if (!index) return;
  for (const key of [...index.dynamic.keys()]) setSolid(map, key, null);
  for (const propIndex of index.lifted) {
    const box = index.propBoxes[propIndex];
    if (box) addBox(map, index, box);
  }
  index.lifted.clear();
}

/**
 * Like blockedTiles, but only the props, walls and dark: the van is left out, so nothing has to settle where it parks.
 * For laying out more of a map that is still being built, where finding the van's spot would be wasted work. Not cached.
 */
export function blockedTilesWithoutVan(map: WorldMap): Uint8Array {
  const blocked = new Uint8Array(map.cols * map.rows);
  const mark = (box: Box): void => {
    const minCol = Math.max(0, Math.floor(box.x0 / TILE_SIZE));
    const maxCol = Math.min(map.cols - 1, Math.ceil(box.x1 / TILE_SIZE) - 1);
    const minRow = Math.max(0, Math.floor(box.y0 / TILE_SIZE));
    const maxRow = Math.min(map.rows - 1, Math.ceil(box.y1 / TILE_SIZE) - 1);
    for (let row = minRow; row <= maxRow; row++) blocked.fill(1, row * map.cols + minCol, row * map.cols + maxCol + 1);
  };
  for (const prop of map.props) {
    if (isSolidProp(prop)) mark(propBox(prop));
  }
  for (const wall of wallBoxes(map)) mark(wall);
  for (const dark of voidBoxes(map, buildingBox)) mark(dark);
  return blocked;
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
export function segmentEntersBox(box: Box, x0: number, y0: number, dx: number, dy: number): number {
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
