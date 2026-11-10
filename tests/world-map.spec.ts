import { backDoorBox, partitionBoxes } from '../shared/building-plans.ts';
import { describe, expect, it } from 'vitest';
import { ZOMBIES } from '../shared/constants.ts';
import { FlowField } from '../shared/flow-field.ts';
import { BUNKER_SEED } from '../shared/home-protocol.ts';
import { isSewerBuilding } from '../shared/map-protocol.ts';
import { BUILDING_DEFS, BUILDING_KINDS, DOOR_WIDTH, PROP_DEFS, TILE_KINDS, TILE_SIZE, WALL_THICKNESS } from '../shared/protocol.ts';
import type { BuildingInstance, BuildingKind, PropKind, WorldMap } from '../shared/protocol.ts';
import { buildingsWithStairs, flightsOf } from '../shared/storeys.ts';
import { createRng } from '../shared/rng.ts';
import { MAP_TILES, WALK_TILES, planTown } from '../shared/town-plan.ts';
import {
  blockedTiles,
  buildingAt,
  buildingBox,
  circleHitsSolid,
  doorBox,
  generateWorldMap,
  isSolidProp,
  propBox,
  segmentHitsSolid,
  tileKindAt,
  wallBoxes,
} from '../shared/world-map.ts';

const SEEDS = [1, 2, 3, 99, 1234, 777777];
const REQUIRED: readonly BuildingKind[] = ['pharmacy', 'clinic', 'police', 'gun_shop', 'garage', 'grocery', 'diner', 'warehouse'];
const FURNITURE: readonly PropKind[] = ['shelf', 'counter', 'table', 'sofa', 'bed', 'locker', 'fridge', 'workbench'];
/** Before the rebalance, one sampled town had one diner in every five buildings. */
const MOST_DINERS_SHARE = 0.12;

/** The town's own buildings: the floors above and below have no door and are reached by their stairs. */
const townBuildings = (map: WorldMap) => map.buildings.filter((building) => building.of === undefined);

const tileOf = (map: WorldMap, x: number, y: number): number => Math.floor(y / TILE_SIZE) * map.cols + Math.floor(x / TILE_SIZE);

function reachableFromSpawn(map: WorldMap): Uint8Array {
  const blocked = blockedTiles(map);
  const start = tileOf(map, map.spawn.x, map.spawn.y);
  const seen = new Uint8Array(blocked.length);
  const stack = [start];
  seen[start] = 1;
  while (stack.length) {
    const index = stack.pop() as number;
    const col = index % map.cols;
    const stairs = flightsOf(map).get(index)?.toIndex ?? -1;
    const manhole = map.flights?.find((flight) => flight.fromIndex === index)?.toIndex ?? -1;
    const next = [col > 0 ? index - 1 : -1, col < map.cols - 1 ? index + 1 : -1, index - map.cols, index + map.cols, stairs, manhole];
    for (const n of next) {
      if (n >= 0 && n < seen.length && !blocked[n] && !seen[n]) {
        seen[n] = 1;
        stack.push(n);
      }
    }
  }
  return seen;
}

