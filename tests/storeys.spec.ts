import { describe, expect, it } from 'vitest';
import { FlowField } from '../shared/flow-field.ts';
import { makeNoise } from '../shared/zombie-senses.ts';
import { FLOOR_LAYER, flightAt, flightsOf, isStorey, layerBounds, planStoreys, stairsPoint, stairsPoints, townBuildings, townHeight } from '../shared/storeys.ts';
import type { StoreyKind } from '../shared/storeys.ts';
import { Camera } from '../src/engine/camera.ts';
import { isSewerBuilding } from '../shared/map-protocol.ts';
import { BUILDING_DEFS, TILE_SIZE } from '../shared/protocol.ts';
import type { BuildingInstance, WorldMap } from '../shared/protocol.ts';
import { townContainers } from '../shared/containers.ts';
import { buildingAt, circleHitsSolid, generateWorldMap, segmentHitsSolid } from '../shared/world-map.ts';
import { addRoamer, addZombie, eventsOf, input, quietSim, stepUntil } from './helpers/sim-harness.ts';

const SEEDS = [1, 2, 3, 99, 1234, 777777];

/** A floor of a house, as opposed to a piece of the sewers, which is reached the same way but belongs to none. */
const isFloor = (building: BuildingInstance): boolean => isStorey(building) && !isSewerBuilding(building);

const houseOf = (map: WorldMap, storey: BuildingInstance): BuildingInstance =>
  map.buildings.find((building) => building.id === storey.of) as BuildingInstance;

describe('floors above and below', () => {
  it.each(SEEDS)('seed %i: some houses have one, laid out below the town on the same plan', (seed) => {
    const map = generateWorldMap(seed);
    const storeys = map.buildings.filter(isFloor);
    expect(storeys.length).toBeGreaterThan(5);
    expect(map.buildings.filter((b) => b.kind === 'upstairs').length).toBeGreaterThan(0);
    expect(map.buildings.filter((b) => b.kind === 'cellar').length).toBeGreaterThan(0);
    expect(townBuildings(map).length + storeys.length + map.buildings.filter(isSewerBuilding).length).toBe(map.buildings.length);
    for (const storey of storeys) {
      expect(['house', 'apartment', 'hospital', 'school']).toContain(houseOf(map, storey).kind);
      expect(storey.y).toBeGreaterThanOrEqual(townHeight(map));
      expect(buildingAt(map, storey.x + 40, storey.y + 40)).toBe(storey);
    }
  });

  it.each(SEEDS)('seed %i: each floor lies directly under its house, a whole town down per layer', (seed) => {
    const map = generateWorldMap(seed);
    const town = townHeight(map);
    for (const storey of map.buildings.filter(isFloor)) {
      const house = houseOf(map, storey);
      const layer = FLOOR_LAYER[storey.kind as StoreyKind];
      expect(storey.x).toBe(house.x);
      expect(storey.y).toBe(house.y + layer * town);
      expect(BUILDING_DEFS[storey.kind].w).toBe(BUILDING_DEFS[house.kind].w);
      expect(BUILDING_DEFS[storey.kind].h).toBe(BUILDING_DEFS[house.kind].h);
    }
    expect(map.townRows! * 3).toBeLessThanOrEqual(map.sewers?.top ?? map.rows);
  });

  it('says which layer a point is on: the town, upstairs, the cellars or the sewers', () => {
    const map = generateWorldMap(2);
    const town = townHeight(map);
    expect(layerBounds(map, 10)).toEqual({ y0: 0, y1: town });
    expect(layerBounds(map, town + 10)).toEqual({ y0: town, y1: town * 2 });
    expect(layerBounds(map, town * 2 + 10)).toEqual({ y0: town * 2, y1: town * 3 });
    const sewerTop = map.sewers!.top * TILE_SIZE;
    expect(layerBounds(map, sewerTop + 10)).toEqual({ y0: sewerTop, y1: map.height });
  });

  it('keeps the camera inside the layer it is on, framing a floor as its house is framed', () => {
    const map = generateWorldMap(2);
    const town = townHeight(map);
    const camera = new Camera();
    camera.setView(320, 180);
    const house = map.buildings.find((b) => b.kind === 'house' && map.buildings.some((f) => f.of === b.id))!;
    camera.setWorld(map.width, town, 0);
    camera.follow(house.x, house.y, null, null, 0);
    const onHouse = { left: camera.left, top: camera.top };
    camera.setWorld(map.width, town, town);
    camera.follow(house.x, house.y + town, null, null, 0);
    expect(camera.left).toBe(onHouse.left);
    expect(camera.top).toBe(onHouse.top + town);
    camera.follow(house.x, town + 4, null, null, 0);
    expect(camera.top).toBe(town);
  });

  it.each(SEEDS)('seed %i: every apartment block has a second floor', (seed) => {
    const map = generateWorldMap(seed);
    const blocks = map.buildings.filter((b) => b.kind === 'apartment');
    expect(blocks.length).toBeGreaterThan(0);
    for (const block of blocks) {
      const upstairs = map.buildings.find((b) => b.of === block.id);
      expect(upstairs?.kind).toBe('apartment_upstairs');
      for (const stairs of stairsPoints(block)) {
        expect(flightAt(map, stairs.x, stairs.y)?.label).toBe('UPSTAIRS');
      }
    }
  });

  it('leaves the town itself as it was', () => {
    const map = generateWorldMap(2);
    const plan = planStoreys(map.seed, townBuildings(map), map.townRows ?? map.rows);
    // The sewers lay their own band under the floors, so the floors' rows are the town's plus theirs, up to the first sewer piece.
    const firstSewerRow = Math.min(...map.buildings.filter(isSewerBuilding).map((building) => building.y / TILE_SIZE));
    expect(Math.max(...map.buildings.filter(isFloor).map((storey) => (storey.y + BUILDING_DEFS[storey.kind].h) / TILE_SIZE))).toBeLessThanOrEqual((map.townRows ?? 0) + plan.rows);
    expect(firstSewerRow).toBeGreaterThanOrEqual((map.townRows ?? 0) + plan.rows);
    expect(townHeight(map)).toBe(3200);
  });

  it.each(SEEDS)('seed %i: every pair of stairs leads both ways, and a brute fits on them', (seed) => {
    const map = generateWorldMap(seed);
    const storeys = map.buildings.filter(isFloor);
    const expectedFlights = storeys.reduce((sum, storey) => sum + stairsPoints(storey).length * 2, 0);
    expect(flightsOf(map).size).toBe(expectedFlights);
    for (const storey of storeys) {
      const storeyStairs = stairsPoints(storey);
      const houseStairs = stairsPoints(houseOf(map, storey));
      expect(storeyStairs.length).toBe(houseStairs.length);
      for (let i = 0; i < storeyStairs.length; i++) {
        const up = storeyStairs[i];
        const down = houseStairs[i];
        expect(flightAt(map, down.x, down.y)?.to).toEqual(up);
        expect(flightAt(map, up.x, up.y)?.to).toEqual(down);
        expect(circleHitsSolid(map, up.x, up.y, 11)).toBe(false);
        expect(circleHitsSolid(map, down.x, down.y, 11)).toBe(false);
      }
    }
  });

  it.each(SEEDS)('seed %i: the flow field walks from the spawn up and down every flight', (seed) => {
    const map = generateWorldMap(seed);
    const field = new FlowField(map);
    field.recompute([map.spawn]);
    for (const storey of map.buildings.filter(isFloor)) {
      expect(field.distanceAt(storey.x + 40, storey.y + 70)).toBeLessThan(Infinity);
    }
  });

  it('is walled off from the town and from each other: nothing is seen or shot across the dark', () => {
    const map = generateWorldMap(1);
    const [first, second] = map.buildings.filter(isFloor);
    const middle = (b: BuildingInstance) => ({ x: b.x + 56, y: b.y + 72 });
    const a = middle(first);
    const b = middle(second);
    expect(segmentHitsSolid(map, a.x, a.y, b.x, b.y)).not.toBeNull();
    expect(segmentHitsSolid(map, a.x, a.y, a.x, townHeight(map) - 40)).not.toBeNull();
  });

  it('has its own containers to search, upstairs and down', () => {
    const map = generateWorldMap(1);
    const found = townContainers(map).filter((container) => container.upOrDown);
    expect(found.some((container) => container.buildingKind === 'upstairs')).toBe(true);
    expect(found.some((container) => container.buildingKind === 'cellar')).toBe(true);
  });
});

