// Floors above and below the town's houses. Each one is a building of its own on a layer of its own: the
// map carries on below the town in whole-town bands, the upstairs one town down and the cellars two, and
// every floor lies at its house's own place in its band, so a floor is framed just as its house is. Only the
// stairs reach a floor: they link a tile in the house to the same tile on the floor, both ways. Walls, sight,
// bullets and the flow fields all work there as they do in town, and the dark between the floors is solid,
// so nothing crosses it but by the stairs. The sewers lie below the last band.

import type { Point } from './flow-field.ts';
import { TILE_SIZE } from './protocol.ts';
import type { BuildingInstance, BuildingKind, WorldMap } from './protocol.ts';
import { createRng } from './rng.ts';

/** Box shape, kept here so this file needs nothing from the world query that reads it. */
interface Rect {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

export type StoreyKind = 'upstairs' | 'cellar' | 'apartment_upstairs' | 'hospital_upstairs' | 'school_upstairs';

/** Its own generator, so the town and the run roll exactly as they did before there were floors. */
const STOREY_SALT = 0x53545259;
export const UPSTAIRS_ODDS = 0.3;
export const CELLAR_ODDS = 0.2;
/** Rows of dark kept above the sewers, under the last band of floors. */
export const ANNEX_GAP_TILES = 6;
/** Which band under the town each kind of floor lies in: a whole town down for upstairs, two for a cellar. */
export const FLOOR_LAYER: Readonly<Record<StoreyKind, 1 | 2>> = {
  upstairs: 1,
  apartment_upstairs: 1,
  hospital_upstairs: 1,
  school_upstairs: 1,
  cellar: 2,
};
/** Bands the floors take under the town, whenever a town has any floors at all. */
const FLOOR_LAYERS = 2;

/**
 * The stairs, in tiles from the footprint's top left, the same on every floor so they line up. In a
 * house they stand in the back corner on the west, against the back wall and off the way through
 * from the front door to the back, so nobody takes them by walking past.
 */
export interface StairTile {
  readonly col: number;
  readonly row: number;
}

const HOUSE_STAIRS = { col: 1, row: 1 } as const;
/** In an apartment block, two ways upstairs set flush against the north back wall: west and east. */
const APARTMENT_STAIRS: readonly StairTile[] = [{ col: 1, row: 1 }, { col: 8, row: 1 }];
/** In the hospital, the west end of the main corridor, past the nurses' station. */
const HOSPITAL_STAIRS = { col: 1, row: 6 } as const;
/** In the school, the east end of the main hall. */
const SCHOOL_STAIRS = { col: 16, row: 5 } as const;
export const STAIRS: Readonly<Partial<Record<BuildingKind, readonly StairTile[]>>> = {
  house: [HOUSE_STAIRS],
  upstairs: [HOUSE_STAIRS],
  cellar: [HOUSE_STAIRS],
  apartment: APARTMENT_STAIRS,
  apartment_upstairs: APARTMENT_STAIRS,
  hospital: [HOSPITAL_STAIRS],
  hospital_upstairs: [HOSPITAL_STAIRS],
  school: [SCHOOL_STAIRS],
  school_upstairs: [SCHOOL_STAIRS],
};

export function isStorey(building: BuildingInstance): boolean {
  return building.of !== undefined;
}

const STOREY_KINDS: ReadonlySet<BuildingKind> = new Set<StoreyKind>(['upstairs', 'cellar', 'apartment_upstairs', 'hospital_upstairs', 'school_upstairs']);

export function isStoreyKind(kind: BuildingKind): boolean {
  return STOREY_KINDS.has(kind);
}

/** The ids of every building with a flight of stairs in it: each floor, and each house a floor belongs to. */
export function buildingsWithStairs(buildings: readonly BuildingInstance[]): ReadonlySet<string> {
  const ids = new Set<string>();
  for (const building of buildings) {
    const isTownBuilding = building.of === undefined;
    if (isTownBuilding) continue;
    ids.add(building.id);
    ids.add(building.of);
  }
  return ids;
}

const townCache = new WeakMap<readonly BuildingInstance[], readonly BuildingInstance[]>();

/** The town's own buildings, without the floors above and below: what the run's own rolls go over. */
export function townBuildings(map: Pick<WorldMap, 'buildings'>): readonly BuildingInstance[] {
  const known = townCache.get(map.buildings);
  if (known) return known;
  const town = map.buildings.filter((building) => !isStorey(building));
  townCache.set(map.buildings, town);
  return town;
}

export interface StoreyPlan {
  readonly storeys: BuildingInstance[];
  /** Rows the floors add below the town: a whole town per band, or none when no house has a floor. */
  readonly rows: number;
}

/** The buildings that always have a second floor. */
const ALWAYS_UPSTAIRS: Partial<Record<BuildingKind, StoreyKind>> = {
  apartment: 'apartment_upstairs',
  hospital: 'hospital_upstairs',
  school: 'school_upstairs',
};

function storeyKind(roll: number): StoreyKind | null {
  const goesUpstairs = roll < UPSTAIRS_ODDS;
  if (goesUpstairs) return 'upstairs';
  return roll < UPSTAIRS_ODDS + CELLAR_ODDS ? 'cellar' : null;
}

/** Which buildings get a floor above or below. */
function storeysOf(seed: number, buildings: readonly BuildingInstance[]): { house: BuildingInstance; kind: StoreyKind }[] {
  const rng = createRng(seed ^ STOREY_SALT);
  const found: { house: BuildingInstance; kind: StoreyKind }[] = [];
  for (const house of buildings) {
    // Every apartment block, hospital and school has a second floor. A house rolls for one, and nothing else does.
    const isHouse = house.kind === 'house';
    const kind = isHouse ? storeyKind(rng()) : ALWAYS_UPSTAIRS[house.kind] ?? null;
    if (kind) found.push({ house, kind });
  }
  return found;
}

/** Which houses get a floor above or below, each laid at its house's place in its own band under the town. */
export function planStoreys(seed: number, buildings: readonly BuildingInstance[], townRows: number): StoreyPlan {
  const townH = townRows * TILE_SIZE;
  const storeys = storeysOf(seed, buildings).map(({ house, kind }): BuildingInstance => ({
    id: `${house.id}${kind === 'cellar' ? 'c' : 'u'}`,
    kind,
    x: house.x,
    y: house.y + FLOOR_LAYER[kind] * townH,
    variant: house.variant,
    of: house.id,
  }));
  return { storeys, rows: storeys.length === 0 ? 0 : FLOOR_LAYERS * townRows };
}

/** One way up or down a flight of stairs. */
export interface Flight {
  /** The stairs tile's middle on this floor, and on the one it leads to. */
  readonly from: Point;
  readonly to: Point;
  readonly fromIndex: number;
  readonly toIndex: number;
  /** What the stairs lead to, said in the prompt. */
  readonly label: string;
  /** True for stairs that go down, which are drawn as an opening into the dark. */
  readonly down: boolean;
}

export function stairsPoints(building: BuildingInstance): readonly Point[] {
  const tiles = STAIRS[building.kind];
  if (!tiles) return [];
  return tiles.map((tile) => ({
    x: building.x + (tile.col + 0.5) * TILE_SIZE,
    y: building.y + (tile.row + 0.5) * TILE_SIZE,
  }));
}

export function stairsPoint(building: BuildingInstance): Point | null {
  return stairsPoints(building)[0] ?? null;
}

const tileIndex = (map: Pick<WorldMap, 'cols'>, point: Point): number =>
  Math.floor(point.y / TILE_SIZE) * map.cols + Math.floor(point.x / TILE_SIZE);

const FLIGHT_LABEL: Record<StoreyKind, { readonly there: string; readonly back: string }> = {
  upstairs: { there: 'UPSTAIRS', back: 'DOWNSTAIRS' },
  cellar: { there: 'CELLAR', back: 'UPSTAIRS' },
  apartment_upstairs: { there: 'UPSTAIRS', back: 'DOWNSTAIRS' },
  hospital_upstairs: { there: 'UPSTAIRS', back: 'DOWNSTAIRS' },
  school_upstairs: { there: 'UPSTAIRS', back: 'DOWNSTAIRS' },
};

const flightCache = new WeakMap<readonly BuildingInstance[], ReadonlyMap<number, Flight>>();

/** Every flight, by the tile it starts from. */
export function flightsOf(map: Pick<WorldMap, 'buildings' | 'cols'>): ReadonlyMap<number, Flight> {
  const known = flightCache.get(map.buildings);
  if (known) return known;
  const byId = new Map(map.buildings.map((building) => [building.id, building]));
  const flights = new Map<number, Flight>();
  for (const storey of map.buildings) {
    const house = storey.of === undefined ? undefined : byId.get(storey.of);
    if (!house) continue;
    const storeyPoints = stairsPoints(storey);
    const housePoints = stairsPoints(house);
    const count = Math.min(storeyPoints.length, housePoints.length);
    for (let i = 0; i < count; i++) {
      const up = storeyPoints[i];
      const down = housePoints[i];
      const words = FLIGHT_LABEL[storey.kind as StoreyKind];
      const upIndex = tileIndex(map, up);
      const downIndex = tileIndex(map, down);
      const cellar = storey.kind === 'cellar';
      flights.set(downIndex, { from: down, to: up, fromIndex: downIndex, toIndex: upIndex, label: words.there, down: cellar });
      flights.set(upIndex, { from: up, to: down, fromIndex: upIndex, toIndex: downIndex, label: words.back, down: !cellar });
    }
  }
  flightCache.set(map.buildings, flights);
  return flights;
}

/** The flight whose stairs are underfoot here, or null. */
export function flightAt(map: Pick<WorldMap, 'buildings' | 'cols' | 'rows'>, x: number, y: number): Flight | null {
  const col = Math.floor(x / TILE_SIZE);
  const row = Math.floor(y / TILE_SIZE);
  const onMap = col >= 0 && row >= 0 && col < map.cols && row < map.rows;
  return onMap ? flightsOf(map).get(row * map.cols + col) ?? null : null;
}

/** The vertical span of the layer `y` is on: the town, a band of floors, or the sewers. The camera keeps to it. */
export function layerBounds(map: Pick<WorldMap, 'height' | 'townRows' | 'sewers'>, y: number): { y0: number; y1: number } {
  const town = townHeight(map);
  const sewerTop = map.sewers === undefined ? Infinity : map.sewers.top * TILE_SIZE;
  const inSewers = y >= sewerTop;
  if (inSewers) return { y0: sewerTop, y1: map.height };
  const band = Math.max(0, Math.min(FLOOR_LAYERS, Math.floor(y / town)));
  return { y0: band * town, y1: Math.min(map.height, (band + 1) * town) };
}

/** The town's own height in pixels, without the floors laid out below it. */
export function townHeight(map: Pick<WorldMap, 'height' | 'townRows'>): number {
  return map.townRows === undefined ? map.height : map.townRows * TILE_SIZE;
}

/** The dark under the town, solid everywhere but on the floors themselves: a tile row at a time, rows alike run together. */
export function voidBoxes(map: Pick<WorldMap, 'buildings' | 'cols' | 'rows' | 'townRows'>, footprint: (building: BuildingInstance) => Rect): Rect[] {
  const top = map.townRows ?? map.rows;
  const boxes: Rect[] = [];
  const floors = map.buildings.filter(isStorey).map(footprint);
  const width = map.cols * TILE_SIZE;
  // The row above's gaps, by their span: a gap that carries on in this row grows down instead of starting anew.
  let open = new Map<string, { x0: number; y0: number; x1: number; y1: number }>();
  for (let row = top; row < map.rows; row++) {
    const y0 = row * TILE_SIZE;
    const y1 = y0 + TILE_SIZE;
    const across = floors.filter((box) => box.y0 < y1 && box.y1 > y0).sort((a, b) => a.x0 - b.x0);
    const gaps: [number, number][] = [];
    let x = 0;
    for (const box of across) {
      const hasGapBefore = box.x0 > x;
      if (hasGapBefore) gaps.push([x, box.x0]);
      x = Math.max(x, box.x1);
    }
    const hasGapAfter = x < width;
    if (hasGapAfter) gaps.push([x, width]);
    const next = new Map<string, { x0: number; y0: number; x1: number; y1: number }>();
    for (const [x0, x1] of gaps) {
      const key = `${x0},${x1}`;
      const above = open.get(key);
      const grows = above !== undefined && above.y1 === y0;
      const gap = grows ? above : { x0, y0, x1, y1 };
      gap.y1 = y1;
      next.set(key, gap);
      if (!grows) boxes.push(gap);
    }
    open = next;
  }
  return boxes;
}