describe('generateWorldMap', () => {
  it('is deterministic per seed and differs between seeds', () => {
    const a = generateWorldMap(99);
    const b = generateWorldMap(99);
    const other = generateWorldMap(100);
    expect(Array.from(a.tiles)).toEqual(Array.from(b.tiles));
    expect(a.props).toEqual(b.props);
    expect(a.buildings).toEqual(b.buildings);
    expect(a.lights).toEqual(b.lights);
    expect(a.props).not.toEqual(other.props);
  });

  it('reserves the bunker seed for a map of its own', () => {
    const map = generateWorldMap(BUNKER_SEED);
    expect(map.seed).toBe(BUNKER_SEED);
    expect(map.buildings).toEqual([]);
    expect(map.districts.length).toBeGreaterThan(0);
    expect(map.stations?.length).toBeGreaterThan(0);
    expect(map.exit).toBeDefined();
    expect(wallBoxes(map)).toBe(map.walls);
    expect(map.walls?.length).toBeGreaterThan(0);
    expect(circleHitsSolid(map, map.spawn.x, map.spawn.y, 8)).toBe(false);
  });

  it('generates fast', () => {
    generateWorldMap(1);
    const times = [2, 3, 4, 5, 6].map((seed) => {
      const start = performance.now();
      generateWorldMap(seed);
      return performance.now() - start;
    });
    // Wall clock, on a machine that may be running the rest of the suite.
    expect(Math.min(...times)).toBeLessThan(1000);
  });

  it.each(SEEDS)('seed %i: sized sanely with a sane prop and light count', (seed) => {
    const map = generateWorldMap(seed);
    expect(map.width).toBe(map.cols * TILE_SIZE);
    expect(map.width).toBe(3200);
    expect(map.tiles.length).toBe(map.cols * map.rows);
    expect(Math.max(...map.tiles)).toBeLessThan(TILE_KINDS.length);
    expect(map.props.length).toBeGreaterThan(800);
    expect(map.props.length).toBeLessThan(4000);
    expect(map.lights.length).toBeGreaterThan(40);
    expect(map.lights.filter((light) => light.flicker).length).toBeGreaterThan(0);
    for (const prop of map.props) {
      const box = propBox(prop);
      expect(PROP_DEFS[prop.kind]).toBeDefined();
      expect(box.x0).toBeGreaterThanOrEqual(0);
      expect(box.y0).toBeGreaterThanOrEqual(0);
      expect(box.x1).toBeLessThanOrEqual(map.width);
      expect(box.y1).toBeLessThanOrEqual(map.height);
    }
  });

  it.each(SEEDS)('seed %i: uses every kind of ground and the town fixtures', (seed) => {
    const map = generateWorldMap(seed);
    const used = new Set(Array.from(map.tiles, (index) => TILE_KINDS[index]));
    // Flood, snow, ash and sludge come only from a level's biome, which the plain town has none of, bar the trenches of the sewers.
    const biomeGround: readonly string[] = ['bunker_wall', 'water', 'snow', 'ash', 'sludge'];
    const sewerGround: readonly string[] = ['water', 'sludge'];
    const townKinds = TILE_KINDS.filter((kind) => !biomeGround.includes(kind));
    expect([...used].filter((kind) => !sewerGround.includes(kind)).sort()).toEqual([...townKinds].sort());
    expect(used.has('sludge') || used.has('water')).toBe(true);
    const kinds = new Set(map.props.map((prop) => prop.kind));
    for (const kind of ['street_lamp', 'fire_barrel', 'tree', 'dumpster', 'sandbags', 'fence_h', 'fence_v', 'gas_pump', ...FURNITURE] as const) {
      expect(kinds).toContain(kind);
    }
  });

  it.each(SEEDS)('seed %i: leaves open ground around the spawn', (seed) => {
    const map = generateWorldMap(seed);
    expect(circleHitsSolid(map, map.spawn.x, map.spawn.y, 96)).toBe(false);
    expect(buildingAt(map, map.spawn.x, map.spawn.y)).toBeNull();
  });

  it.each(SEEDS)('seed %i: starts near a building, but not next to one', (seed) => {
    const map = generateWorldMap(seed);
    const doors = townBuildings(map).map((b) => Math.hypot(doorBox(b).x0 - map.spawn.x, doorBox(b).y1 - map.spawn.y));
    expect(Math.min(...doors)).toBeGreaterThan(200);
    expect(Math.min(...doors)).toBeLessThan(700);
  });

  it.each(SEEDS)('seed %i: every free tile is connected to the spawn', (seed) => {
    const map = generateWorldMap(seed);
    const blocked = blockedTiles(map);
    const seen = reachableFromSpawn(map);
    const stranded = Array.from(blocked).filter((isBlocked, index) => !isBlocked && !seen[index]);
    expect(stranded.length).toBe(0);
    const town = blocked.subarray(0, (map.townRows ?? map.rows) * map.cols);
    expect(Array.from(town).filter(Boolean).length).toBeLessThan(town.length / 3);
  });

  it('points each curb tile at the road across its named edge', () => {
    const map = generateWorldMap(5);
    const road = new Set(['asphalt', 'asphalt_cracked', 'lane_h', 'lane_v', 'crosswalk_h', 'crosswalk_v']);
    const offsets = { curb_n: [0, -1], curb_s: [0, 1], curb_e: [1, 0], curb_w: [-1, 0] } as const;
    let curbs = 0;
    for (let row = 1; row < map.rows - 1; row++) {
      for (let col = 1; col < map.cols - 1; col++) {
        const kind = tileKindAt(map, col, row);
        if (!(kind in offsets)) continue;
        const [dc, dr] = offsets[kind as keyof typeof offsets];
        expect(road.has(tileKindAt(map, col + dc, row + dr))).toBe(true);
        curbs += 1;
      }
    }
    expect(curbs).toBeGreaterThan(500);
  });
});

