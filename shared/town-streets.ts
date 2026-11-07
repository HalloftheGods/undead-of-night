import { TILE_SIZE } from './protocol.ts';
import type { PropKind, TileKind } from './protocol.ts';
import type { MapBuilder } from './map-builder.ts';
import { pick, randInt, randRange } from './rng.ts';
import { rectBox, WALK_TILES } from './town-plan.ts';
import type { Road } from './town-plan.ts';
import type { Box } from './world-query.ts';

const ACROSS = 1;
const DOWN = 2;
const JUNCTION = ACROSS | DOWN;
/** Longest stretch of kerb between two lamps on the same side. */
const LAMP_SPACING_TILES = 18;
const WRECK_SPACING_TILES = 22;
const END_MARGIN_TILES = 6;

const around = (point: { x: number; y: number }, size: number): Box => ({
  x0: point.x - size,
  y0: point.y - size,
  x1: point.x + size,
  y1: point.y + size,
});

/** Per tile, which way a road runs through it. */
function roadMask(b: MapBuilder, roads: readonly Road[]): Uint8Array {
  const mask = new Uint8Array(b.cols * b.rows);
  for (const road of roads) {
    for (let row = road.r0; row < road.r1; row++) {
      for (let col = road.c0; col < road.c1; col++) mask[row * b.cols + col] |= road.horizontal ? ACROSS : DOWN;
    }
  }
  return mask;
}

/** True within a sidewalk's width of a road running the other way, where the crossing is painted. */
function nearCrossing(b: MapBuilder, mask: Uint8Array, col: number, row: number, horizontal: boolean): boolean {
  const other = horizontal ? DOWN : ACROSS;
  for (let step = 1; step <= WALK_TILES; step++) {
    const before = horizontal ? row * b.cols + col - step : (row - step) * b.cols + col;
    const after = horizontal ? row * b.cols + col + step : (row + step) * b.cols + col;
    const crosses = (mask[before] & other) !== 0 || (mask[after] & other) !== 0;
    if (crosses) return true;
  }
  return false;
}

function paintRoad(b: MapBuilder, road: Road, mask: Uint8Array): void {
  const width = road.horizontal ? road.r1 - road.r0 : road.c1 - road.c0;
  const hasLane = width >= 5;
  const laneOffset = (width - 1) / 2;
  for (let row = road.r0; row < road.r1; row++) {
    for (let col = road.c0; col < road.c1; col++) {
      const junction = mask[row * b.cols + col] === JUNCTION;
      const across = road.horizontal ? row - road.r0 : col - road.c0;
      const crossing = !junction && nearCrossing(b, mask, col, row, road.horizontal);
      const onLane = !junction && hasLane && across === laneOffset;
      let kind: TileKind = b.rng() < 0.14 ? 'asphalt_cracked' : 'asphalt';
      if (crossing) kind = road.horizontal ? 'crosswalk_h' : 'crosswalk_v';
      else if (onLane) kind = road.horizontal ? 'lane_h' : 'lane_v';
      b.setTile(col, row, kind);
    }
  }
}

/** Curbs face the road across their named edge; inner corners stay plain paving. */
function paintCurbs(b: MapBuilder, mask: Uint8Array): void {
  const isRoad = (col: number, row: number): boolean => {
    const onMap = col >= 0 && row >= 0 && col < b.cols && row < b.rows;
    return onMap && mask[row * b.cols + col] !== 0;
  };
  for (let row = 0; row < b.rows; row++) {
    for (let col = 0; col < b.cols; col++) {
      if (isRoad(col, row)) continue;
      const north = isRoad(col, row - 1);
      const south = isRoad(col, row + 1);
      const west = isRoad(col - 1, row);
      const east = isRoad(col + 1, row);
      const sides = Number(north) + Number(south) + Number(west) + Number(east);
      const isNotRoadEdge = sides !== 1;
      if (isNotRoadEdge) continue;
      if (north) b.setTile(col, row, 'curb_n');
      else if (south) b.setTile(col, row, 'curb_s');
      else if (east) b.setTile(col, row, 'curb_e');
      else b.setTile(col, row, 'curb_w');
    }
  }
}

/** Sidewalks first so a road laid after them cuts through cleanly. */
export function paintStreets(b: MapBuilder, roads: readonly Road[]): Uint8Array {
  const mask = roadMask(b, roads);
  for (const road of roads) {
    const walked = { c0: road.c0 - WALK_TILES, r0: road.r0 - WALK_TILES, c1: road.c1 + WALK_TILES, r1: road.r1 + WALK_TILES };
    b.fill(rectBox(walked), 'sidewalk');
  }
  for (const road of roads) paintRoad(b, road, mask);
  paintCurbs(b, mask);
  return mask;
}

