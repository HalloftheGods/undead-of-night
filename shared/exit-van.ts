import { EXIT_CLEARANCE, PLAYER_RADIUS } from './constants.ts';
import { FlowField } from './flow-field.ts';
import type { Point } from './flow-field.ts';
import { TILE_KINDS, TILE_SIZE } from './protocol.ts';
import type { TileKind, WorldMap } from './protocol.ts';
import { createRng, pick } from './rng.ts';
import { blockedTiles, buildingAt, circleHitsSolid } from './world-query.ts';
import type { Box } from './world-query.ts';

/** The van parks in the last stretch of the walk out from the spawn: this share of the longest walk or more. */
const FAR_WALK_SHARE = 0.75;
const EXIT_SEED_SALT = 0xe817;
const ROAD_TILES: ReadonlySet<TileKind> = new Set<TileKind>(['asphalt', 'asphalt_cracked', 'lane_h', 'lane_v', 'parking_line']);

/**
 * The van's solid body: half its width either side of the exit spot and a shallow strip of ground
 * behind it. Its corners sit inside EXIT_CLEARANCE, so open ground rings it and nobody is boxed in.
 */
const VAN_HALF_WIDTH = 24;
const VAN_DEPTH = 16;

/** Room for a body at the van's side, just clear of it, so someone can stand there and wait for the rest. */
function roomBeside(map: WorldMap, x: number, y: number): boolean {
  return !circleHitsSolid(map, x + VAN_HALF_WIDTH + PLAYER_RADIUS + 1, y - 2, PLAYER_RADIUS);
}

interface ExitCandidate extends Point {
  readonly steps: number;
  readonly onRoad: boolean;
}

/** Where the van parks per map. Settled once, before the van itself is solid, so its own body cannot move it. */
const spots = new WeakMap<WorldMap, Point>();

function exitCandidates(map: WorldMap, walk: FlowField): ExitCandidate[] {
  const found: ExitCandidate[] = [];
  for (let row = 0; row < map.rows; row++) {
    for (let col = 0; col < map.cols; col++) {
      const x = (col + 0.5) * TILE_SIZE;
      const y = (row + 0.5) * TILE_SIZE;
      const steps = walk.distanceAt(x, y);
      const clearOfEdge = x > EXIT_CLEARANCE && y > EXIT_CLEARANCE && x < map.width - EXIT_CLEARANCE && y < map.height - EXIT_CLEARANCE;
      const parkable = Number.isFinite(steps) && clearOfEdge && buildingAt(map, x, y) === null && !circleHitsSolid(map, x, y, EXIT_CLEARANCE) && roomBeside(map, x, y);
      if (parkable) {
        const tile = map.tiles ? TILE_KINDS[map.tiles[row * map.cols + col]] : undefined;
        found.push({ x, y, steps, onRoad: Boolean(tile && ROAD_TILES.has(tile)) });
      }
    }
  }
  return found;
}

function pickExitSpot(map: WorldMap): Point | null {
  const walk = new FlowField(map);
  walk.recompute([map.spawn]);
  const candidates = exitCandidates(map, walk);
  const hasNoCandidates = candidates.length === 0;
  if (hasNoCandidates) return null;

  const longestWalk = candidates.reduce((most, spot) => Math.max(most, spot.steps), 0);
  const farOut = candidates.filter((spot) => spot.steps >= longestWalk * FAR_WALK_SHARE);
  const farRoads = farOut.filter((spot) => spot.onRoad);
  const { x, y } = pick(createRng(map.seed ^ EXIT_SEED_SALT), farRoads.length > 0 ? farRoads : farOut);
  return { x, y };
}

export function vanBoxAt(spot: Point): Box {
  return { x0: spot.x - VAN_HALF_WIDTH, y0: spot.y - VAN_DEPTH, x1: spot.x + VAN_HALF_WIDTH, y1: spot.y };
}

/**
 * Called once as a map's solids are indexed, after the walls and props are in and before the van is:
 * settles the exit spot and hands back the van's body, or null when the town has nowhere to park it.
 */
export function settleVan(map: WorldMap): Box | null {
  const spot = map.exit ?? pickExitSpot(map);
  spots.set(map, spot ?? map.spawn);
  return spot ? vanBoxAt(spot) : null;
}

/** Open outdoor ground a long walk from the spawn, on a road if one is out there. Depends only on the map, so it is the same on every side. */
export function exitSpotOf(map: WorldMap): Point {
  blockedTiles(map);
  return spots.get(map) ?? map.spawn;
}