describe('the town', () => {
  it.each(SEEDS)('seed %i: has every place worth raiding, and plenty of homes', (seed) => {
    const { buildings } = generateWorldMap(seed);
    const count = (kind: BuildingKind) => buildings.filter((b) => b.kind === kind).length;
    for (const kind of REQUIRED) expect(count(kind)).toBeGreaterThanOrEqual(1);
    expect(count('house')).toBeGreaterThanOrEqual(12);
    expect(count('apartment')).toBeGreaterThanOrEqual(6);
    expect(new Set(buildings.map((b) => b.id)).size).toBe(buildings.length);
  });

  it('does not let any one kind of shop swamp the town', () => {
    const shops = { diner: 0, grocery: 0 };
    for (let seed = 1; seed <= 40; seed++) {
      const { buildings } = generateWorldMap(seed);
      const diners = buildings.filter((b) => b.kind === 'diner').length;
      const groceries = buildings.filter((b) => b.kind === 'grocery').length;
      expect(diners).toBeLessThanOrEqual(buildings.length * MOST_DINERS_SHARE);
      shops.diner += diners;
      shops.grocery += groceries;
    }
    expect(shops.diner).toBeLessThanOrEqual(shops.grocery * 1.25);
  }, 30000);

  it('holds its required places over many seeds', () => {
    for (let seed = 1000; seed < 1100; seed++) {
      const kinds = new Set(generateWorldMap(seed).buildings.map((b) => b.kind));
      for (const kind of REQUIRED) expect(kinds).toContain(kind);
    }
  }, 120000);

  it('names five districts that sit on the map', () => {
    const map = generateWorldMap(3);
    const names = map.districts.filter((district) => !district.underground).map((district) => district.name).sort();
    expect(names).toEqual(['Downtown', 'Industrial Yard', 'Old Town', 'Park', 'Riverside']);
    for (const { x, y } of map.districts.filter((district) => !district.underground)) {
      expect(x).toBeGreaterThan(0);
      expect(x).toBeLessThan(map.width);
      expect(y).toBeGreaterThan(0);
      expect(y).toBeLessThan(map.height);
    }
  });

  it('lays the streets on one fixed grid, whatever the seed', () => {
    const reference = planTown(createRng(8)).roads;
    for (const seed of [1, 8, 99]) {
      const { roads } = planTown(createRng(seed));
      expect(roads).toHaveLength(10);
      expect(roads.map((road) => [road.c0, road.c1, road.r0, road.r1])).toEqual(reference.map((road) => [road.c0, road.c1, road.r0, road.r1]));
      const down = roads.filter((road) => !road.horizontal);
      const across = roads.filter((road) => road.horizontal);
      expect(down).toHaveLength(5);
      expect(across).toHaveLength(5);
      // Every street is a straight line spanning the town, so each pair of them crosses.
      for (const road of roads) expect(road.horizontal ? road.c1 - road.c0 : road.r1 - road.r0).toBeGreaterThanOrEqual(MAP_TILES - 2);
      // Streets are evenly spaced, so crossings share their X and Y.
      const centres = (list: typeof roads, horizontal: boolean) => list.map((road) => (horizontal ? road.r0 + road.r1 : road.c0 + road.c1) / 2).sort((a, c) => a - c);
      const colGaps = centres(down, false).map((centre, i, all) => centre - (all[i - 1] ?? centre)).slice(1);
      expect(new Set(colGaps).size).toBe(1);
      const rowGaps = centres(across, true).map((centre, i, all) => centre - (all[i - 1] ?? centre)).slice(1);
      expect(new Set(rowGaps).size).toBe(1);
    }
  });

  it('keeps every block clear of the streets and big enough to build in', () => {
    const { roads, blocks } = planTown(createRng(5));
    expect(blocks.length).toBeGreaterThanOrEqual(30);
    for (const block of blocks) {
      expect(block.c1 - block.c0).toBeGreaterThanOrEqual(16);
      expect(block.r1 - block.r0).toBeGreaterThanOrEqual(11);
      for (const road of roads) {
        const apart = block.c1 + WALK_TILES <= road.c0 || block.c0 - WALK_TILES >= road.c1 || block.r1 + WALK_TILES <= road.r0 || block.r0 - WALK_TILES >= road.r1;
        expect(apart).toBe(true);
      }
    }
  });

  it.each(SEEDS)('seed %i: closes the boundary with a fence', (seed) => {
    const map = generateWorldMap(seed);
    const blocked = blockedTiles(map);
    for (let i = 0; i < map.cols; i++) {
      expect(blocked[i]).toBe(1);
      expect(blocked[(map.rows - 1) * map.cols + i]).toBe(1);
      expect(blocked[i * map.cols]).toBe(1);
      expect(blocked[i * map.cols + map.cols - 1]).toBe(1);
    }
    expect(segmentHitsSolid(map, 40, 40, -40, 40)).not.toBeNull();
    expect(segmentHitsSolid(map, map.width - 40, 40, map.width + 40, 40)).not.toBeNull();
  });
});