function placeOnWalk(b: MapBuilder, mask: Uint8Array, kind: PropKind, x: number, y: number): void {
  const col = Math.floor(x / TILE_SIZE);
  const row = Math.floor((y - 1) / TILE_SIZE);
  const offRoad = col >= 0 && row >= 0 && col < b.cols && row < b.rows && mask[row * b.cols + col] === 0;
  if (offRoad) b.place(kind, x, y, 24);
}

/** A lamp that keeps its place when a building or wreck is in the way: it slides along the kerb instead of vanishing. */
function placeLamp(b: MapBuilder, mask: Uint8Array, kind: PropKind, x: number, y: number, horizontal: boolean): void {
  for (const slide of [0, TILE_SIZE, -TILE_SIZE, 2 * TILE_SIZE, -2 * TILE_SIZE]) {
    const col = Math.floor((horizontal ? x + slide : x) / TILE_SIZE);
    const row = Math.floor(((horizontal ? y : y + slide) - 1) / TILE_SIZE);
    const offRoad = col >= 0 && row >= 0 && col < b.cols && row < b.rows && mask[row * b.cols + col] === 0;
    const wasPlacedOffRoad = offRoad && b.place(kind, horizontal ? x + slide : x, horizontal ? y : y + slide, 24);
    if (wasPlacedOffRoad) return;
  }
}

/** One lamp on every street corner, where the kerbs of two streets meet. */
function lightCorners(b: MapBuilder, mask: Uint8Array): void {
  const isRoad = (col: number, row: number): boolean => {
    const onMap = col >= 0 && row >= 0 && col < b.cols && row < b.rows;
    return onMap && mask[row * b.cols + col] !== 0;
  };
  for (let row = 0; row < b.rows; row++) {
    for (let col = 0; col < b.cols; col++) {
      if (isRoad(col, row)) continue;
      const lengthways = isRoad(col, row - 1) !== isRoad(col, row + 1);
      const crossways = isRoad(col - 1, row) !== isRoad(col + 1, row);
      const sides = Number(isRoad(col, row - 1)) + Number(isRoad(col, row + 1)) + Number(isRoad(col - 1, row)) + Number(isRoad(col + 1, row));
      const isStraightWalk = sides === 2 && lengthways && crossways;
      if (isStraightWalk) placeOnWalk(b, mask, 'street_lamp', col * TILE_SIZE + 8, row * TILE_SIZE + 12);
    }
  }
}

/** Open stretches of kerb along one side of a road, cut where another street crosses. */
function kerbRuns(b: MapBuilder, mask: Uint8Array, road: Road, line: number): { from: number; to: number }[] {
  const start = road.horizontal ? road.c0 : road.r0;
  const end = road.horizontal ? road.c1 : road.r1;
  const runs: { from: number; to: number }[] = [];
  let from = -1;
  for (let tile = start; tile <= end; tile++) {
    const open = tile < end && (road.horizontal ? mask[line * b.cols + tile] : mask[tile * b.cols + line]) === 0;
    const startsOpenRun = open && from < 0;
    if (startsOpenRun) from = tile;
    const endsOpenRun = !open && from >= 0;
    if (endsOpenRun) {
      runs.push({ from, to: tile - 1 });
      from = -1;
    }
  }
  return runs;
}

/**
 * Lamps along one kerb at an even pitch between the corners, so they read as a street's lighting and
 * not scatter. Avenues light both sides in pairs; narrow streets stagger them side to side.
 */
function lightKerb(b: MapBuilder, mask: Uint8Array, road: Road, line: number, opposed: boolean, farSide: boolean): void {
  const start = road.horizontal ? road.c0 : road.r0;
  const end = road.horizontal ? road.c1 : road.r1;
  for (const run of kerbRuns(b, mask, road, line)) {
    // A run that stops at a crossing already has its corner lamp; one that reaches the town's edge starts a margin in.
    const a = run.from > start ? run.from : run.from + END_MARGIN_TILES;
    const z = run.to < end - 1 ? run.to : run.to - END_MARGIN_TILES;
    const isRunTooShort = z - a < 2;
    if (isRunTooShort) continue;
    const gaps = Math.max(1, Math.ceil((z - a) / LAMP_SPACING_TILES));
    const stagger = !opposed && farSide;
    const marks: number[] = [];
    for (let i = stagger ? 0 : 1; i < gaps; i++) marks.push((i + (stagger ? 0.5 : 0)) / gaps);
    const startsAtRoadEnd = run.from <= start;
    if (startsAtRoadEnd) marks.unshift(0);
    const endsAtRoadEnd = run.to >= end - 1;
    if (endsAtRoadEnd) marks.push(1);
    for (const mark of marks) {
      const along = Math.round((a + mark * (z - a) + 0.5) * TILE_SIZE);
      const across = line * TILE_SIZE + 12;
      const spot = road.horizontal ? { x: along, y: across } : { x: across, y: along };
      placeLamp(b, mask, 'street_lamp', spot.x, spot.y, road.horizontal);
    }
    const getsHydrant = b.rng() < 0.3 && z - a > 4;
    if (getsHydrant) {
      const hydrantAlong = Math.round((a + randRange(b.rng, 0.25, 0.75) * (z - a)) * TILE_SIZE);
      const hydrant = road.horizontal ? { x: hydrantAlong, y: line * TILE_SIZE + 12 } : { x: line * TILE_SIZE + 12, y: hydrantAlong };
      placeOnWalk(b, mask, 'hydrant', hydrant.x, hydrant.y);
    }
  }
}

