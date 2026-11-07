import { TILE_SIZE } from './protocol.ts';
import type { District } from './protocol.ts';
import { pick, randInt, randRange, shuffle } from './rng.ts';
import type { Rng } from './rng.ts';
import type { Box } from './world-query.ts';

export const MAP_TILES = 200;
/** Sidewalk on each side of every road. */
export const WALK_TILES = 2;
/** Open verge between the outermost blocks and the fence. */
export const EDGE_TILES = 6;
const AVENUE_TILES = 7;
const MIN_BLOCK_W = 16;
const MIN_BLOCK_H = 11;
const PARK_STREET_TILES = 5;

export interface TileRect {
  readonly c0: number;
  readonly r0: number;
  /** Exclusive, like r1. */
  readonly c1: number;
  readonly r1: number;
}

export interface Road extends TileRect {
  readonly horizontal: boolean;
}

export type TownStyle = 'downtown' | 'old_town' | 'riverside' | 'industrial';

export interface Block extends TileRect {
  readonly style: TownStyle;
}

export interface TownPlan {
  readonly roads: Road[];
  readonly blocks: Block[];
  readonly park: TileRect;
  readonly districts: District[];
  readonly spawn: { readonly x: number; readonly y: number };
}

/** Block size limits and street widths give each district its grain. */
const SHAPES: Record<TownStyle, { readonly maxW: number; readonly maxH: number; readonly roads: readonly number[] }> = {
  downtown: { maxW: 42, maxH: 24, roads: [5] },
  old_town: { maxW: 30, maxH: 22, roads: [3, 3, 5] },
  riverside: { maxW: 58, maxH: 16, roads: [3, 5] },
  industrial: { maxW: 60, maxH: 34, roads: [5, 7] },
};

const DISTRICT_NAMES: Record<TownStyle, string> = {
  downtown: 'Downtown',
  old_town: 'Old Town',
  riverside: 'Riverside',
  industrial: 'Industrial Yard',
};

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

export function rectBox(rect: TileRect): Box {
  return { x0: rect.c0 * TILE_SIZE, y0: rect.r0 * TILE_SIZE, x1: rect.c1 * TILE_SIZE, y1: rect.r1 * TILE_SIZE };
}

function rectCentre(rect: TileRect): { x: number; y: number } {
  return { x: ((rect.c0 + rect.c1) / 2) * TILE_SIZE, y: ((rect.r0 + rect.r1) / 2) * TILE_SIZE };
}

/** A street's ends reach the roads it meets, or the fence where there is nothing else to meet. */
function streetEnds(low: number, high: number): { from: number; to: number } {
  return {
    from: low === EDGE_TILES ? 1 : low - WALK_TILES,
    to: high === MAP_TILES - EDGE_TILES ? MAP_TILES - 1 : high + WALK_TILES,
  };
}

/** Cuts a rect in two along a new street. `at` is the first half's size in tiles. */
function splitRect(rect: TileRect, vertical: boolean, at: number, width: number): { first: TileRect; second: TileRect; road: Road } {
  if (vertical) {
    const roadCol = rect.c0 + at + WALK_TILES;
    const { from, to } = streetEnds(rect.r0, rect.r1);
    return {
      first: { ...rect, c1: rect.c0 + at },
      second: { ...rect, c0: roadCol + width + WALK_TILES },
      road: { c0: roadCol, c1: roadCol + width, r0: from, r1: to, horizontal: false },
    };
  }
  const roadRow = rect.r0 + at + WALK_TILES;
  const { from, to } = streetEnds(rect.c0, rect.c1);
  return {
    first: { ...rect, r1: rect.r0 + at },
    second: { ...rect, r0: roadRow + width + WALK_TILES },
    road: { r0: roadRow, r1: roadRow + width, c0: from, c1: to, horizontal: true },
  };
}