describe('buildings', () => {
  it.each(SEEDS)('seed %i: footprints sit on the tile grid, apart, with their floors laid', (seed) => {
    const map = generateWorldMap(seed);
    for (const building of map.buildings) {
      const { w, h, floor } = BUILDING_DEFS[building.kind];
      expect(building.x % TILE_SIZE).toBe(0);
      expect(building.y % TILE_SIZE).toBe(0);
      // The sewers' pieces run together, and their trench is not floor: only their place on the grid is checked.
      const isSewer = isSewerBuilding(building);
      if (!isSewer) expect(tileKindAt(map, building.x / TILE_SIZE + 2, building.y / TILE_SIZE + 2)).toBe(floor);
      for (const other of map.buildings) {
        if (other === building || isSewer || isSewerBuilding(other)) continue;
        const a = buildingBox(building);
        const b = buildingBox(other);
        const overlapping = a.x0 < b.x1 + TILE_SIZE && a.x1 > b.x0 - TILE_SIZE && a.y0 < b.y1 + TILE_SIZE && a.y1 > b.y0 - TILE_SIZE;
        expect(overlapping).toBe(false);
      }
      expect(building.x + w).toBeLessThanOrEqual(map.width);
      expect(building.y + h).toBeLessThanOrEqual(map.height);
    }
  });

  it('has a tile-aligned door for every kind', () => {
    expect(DOOR_WIDTH % TILE_SIZE).toBe(0);
    for (const kind of BUILDING_KINDS) {
      const { w, h, doorX } = BUILDING_DEFS[kind];
      expect(w % TILE_SIZE).toBe(0);
      expect(h % TILE_SIZE).toBe(0);
      expect((doorX - DOOR_WIDTH / 2) % TILE_SIZE).toBe(0);
    }
  });

  it('wallBoxes leave exactly the door gap', () => {
    const map = generateWorldMap(2);
    const boxes = wallBoxes(map);
    const sides = (building: BuildingInstance): number => (isSewerBuilding(building) ? 0 : building.of === undefined ? 5 + (backDoorBox(building) ? 1 : 0) : 4);
    const withStairs = buildingsWithStairs(map.buildings);
    const expected = map.buildings.reduce((sum, building) => sum + sides(building) + partitionBoxes(building, withStairs.has(building.id)).length, 0);
    expect(boxes.length).toBe(expected);
    for (const building of townBuildings(map)) {
      const door = doorBox(building);
      expect(door.x1 - door.x0).toBe(DOOR_WIDTH);
      const y = (door.y0 + door.y1) / 2;
      const midX = (door.x0 + door.x1) / 2;
      expect(segmentHitsSolid(map, midX, door.y0 - 1, midX, door.y1 + 1)).toBeNull();
      expect(circleHitsSolid(map, door.x0 - 2, y, 1)).toBe(true);
      expect(circleHitsSolid(map, door.x1 + 2, y, 1)).toBe(true);
      expect(circleHitsSolid(map, midX, y, ZOMBIES.brute.radius)).toBe(false);
    }
  });

  it('a house with stairs is one open room, and one without keeps its bedroom wall', () => {
    const map = generateWorldMap(2);
    const withStairs = buildingsWithStairs(map.buildings);
    const houses = map.buildings.filter((building) => building.kind === 'house');
    const open = houses.filter((house) => withStairs.has(house.id));
    const walled = houses.filter((house) => !withStairs.has(house.id));
    expect(open.length).toBeGreaterThan(0);
    expect(walled.length).toBeGreaterThan(0);
    // The bedroom wall's middle, a little in from the north wall.
    const inWall = (house: BuildingInstance): boolean => circleHitsSolid(map, house.x + 57, house.y + 30, 1);
    for (const house of open) expect(inWall(house)).toBe(false);
    for (const house of walled) expect(inWall(house)).toBe(true);
  });

  it('wallBoxes cover the other three sides whole, but for a back door', () => {
    const map = generateWorldMap(2);
    for (const building of townBuildings(map)) {
      const { x0, y0, x1, y1 } = buildingBox(building);
      const back = backDoorBox(building);
      // Across the north wall clear of any back door: its west end, which no back door reaches.
      const northX = x0 + WALL_THICKNESS + 2;
      const midY = (y0 + y1) / 2;
      expect(segmentHitsSolid(map, northX, y0 - 1, northX, y0 + WALL_THICKNESS + 1)).not.toBeNull();
      if (back) {
        const middle = (back.x0 + back.x1) / 2;
        expect(segmentHitsSolid(map, middle, back.y0 - 1, middle, back.y1 + 1)).toBeNull();
        expect(circleHitsSolid(map, middle, (back.y0 + back.y1) / 2, ZOMBIES.brute.radius)).toBe(false);
      }
      expect(segmentHitsSolid(map, x0 - 1, midY, x0 + WALL_THICKNESS + 1, midY)).not.toBeNull();
      expect(segmentHitsSolid(map, x1 + 1, midY, x1 - WALL_THICKNESS - 1, midY)).not.toBeNull();
    }
  });

  it.each(SEEDS)('seed %i: every door opens onto paving that leads to the spawn', (seed) => {
    const map = generateWorldMap(seed);
    const seen = reachableFromSpawn(map);
    const paved = new Set(['sidewalk', 'curb_n', 'curb_s', 'curb_e', 'curb_w']);
    for (const building of townBuildings(map)) {
      const door = doorBox(building);
      const midX = (door.x0 + door.x1) / 2;
      const inside = tileOf(map, midX, door.y0 - TILE_SIZE);
      const outside = tileOf(map, midX, door.y1 + 2);
      expect(seen[inside]).toBe(1);
      expect(seen[outside]).toBe(1);
      const kind = tileKindAt(map, Math.floor(midX / TILE_SIZE), Math.floor((door.y1 + 2) / TILE_SIZE));
      expect(paved.has(kind)).toBe(true);
    }
  });

  it.each(SEEDS)('seed %i: a flow field walks a brute-sized body from every door to the spawn', (seed) => {
    const map = generateWorldMap(seed);
    const field = new FlowField(map);
    field.recompute([map.spawn]);
    for (const building of townBuildings(map)) {
      const door = doorBox(building);
      expect(field.distanceAt((door.x0 + door.x1) / 2, door.y0 - TILE_SIZE)).toBeLessThan(Infinity);
    }
  });

  it.each(SEEDS)('seed %i: furniture stays indoors and keeps the doorway clear', (seed) => {
    const map = generateWorldMap(seed);
    const pieces = map.props.filter((prop) => FURNITURE.includes(prop.kind));
    expect(pieces.length).toBeGreaterThan(map.buildings.length);
    for (const prop of pieces) {
      const box = propBox(prop);
      const owner = buildingAt(map, prop.x, prop.y - 1);
      expect(owner).not.toBeNull();
      if (!owner) continue;
      const room = buildingBox(owner);
      expect(box.x0).toBeGreaterThanOrEqual(room.x0 + WALL_THICKNESS);
      expect(box.x1).toBeLessThanOrEqual(room.x1 - WALL_THICKNESS);
      expect(box.y1).toBeLessThanOrEqual(room.y1 - WALL_THICKNESS);
      const door = doorBox(owner);
      const inDoorway = owner.of === undefined && box.x0 < door.x1 && box.x1 > door.x0 && box.y1 > door.y0 - TILE_SIZE * 2;
      expect(inDoorway).toBe(false);
    }
  });

  it.each(SEEDS)('seed %i: leaves outdoor scenery outdoors', (seed) => {
    const map = generateWorldMap(seed);
    const scenery = map.props.filter((prop) => !isSolidProp(prop));
    expect(scenery.length).toBeGreaterThan(0);
    expect(scenery.filter((prop) => buildingAt(map, prop.x, prop.y))).toEqual([]);
  });

  it('buildingAt finds the footprint, door included, and null outdoors', () => {
    const map = generateWorldMap(4);
    const [building] = map.buildings;
    const { x0, y0, x1, y1 } = buildingBox(building);
    const door = doorBox(building);
    expect(buildingAt(map, (x0 + x1) / 2, (y0 + y1) / 2)).toBe(building);
    expect(buildingAt(map, door.x0 + 1, door.y1 - 1)).toBe(building);
    expect(buildingAt(map, door.x0 + 1, door.y1 + 1)).toBeNull();
    expect(buildingAt(map, -5, 10)).toBeNull();
  });
});

