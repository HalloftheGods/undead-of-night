import { generateBunkerMap } from './bunker-map.ts';
import { isBunkerSeed } from './home-protocol.ts';
import { BUILDING_DEFS, TILE_KINDS, TILE_SIZE } from './protocol.ts';
import type { MapLight, PropInstance, WorldMap } from './protocol.ts';
import { biomeFor } from './biomes.ts';
import { MapBuilder } from './map-builder.ts';
import { createRng, randRange } from './rng.ts';
import type { Rng } from './rng.ts';
import { hasDiscountStore, raiseBuildings } from './town-buildings.ts';
import { raiseTownPieces } from './town-pieces.ts';
import { EDGE_TILES, MAP_TILES, planTown, rectBox } from './town-plan.ts';
import { dressStreets, paintStreets } from './town-streets.ts';
import { fillPark, fillVerge, raiseFence } from './world-blocks.ts';
import { furnish } from './building-interiors.ts';
import { withSewers } from './sewers.ts';
import { flightsOf, planStoreys } from './storeys.ts';
import { blockedTiles, buildingBox, isSolidProp, propBox } from './world-query.ts';

export {
  blockedTiles,
  buildingAt,
  buildingBox,
  circleHitsSolid,
  doorBox,
  isBlockedAt,
  isSolidProp,
  propBox,
  segmentHitsSolid,
  wallBoxes,
} from './world-query.ts';
export type { Box } from './world-query.ts';

/** Depth of the strip the verge scatter works in, along each edge of the map. */
const VERGE_TILES = 6;
/** A terrain patch reaches at most this many radii (the blob's ragged edge); none may touch the spawn. */
const SPAWN_CLEARANCE = 1.1;

const STOREY_FURNISH_SALT = 0x464c5253;

const SODIUM = '#ffb066';
const COOL = '#9ad0ff';
const FIRE = '#ff7a2e';
/** Dim sodium at each ladder; the tunnels' own emergency green lamps come with the sewer plan. */
const SEWER_SODIUM = '#c8923c';

function freeTilesReached(blocked: Uint8Array, cols: number, rows: number, start: number, stairs: ReadonlyMap<number, { readonly toIndex: number }>): Uint8Array {
  const seen = new Uint8Array(cols * rows);
  const stack = [start];
  seen[start] = 1;
  while (stack.length) {
    const index = stack.pop() as number;
    const col = index % cols;
    const neighbours = [
      col > 0 ? index - 1 : -1,
      col < cols - 1 ? index + 1 : -1,
      index - cols,
      index + cols,
      stairs.get(index)?.toIndex ?? -1,
    ];
    for (const next of neighbours) {
      const onMap = next >= 0 && next < cols * rows;
      const isUnvisitedFloor = onMap && !blocked[next] && !seen[next];
      if (isUnvisitedFloor) {
        seen[next] = 1;
        stack.push(next);
      }
    }
  }
  return seen;
}

/** Every way between floors, by the tile it starts from: the stairs, and the manholes and ladders. */
function crossings(base: WorldMap): ReadonlyMap<number, { readonly toIndex: number }> {
  const all = new Map<number, { readonly toIndex: number }>(flightsOf(base));
  for (const flight of base.flights ?? []) all.set(flight.fromIndex, flight);
  return all;
}

function nearestSolid(props: readonly PropInstance[], x: number, y: number): number {
  let bestIndex = -1;
  let bestDistance = Infinity;
  props.forEach((prop, index) => {
    if (!isSolidProp(prop)) return;
    const box = propBox(prop);
    const dx = x - Math.max(box.x0, Math.min(x, box.x1));
    const dy = y - Math.max(box.y0, Math.min(y, box.y1));
    const distance = dx * dx + dy * dy;
    const isNearer = distance < bestDistance;
    if (isNearer) {
      bestDistance = distance;
      bestIndex = index;
    }
  });
  return bestIndex;
}