describe('taking the stairs', () => {
  function onStairs() {
    const { sim, state } = quietSim();
    const storey = state.map.buildings.find(isFloor) as BuildingInstance;
    const house = houseOf(state.map, storey);
    const [p] = state.players;
    const down = stairsPoint(house)!;
    p.x = down.x;
    p.y = down.y;
    return { sim, state, p, storey, house };
  }

  it('walking onto the stairs takes them, with no key, and walking off and back on comes back', () => {
    const { sim, state, p, storey, house } = onStairs();
    // Start a step east of the stairs and walk onto them.
    p.x += TILE_SIZE;
    sim.setInput('a', input({ seq: 1, left: true }));
    const took = stepUntil(sim, () => buildingAt(state.map, p.x, p.y) === storey, 60);
    expect(took).toBeGreaterThan(0);
    const events = eventsOf(sim.snapshot(), 'stairs_taken');
    expect(events[0]?.to).toBe(storey.kind === 'cellar' ? 'CELLAR' : 'UPSTAIRS');

    // Standing on the stairs you came out on does not carry you straight back.
    sim.setInput('a', input({ seq: 2 }));
    for (let tick = 0; tick < 10; tick++) sim.step();
    expect(buildingAt(state.map, p.x, p.y)).toBe(storey);
    expect(p.indoors).toBe(storey.id);

    // Off them and back on again goes back down.
    sim.setInput('a', input({ seq: 3, right: true }));
    stepUntil(sim, () => flightAt(state.map, p.x, p.y) === null, 60);
    expect(buildingAt(state.map, p.x, p.y)).toBe(storey);
    sim.setInput('a', input({ seq: 4, left: true }));
    const back = stepUntil(sim, () => buildingAt(state.map, p.x, p.y) === house, 60);
    expect(back).toBeGreaterThan(0);
  });

  it('a zombie on your heels follows you up', () => {
    const { sim, state, p, storey } = onStairs();
    sim.step();
    expect(buildingAt(state.map, p.x, p.y)).toBe(storey);
    const down = stairsPoint(houseOf(state.map, storey))!;
    const z = addZombie(state, 'walker', down.x + 16, down.y + 4);
    const followed = stepUntil(sim, () => buildingAt(state.map, z.x, z.y) === storey, 600);
    expect(followed).toBeGreaterThan(0);
    expect(Math.hypot(z.x - p.x, z.y - p.y)).toBeLessThan(120);
  });

  it('a shot upstairs is heard around the house, not across the strip', () => {
    const { state, storey } = onStairs();
    const house = houseOf(state.map, storey);
    const near = addRoamer(state, 'walker', house.x + 56, house.y + 140);
    const far = addRoamer(state, 'walker', storey.x + 56, townHeight(state.map) - 60);
    makeNoise(state, storey.x + 56, storey.y + 50, 200);
    expect(near.mode).toBe('alert');
    expect(far.mode).toBe('wander');
  });
});