describe('solid queries', () => {
  const map = generateWorldMap(1);
  const solid = map.props.find((prop) => prop.kind === 'dumpster');
  if (!solid) throw new Error('no dumpster');
  const box = propBox(solid);
  const midY = (box.y0 + box.y1) / 2;

  it('propBox matches the footprint rule and flags walk-through scenery', () => {
    expect(box).toEqual({ x0: solid.x - 15, y0: solid.y - 14, x1: solid.x + 15, y1: solid.y });
    expect(isSolidProp(solid)).toBe(true);
    expect(isSolidProp({ kind: 'bush', x: 0, y: 0 })).toBe(false);
  });

  it('circleHitsSolid finds edges and ignores near misses', () => {
    expect(circleHitsSolid(map, box.x0 - 5, midY, 6)).toBe(true);
    expect(circleHitsSolid(map, box.x0 - 7, midY, 6)).toBe(false);
  });

  it('segmentHitsSolid reports the entry point from either side', () => {
    expect(segmentHitsSolid(map, box.x0 - 30, midY, box.x1 + 30, midY)).toEqual({ x: box.x0, y: midY });
    expect(segmentHitsSolid(map, box.x1 + 30, midY, box.x0 - 30, midY)).toEqual({ x: box.x1, y: midY });
    expect(segmentHitsSolid(map, box.x0 - 30, midY, box.x0 - 1, midY)).toBeNull();
  });

  it('segmentHitsSolid works on steep, long and degenerate segments', () => {
    const hit = segmentHitsSolid(map, box.x0 + 10, box.y0 - 12, box.x0 + 12, box.y1 + 12);
    expect(hit?.y).toBeCloseTo(box.y0, 5);
    const inside = segmentHitsSolid(map, box.x0 + 5, midY, box.x0 + 5, midY);
    expect(inside).toEqual({ x: box.x0 + 5, y: midY });
  });

  it('does not return the far side of a box wider than one tile before a nearer hit', () => {
    const from = { x: box.x0 - 26, y: box.y0 + 1 };
    const hit = segmentHitsSolid(map, from.x, from.y, box.x1 + 26, box.y1 - 1);
    expect(hit?.x).toBeCloseTo(box.x0, 5);
  });

  it('walls are solid to every query', () => {
    const [building] = map.buildings;
    const room = buildingBox(building);
    const midY2 = (room.y0 + room.y1) / 2;
    expect(segmentHitsSolid(map, room.x0 - 10, midY2, room.x0 + 10, midY2)).toEqual({ x: room.x0, y: midY2 });
    expect(circleHitsSolid(map, room.x0 - 5, midY2, 6)).toBe(true);
    expect(blockedTiles(map)[tileOf(map, room.x0 + 1, midY2)]).toBe(1);
  });
});