/** Removes solids until every free tile is reachable from the spawn. */
function connectedProps(base: WorldMap): PropInstance[] {
  const props = [...base.props];
  const spawnTile = Math.floor(base.spawn.y / TILE_SIZE) * base.cols + Math.floor(base.spawn.x / TILE_SIZE);
  for (;;) {
    const blocked = blockedTiles({ ...base, props });
    const seen = freeTilesReached(blocked, base.cols, base.rows, spawnTile, crossings(base));
    const stranded = blocked.findIndex((isBlocked, index) => !isBlocked && !seen[index]);
    const hasNoStranded = stranded < 0;
    if (hasNoStranded) return props;
    const x = ((stranded % base.cols) + 0.5) * TILE_SIZE;
    const y = (Math.floor(stranded / base.cols) + 0.5) * TILE_SIZE;
    props.splice(nearestSolid(props, x, y), 1);
  }
}

/** Drifts, flood, ash or sludge laid over the finished town in ragged patches, inside the fence. */
function spreadTerrain(b: MapBuilder): void {
  const { terrain } = b.biome;
  if (!terrain) return;
  const size = MAP_TILES * TILE_SIZE;
  const inner = EDGE_TILES * TILE_SIZE + TILE_SIZE;
  for (let i = 0; i < terrain.count; i++) {
    const radius = randRange(b.rng, terrain.radius[0], terrain.radius[1]);
    const x = randRange(b.rng, inner, size - inner);
    const y = randRange(b.rng, inner, size - inner);
    // The patch the park's spawn stands on stays clear: a drift is never laid over the safe square.
    const coversSpawn = Math.hypot(x - b.spawn.x, y - b.spawn.y) < radius * SPAWN_CLEARANCE;
    if (!coversSpawn) b.blob(x, y, radius, terrain.tile, terrain.over);
  }
}

/** The candles in the jack-o'-lanterns: an orange pool over a home's front step, centred on its door just right of the bowl. */
const JACK_GLOW = '#ff8a2a';
const JACK_RADIUS = 100;
const JACK_TO_DOOR = 25;
const JACK_UP = 10;

/** The bulbs strung along the fireworks bus: a warm pool over its hatch and a pink one at each end, up on its side. */
const BUS_GLOWS: readonly (readonly [dx: number, radius: number, color: string])[] = [[0, 130, '#ffb04a'], [-40, 84, '#ff7ad0'], [40, 84, '#ff7ad0']];
const BUS_GLOW_DOWN = -14;

function lightsFor(props: readonly PropInstance[], rng: Rng, sewerLamps: readonly MapLight[]): MapLight[] {
  const lights: MapLight[] = [];
  for (const prop of props) {
    const isSewerLadder = prop.kind === 'sewer_ladder';
    if (isSewerLadder) lights.push({ x: prop.x, y: prop.y + 10, radius: 96, color: SEWER_SODIUM, flicker: false });
    const isFireworksBus = prop.kind === 'fireworks_bus';
    if (isFireworksBus) for (const [dx, radius, color] of BUS_GLOWS) lights.push({ x: prop.x + dx, y: prop.y + BUS_GLOW_DOWN, radius, color, flicker: true });
    const isCandyBowl = prop.kind === 'candy_bowl';
    if (isCandyBowl) lights.push({ x: prop.x + JACK_TO_DOOR, y: prop.y - JACK_UP, radius: JACK_RADIUS, color: JACK_GLOW, flicker: true });
    const isRadioTower = prop.kind === 'radio_tower';
    if (isRadioTower) {
      lights.push({ x: prop.x, y: prop.y - 100, radius: 110, color: '#ff2222', flicker: true });
      lights.push({ x: prop.x, y: prop.y - 50, radius: 60, color: '#ff2222', flicker: true });
    }
    const isFireBarrel = prop.kind === 'fire_barrel';
    if (isFireBarrel) {
      lights.push({ x: prop.x, y: prop.y - 6, radius: 74, color: FIRE, flicker: true });
    } else {
      const isStreetLamp = prop.kind === 'street_lamp';
      if (isStreetLamp) {
        const roll = rng();
        const isDeadLamp = roll < 0.25;
        if (isDeadLamp) continue; // Dead lamp: dark gaps keep the flashlight useful.
        const color = roll < 0.55 ? COOL : SODIUM;
        lights.push({ x: prop.x, y: prop.y + 2, radius: 104, color, flicker: roll > 0.85 });
      }
    }
  }
  // Last, so the town's own lamps keep their places in the list.
  lights.push(...sewerLamps);
  return lights;
}

