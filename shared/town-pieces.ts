import type { MapBuilder } from './map-builder.ts';
import type { BuildingKind, PropKind, TileKind } from './protocol.ts';
import { TILE_SIZE } from './protocol.ts';
import { randInt, shuffle } from './rng.ts';
import { WALK_TILES } from './town-plan.ts';
import type { Road, TownPlan } from './town-plan.ts';
import { buildingBox } from './world-query.ts';
import type { Box } from './world-query.ts';

/** Streets shorter than this are left alone: a wall needs room either side of it. */
const WALL_MIN_STREET_TILES = 40;
const WALL_MARGIN_TILES = 12;
const WALL_WALLS = 2;
/** The gate left in a wall, wide enough for a brute and a friend. */
const GATE_PX = 40;
const FENCE_PIECE = 32;
const TIGHT = 2;

/** Only these buildings suffer: the places the town needs are never the ones set alight. */
const AFFLICTED_KINDS: readonly BuildingKind[] = ['house', 'apartment', 'warehouse'];
const PATCH_OVER: readonly TileKind[] = ['grass', 'dirt', 'sidewalk'];
const RING_PITCH = 44;
const RING_OFFSET = 14;

interface WallLine {
  /** Fence pieces run along this axis' direction. */
  readonly runsAlongX: boolean;
  readonly line: number;
  readonly from: number;
  readonly to: number;
}

/** Where a wall across a street stands: a line over its width and both pavements. */
function wallLine(road: Road, along: number): WallLine {
  const lo = (road.horizontal ? road.r0 : road.c0) - WALK_TILES;
  const hi = (road.horizontal ? road.r1 : road.c1) + WALK_TILES;
  return { runsAlongX: !road.horizontal, line: along * TILE_SIZE, from: lo * TILE_SIZE, to: hi * TILE_SIZE };
}

/** The strip a wall fills, for clearing what the street already carried there. */
function stripOf(wall: WallLine, thickness: number): Box {
  return wall.runsAlongX
    ? { x0: wall.from, y0: wall.line - thickness, x1: wall.to, y1: wall.line + thickness }
    : { x0: wall.line - thickness, y0: wall.from, x1: wall.line + thickness, y1: wall.to };
}

function clearStrip(b: MapBuilder, strip: Box): void {
  for (let i = b.props.length - 1; i >= 0; i--) {
    const { x, y } = b.props[i];
    const isOnStrip = x >= strip.x0 && x <= strip.x1 && y >= strip.y0 && y <= strip.y1;
    if (isOnStrip) b.props.splice(i, 1);
  }
}

/** Pieces from one pavement to the other, skipping the gate in the middle. */
function pieces(wall: WallLine, pitch: number): number[] {
  const middle = (wall.from + wall.to) / 2;
  const marks: number[] = [];
  for (let at = wall.from + pitch; at <= wall.to + 1; at += pitch) {
    const outsideGate = Math.abs(at - pitch / 2 - middle) >= GATE_PX / 2;
    if (outsideGate) marks.push(at);
  }
  return marks;
}

function fenceWall(b: MapBuilder, wall: WallLine): void {
  clearStrip(b, stripOf(wall, 24));
  for (const at of pieces(wall, FENCE_PIECE)) {
    if (wall.runsAlongX) b.fixture('fence_h', at - FENCE_PIECE / 2, wall.line);
    else b.fixture('fence_v', wall.line, at);
  }
  // The checkpoint at its gate.
  const middle = (wall.from + wall.to) / 2;
  const post = (side: number): { x: number; y: number } =>
    wall.runsAlongX ? { x: middle + side * 52, y: wall.line + 16 } : { x: wall.line + 16, y: middle + side * 52 };
  for (const side of [-1, 1]) {
    const spot = post(side);
    b.place('sandbags', spot.x, spot.y, TIGHT);
    const lit = post(side * 1.6);
    b.place('fire_barrel', lit.x, lit.y, TIGHT);
  }
}

