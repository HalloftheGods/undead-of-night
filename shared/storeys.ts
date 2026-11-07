// Floors above and below the town's houses. Each one is a building of its own, laid out in a strip below
// the town where nothing else is, and reached only by its stairs: they link a tile in the house to the same
// tile on the floor, both ways. Walls, sight, bullets and the flow fields all work there as they do in town,
// and the dark between the floors is solid, so nothing crosses it but by the stairs.

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

export type StoreyKind = 'upstairs' | 'cellar' | 'apartment_upstairs';

/** Its own generator, so the town and the run roll exactly as they did before there were floors. */
const STOREY_SALT = 0x53545259;
export const UPSTAIRS_ODDS = 0.3;
export const CELLAR_ODDS = 0.2;
/** Dark kept between the town's south fence and the first floor, so nothing in town is drawn or heard there. */
export const ANNEX_GAP_TILES = 6;
/** The largest floor, an apartment's, is 10 by 8 tiles: each floor gets a cell with three tiles of dark around it. */
const CELL_COLS = 13;
const CELL_ROWS = 11;
const ANNEX_MARGIN_TILES = 2;

/**
 * The stairs, in tiles from the footprint's top left, the same on every floor so they line up. In a
 * house this is the kitchen's corner between the fridge and the sofa, off the way through.
 */
const HOUSE_STAIRS = { col: 5, row: 3 } as const;
/** In an apartment block, the lobby's east end, below the east flat's doorway. */
const APARTMENT_STAIRS = { col: 7, row: 5 } as const;
export const STAIRS: Readonly<Partial<Record<BuildingKind, { readonly col: number; readonly row: number }>>> = {
  house: HOUSE_STAIRS,
  upstairs: HOUSE_STAIRS,
  cellar: HOUSE_STAIRS,
  apartment: APARTMENT_STAIRS,
  apartment_upstairs: APARTMENT_STAIRS,
};

export function isStorey(building: BuildingInstance): boolean {
  return building.of !== undefined;
}

export function isStoreyKind(kind: BuildingKind): boolean {
  return kind === 'upstairs' || kind === 'cellar' || kind === 'apartment_upstairs';
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
  /** Rows the floors add below the town: none when no house has one. */
  readonly rows: number;
}

function apartmentStorey(building: BuildingInstance): StoreyKind | null {
  return building.kind === 'apartment' ? 'apartment_upstairs' : null;
}

function storeyKind(roll: number): StoreyKind | null {
  const goesUpstairs = roll < UPSTAIRS_ODDS;
  if (goesUpstairs) return 'upstairs';
  return roll < UPSTAIRS_ODDS + CELLAR_ODDS ? 'cellar' : null;
}

/** Which houses get a floor above or below, and where each floor lies in the strip under the town. */
export function planStoreys(seed: number, buildings: readonly BuildingInstance[], cols: number, townRows: number): StoreyPlan {
  const rng = createRng(seed ^ STOREY_SALT);
  const perRow = Math.max(1, Math.floor((cols - ANNEX_MARGIN_TILES * 2) / CELL_COLS));
  const storeys: BuildingInstance[] = [];
  for (const house of buildings) {
    // Every apartment block has a second floor. A house rolls for one, and nothing else does.
    const isHouse = house.kind === 'house';
    const kind = isHouse ? storeyKind(rng()) : apartmentStorey(house);
    if (!kind) continue;
    const slot = storeys.length;
    const col = ANNEX_MARGIN_TILES + (slot % perRow) * CELL_COLS + 1;
    const row = townRows + ANNEX_GAP_TILES + Math.floor(slot / perRow) * CELL_ROWS + 1;
    storeys.push({ id: `${house.id}${kind === 'cellar' ? 'c' : 'u'}`, kind, x: col * TILE_SIZE, y: row * TILE_SIZE, variant: house.variant, of: house.id });
  }
  const bands = Math.ceil(storeys.length / perRow);
  return { storeys, rows: bands === 0 ? 0 : ANNEX_GAP_TILES + bands * CELL_ROWS + 1 };
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

export function stairsPoint(building: BuildingInstance): Point | null {
  const tile = STAIRS[building.kind];
  return tile ? { x: building.x + (tile.col + 0.5) * TILE_SIZE, y: building.y + (tile.row + 0.5) * TILE_SIZE } : null;
}

const tileIndex = (map: Pick<WorldMap, 'cols'>, point: Point): number =>
  Math.floor(point.y / TILE_SIZE) * map.cols + Math.floor(point.x / TILE_SIZE);

const FLIGHT_LABEL: Record<StoreyKind, { readonly there: string; readonly back: string }> = {
  upstairs: { there: 'UPSTAIRS', back: 'DOWNSTAIRS' },
  cellar: { there: 'CELLAR', back: 'UPSTAIRS' },
  apartment_upstairs: { there: 'UPSTAIRS', back: 'DOWNSTAIRS' },
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
    const up = stairsPoint(storey);
    const down = house ? stairsPoint(house) : null;
    const linked = up !== null && down !== null;
    if (!linked) continue;
    const words = FLIGHT_LABEL[storey.kind as StoreyKind];
    const upIndex = tileIndex(map, up);
    const downIndex = tileIndex(map, down);
    const cellar = storey.kind === 'cellar';
    flights.set(downIndex, { from: down, to: up, fromIndex: downIndex, toIndex: upIndex, label: words.there, down: cellar });
    flights.set(upIndex, { from: up, to: down, fromIndex: upIndex, toIndex: downIndex, label: words.back, down: !cellar });
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

/** The town's own height in pixels, without the floors laid out below it. */
export function townHeight(map: Pick<WorldMap, 'height' | 'townRows'>): number {
  return map.townRows === undefined ? map.height : map.townRows * TILE_SIZE;
}

/** The dark strip under the town, solid everywhere but on the floors themselves, a tile row at a time. */
export function voidBoxes(map: Pick<WorldMap, 'buildings' | 'cols' | 'rows' | 'townRows'>, footprint: (building: BuildingInstance) => Rect): Rect[] {
  const top = map.townRows ?? map.rows;
  const boxes: Rect[] = [];
  const floors = map.buildings.filter(isStorey).map(footprint);
  const width = map.cols * TILE_SIZE;
  for (let row = top; row < map.rows; row++) {
    const y0 = row * TILE_SIZE;
    const y1 = y0 + TILE_SIZE;
    const across = floors.filter((box) => box.y0 < y1 && box.y1 > y0).sort((a, b) => a.x0 - b.x0);
    let x = 0;
    for (const box of across) {
      const hasGapBefore = box.x0 > x;
      if (hasGapBefore) boxes.push({ x0: x, y0, x1: box.x0, y1 });
      x = Math.max(x, box.x1);
    }
    const hasGapAfter = x < width;
    if (hasGapAfter) boxes.push({ x0: x, y0, x1: width, y1 });
  }
  return boxes;
}