/**
 * Lays the floors above and below some houses out in a strip under the town: the town's tiles carry on
 * unchanged at the top, then dark, then each floor with its own floorboards and furniture.
 */
function withStoreys(town: WorldMap): WorldMap {
  const plan = planStoreys(town.seed, town.buildings, town.cols, town.rows);
  const hasNoStoreys = plan.rows === 0;
  if (hasNoStoreys) return town;
  const rows = town.rows + plan.rows;
  const annex = new MapBuilder(town.cols, rows, createRng(town.seed ^ STOREY_FURNISH_SALT), town.spawn);
  annex.tiles.set(town.tiles);
  annex.fill({ x0: 0, y0: town.height, x1: town.width, y1: rows * TILE_SIZE }, 'void');
  for (const storey of plan.storeys) {
    annex.fill(buildingBox(storey), BUILDING_DEFS[storey.kind].floor);
    furnish(annex, storey);
  }
  return {
    ...town,
    height: rows * TILE_SIZE,
    rows,
    townRows: town.rows,
    tiles: annex.tiles,
    props: [...town.props, ...annex.props],
    buildings: [...town.buildings, ...plan.storeys],
  };
}

/** Deterministic: the same seed and level yield the same map on the server and every client. The level picks the biome. */
export function generateWorldMap(seed: number, level = 1): WorldMap {
  if (isBunkerSeed(seed)) return generateBunkerMap();
  const rng = createRng(seed);
  const size = MAP_TILES * TILE_SIZE;
  const plan = planTown(rng);
  const builder = new MapBuilder(MAP_TILES, MAP_TILES, rng, plan.spawn, biomeFor(level));

  builder.fill({ x0: 0, y0: 0, x1: size, y1: size }, builder.biome.ground);
  fillPark(builder, rectBox(plan.park));
  const roadMask = paintStreets(builder, plan.roads);
  raiseFence(builder);
  raiseBuildings(builder, plan, hasDiscountStore(seed));
  dressStreets(builder, plan.roads, roadMask);
  raiseTownPieces(builder, plan);

  const verge = VERGE_TILES * TILE_SIZE;
  fillVerge(builder, { x0: 0, y0: 0, x1: size, y1: verge });
  fillVerge(builder, { x0: 0, y0: size - verge, x1: size, y1: size });
  fillVerge(builder, { x0: 0, y0: verge, x1: verge, y1: size - verge });
  fillVerge(builder, { x0: size - verge, y0: verge, x1: size, y1: size - verge });

  spreadTerrain(builder);

  const town: WorldMap = {
    seed,
    width: size,
    height: size,
    cols: MAP_TILES,
    rows: MAP_TILES,
    tiles: builder.tiles,
    props: builder.props,
    buildings: builder.buildings,
    districts: plan.districts,
    lights: [],
    spawn: plan.spawn,
  };
  const base = withSewers(withStoreys(town), plan.roads);
  const props = connectedProps(base);
  return { ...base, props, lights: lightsFor(props, rng, base.sewers?.lamps ?? []) };
}

export const tileKindAt = (map: WorldMap, col: number, row: number) => TILE_KINDS[map.tiles[row * map.cols + col]];