function junkWall(b: MapBuilder, wall: WallLine): void {
  clearStrip(b, stripOf(wall, 26));
  const middle = (wall.from + wall.to) / 2;
  const kinds: readonly PropKind[] = wall.runsAlongX ? ['car_wreck_h', 'barrier', 'van_h', 'barrier'] : ['car_sedan_v', 'crate_stack', 'car_sedan_v'];
  const pitch = wall.runsAlongX ? 46 : 44;
  let index = 0;
  for (let at = wall.from + pitch / 2; at < wall.to; at += pitch) {
    const isAtGate = Math.abs(at - middle) < GATE_PX / 2 + pitch / 2;
    if (isAtGate) continue;
    const kind = kinds[index++ % kinds.length];
    if (wall.runsAlongX) b.place(kind, at, wall.line, TIGHT);
    else b.place(kind, wall.line, at, TIGHT);
  }
}

function raiseWalls(b: MapBuilder, plan: TownPlan): void {
  const style = b.biome.wall;
  if (!style) return;
  // The two avenues are the town's spine; every other street is fair game.
  const streets = plan.roads.slice(2).filter((road) => (road.horizontal ? road.c1 - road.c0 : road.r1 - road.r0) >= WALL_MIN_STREET_TILES);
  for (const road of shuffle(b.rng, streets).slice(0, WALL_WALLS)) {
    const start = road.horizontal ? road.c0 : road.r0;
    const end = road.horizontal ? road.c1 : road.r1;
    const wall = wallLine(road, randInt(b.rng, start + WALL_MARGIN_TILES, end - WALL_MARGIN_TILES));
    const isFence = style === 'fence';
    if (isFence) fenceWall(b, wall);
    else junkWall(b, wall);
  }
}

function ringBuilding(b: MapBuilder, box: Box, kind: PropKind): void {
  const reach = { x0: box.x0 - RING_OFFSET, y0: box.y0 - RING_OFFSET, x1: box.x1 + RING_OFFSET, y1: box.y1 + RING_OFFSET };
  for (let x = reach.x0; x <= reach.x1; x += RING_PITCH) {
    b.place(b.species(kind), Math.round(x), Math.round(reach.y0), 6);
    b.place(b.species(kind), Math.round(x), Math.round(reach.y1 + 8), 6);
  }
  for (let y = reach.y0 + RING_PITCH; y < reach.y1; y += RING_PITCH) {
    b.place(b.species(kind), Math.round(reach.x0), Math.round(y), 6);
    b.place(b.species(kind), Math.round(reach.x1), Math.round(y), 6);
  }
}

/** Some houses and blocks marked by what has happened to the town: on fire, sunk, overgrown, snowed in. */
function afflictBuildings(b: MapBuilder): void {
  const { afflicted } = b.biome;
  if (!afflicted) return;
  const candidates = shuffle(b.rng, b.buildings.filter((building) => AFFLICTED_KINDS.includes(building.kind)));
  for (const building of candidates.slice(0, afflicted.count)) {
    const box = buildingBox(building);
    const radius = Math.max(box.x1 - box.x0, box.y1 - box.y0) / 2 + 24;
    b.blob((box.x0 + box.x1) / 2, (box.y0 + box.y1) / 2, radius, afflicted.patch, PATCH_OVER);
    ringBuilding(b, box, afflicted.ring);
    for (let i = 0; i < 3; i++) b.place(afflicted.litter, Math.round(box.x0 + (i + 0.5) * ((box.x1 - box.x0) / 3)), Math.round(box.y1 + 22), 6);
  }
}

/** The set pieces of the town itself, as opposed to the park: walls across streets and afflicted buildings. */
export function raiseTownPieces(b: MapBuilder, plan: TownPlan): void {
  raiseWalls(b, plan);
  afflictBuildings(b);
}