/** Lamps, hydrants, wrecks and roadblocks along one road, leaving at least a lane open. */
function dressRoad(b: MapBuilder, road: Road, mask: Uint8Array): void {
  const { rng } = b;
  const start = road.horizontal ? road.c0 : road.r0;
  const end = road.horizontal ? road.c1 : road.r1;
  const width = road.horizontal ? road.r1 - road.r0 : road.c1 - road.c0;
  const middle = ((road.horizontal ? road.r0 + road.r1 : road.c0 + road.c1) / 2) * TILE_SIZE;
  const alongRoad = (along: number, across: number): { x: number; y: number } =>
    road.horizontal ? { x: along, y: across } : { x: across, y: along };

  const wide = width >= 5;
  lightKerb(b, mask, road, (road.horizontal ? road.r0 : road.c0) - 1, wide, false);
  lightKerb(b, mask, road, road.horizontal ? road.r1 : road.c1, wide, true);

  const wreckSpacing = Math.max(8, Math.round(WRECK_SPACING_TILES / b.biome.wrecks));
  for (let tile = start + END_MARGIN_TILES; tile < end - END_MARGIN_TILES; tile += wreckSpacing) {
    const along = (tile + randInt(rng, 0, 10)) * TILE_SIZE;
    const isNarrowRoad = width < 5;
    if (isNarrowRoad) {
      const spot = alongRoad(along, middle);
      const getsDumpster = rng() < 0.4;
      if (getsDumpster) b.scatter('dumpster', around(spot, 30), 1, 24);
      continue;
    }
    const lane = middle + (rng() < 0.5 ? -1 : 1) * randRange(rng, 12, 24);
    const spot = alongRoad(along, lane);
    const wreck = road.horizontal ? pick<PropKind>(rng, ['car_wreck_h', 'car_wreck_h', 'car_sedan_h', 'van_h']) : 'car_sedan_v';
    const getsWreck = rng() < 0.7;
    if (getsWreck) b.place(wreck, spot.x, spot.y);
    const getsRoadblock = rng() < 0.2;
    if (getsRoadblock) {
      const block = alongRoad(along + 96, middle);
      b.place(pick<PropKind>(rng, ['barrier', 'sandbags']), block.x, block.y);
    }
    for (let pile = 0; pile < Math.ceil(b.biome.debris); pile++) {
      const rubble = alongRoad(along + randRange(rng, -60, 60), middle + randRange(rng, -30, 30));
      b.place('rubble', rubble.x, rubble.y);
    }
  }

  // The town's edge: a street that reaches the fence ends in a barricade with a way round it.
  for (const tip of [start, end]) {
    const closed = tip <= 1 || tip >= b.cols - 1;
    if (!closed) continue;
    const barricade = alongRoad((tip <= 1 ? 3 : tip - 3) * TILE_SIZE, middle);
    b.place('barrier', barricade.x, barricade.y, 16);
  }
}

/** The biome's own growth pushing up through the kerbs, never solid enough to block a pavement. */
function creepKerbs(b: MapBuilder, mask: Uint8Array): void {
  const { chance, kinds } = b.biome.creep;
  const hasNoCreep = chance <= 0;
  if (hasNoCreep) return;
  for (let row = 0; row < b.rows; row++) {
    for (let col = 0; col < b.cols; col++) {
      const onKerb = mask[row * b.cols + col] === 0 && (b.tileIs(col, row, 'curb_n') || b.tileIs(col, row, 'curb_s') || b.tileIs(col, row, 'curb_e') || b.tileIs(col, row, 'curb_w'));
      const getsCreep = onKerb && b.rng() < chance;
      if (getsCreep) placeOnWalk(b, mask, pick<PropKind>(b.rng, kinds), col * TILE_SIZE + 8, row * TILE_SIZE + 12);
    }
  }
}

export function dressStreets(b: MapBuilder, roads: readonly Road[], mask: Uint8Array): void {
  lightCorners(b, mask);
  for (const road of roads) dressRoad(b, road, mask);
  creepKerbs(b, mask);
}