/** Recursive cuts, so side streets end at the street they meet instead of forming a grid. */
function subdivide(rect: TileRect, style: TownStyle, roads: Road[], blocks: Block[], rng: Rng): void {
  const shape = SHAPES[style];
  const width = rect.c1 - rect.c0;
  const height = rect.r1 - rect.r0;
  const roadWidth = pick(rng, shape.roads);
  const street = roadWidth + WALK_TILES * 2;
  const splitAcross = width > shape.maxW && width >= MIN_BLOCK_W * 2 + street;
  const splitDown = height > shape.maxH && height >= MIN_BLOCK_H * 2 + street;
  const smallEnough = !splitAcross && !splitDown;
  if (smallEnough) {
    blocks.push({ ...rect, style });
    return;
  }
  const vertical = splitAcross && (!splitDown || width / shape.maxW >= height / shape.maxH);
  const free = (vertical ? width : height) - street;
  const least = vertical ? MIN_BLOCK_W : MIN_BLOCK_H;
  const at = clamp(Math.round(free * randRange(rng, 0.38, 0.62)), least, free - least);
  const { first, second, road } = splitRect(rect, vertical, at, roadWidth);
  roads.push(road);
  subdivide(first, style, roads, blocks, rng);
  subdivide(second, style, roads, blocks, rng);
}

/** Carves the park out of the corner of a quadrant nearest the main crossing. */
function carvePark(quadrant: TileRect, west: boolean, north: boolean, roads: Road[], rng: Rng): { park: TileRect; rest: TileRect[] } {
  const street = PARK_STREET_TILES + WALK_TILES * 2;
  const parkW = randInt(rng, 34, 40);
  const parkH = randInt(rng, 32, 38);
  const quadrantW = quadrant.c1 - quadrant.c0;
  const across = splitRect(quadrant, true, west ? quadrantW - parkW - street : parkW, PARK_STREET_TILES);
  const column = west ? across.second : across.first;
  const quadrantH = column.r1 - column.r0;
  const down = splitRect(column, false, north ? quadrantH - parkH - street : parkH, PARK_STREET_TILES);
  roads.push(across.road, down.road);
  return {
    park: north ? down.second : down.first,
    rest: [west ? across.first : across.second, north ? down.first : down.second],
  };
}

/** The town at tile level: where the roads, the blocks and the park go. */
export function planTown(rng: Rng): TownPlan {
  const avenueCol = randInt(rng, 88, 112);
  const avenueRow = randInt(rng, 88, 112);
  const roads: Road[] = [
    { c0: avenueCol, c1: avenueCol + AVENUE_TILES, r0: 1, r1: MAP_TILES - 1, horizontal: false },
    { r0: avenueRow, r1: avenueRow + AVENUE_TILES, c0: 1, c1: MAP_TILES - 1, horizontal: true },
  ];
  const westEnd = avenueCol - WALK_TILES;
  const eastStart = avenueCol + AVENUE_TILES + WALK_TILES;
  const northEnd = avenueRow - WALK_TILES;
  const southStart = avenueRow + AVENUE_TILES + WALK_TILES;
  const far = MAP_TILES - EDGE_TILES;
  const quadrants: readonly TileRect[] = [
    { c0: EDGE_TILES, c1: westEnd, r0: EDGE_TILES, r1: northEnd },
    { c0: eastStart, c1: far, r0: EDGE_TILES, r1: northEnd },
    { c0: EDGE_TILES, c1: westEnd, r0: southStart, r1: far },
    { c0: eastStart, c1: far, r0: southStart, r1: far },
  ];

  // Old Town and the park share a quadrant, with Downtown across the crossing from them.
  const home = randInt(rng, 0, 3);
  const flanks = shuffle<TownStyle>(rng, ['riverside', 'industrial']);
  const styles: TownStyle[] = [];
  styles[home] = 'old_town';
  styles[3 - home] = 'downtown';
  const flankIndices = [0, 1, 2, 3].filter((index) => index !== home && index !== 3 - home);
  flankIndices.forEach((index, order) => {
    styles[index] = flanks[order];
  });

  const blocks: Block[] = [];
  const carved = carvePark(quadrants[home], home % 2 === 0, home < 2, roads, rng);
  const districts: District[] = [];
  quadrants.forEach((quadrant, index) => {
    const style = styles[index];
    districts.push({ name: DISTRICT_NAMES[style], ...rectCentre(quadrant) });
    const isHomeQuadrant = index === home;
    if (isHomeQuadrant) carved.rest.forEach((rect) => subdivide(rect, style, roads, blocks, rng));
    else subdivide(quadrant, style, roads, blocks, rng);
  });
  const spawn = rectCentre(carved.park);
  districts.push({ name: 'Park', ...spawn });
  return { roads, blocks, park: carved.park, districts, spawn };
}
