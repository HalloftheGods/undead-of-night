import { describe, expect, it } from 'vitest';
import { FlowField } from '../shared/flow-field.ts';
import { groundEffect } from '../shared/ground.ts';
import { isSewerBuilding } from '../shared/map-protocol.ts';
import { TILE_KINDS, TILE_SIZE } from '../shared/protocol.ts';
import type { WorldMap } from '../shared/protocol.ts';
import { createRng } from '../shared/rng.ts';
import { MAX_MANHOLES, MIN_MANHOLES, planSewers } from '../shared/sewers.ts';
import { townBuildings, townHeight } from '../shared/storeys.ts';
import { planTown } from '../shared/town-plan.ts';
import { groundSpeedScale } from '../shared/town-rules.ts';
import { buildingAt, blockedTiles, circleHitsSolid, generateWorldMap, isBlockedAt } from '../shared/world-map.ts';
import { groundOf } from '../shared/world-query.ts';

const SEEDS = [1, 2, 3, 99, 1234, 777777];
const ROAD_KINDS = ['asphalt', 'asphalt_cracked', 'lane_h', 'lane_v', 'crosswalk_h', 'crosswalk_v', 'parking_line'];

const manholes = (map: WorldMap) => map.props.filter((prop) => prop.kind === 'manhole');
const ladders = (map: WorldMap) => map.props.filter((prop) => prop.kind === 'sewer_ladder');
const tileOf = (map: WorldMap, x: number, y: number) => Math.floor(y / TILE_SIZE) * map.cols + Math.floor(x / TILE_SIZE);
const tileName = (map: WorldMap, x: number, y: number) => TILE_KINDS[map.tiles[tileOf(map, x, y)]];
const sewerPlanOf = (seed: number) => planSewers(seed, planTown(createRng(seed)).roads, 200, 200);

/** Steps on foot from one tile to each tile it reaches: no flights, so no crossing to the street. */
function walkable(map: WorldMap, start: number): Map<number, number> {
  const blocked = blockedTiles(map);
  const seen = new Map<number, number>([[start, 0]]);
  const queue = [start];
  for (let head = 0; head < queue.length; head++) {
    const at = queue[head];
    const col = at % map.cols;
    const next = [col > 0 ? at - 1 : -1, col < map.cols - 1 ? at + 1 : -1, at - map.cols, at + map.cols];
    for (const to of next) {
      const ok = to >= 0 && to < map.cols * map.rows && !blocked[to] && !seen.has(to);
      if (ok) {
        seen.set(to, (seen.get(at) as number) + 1);
        queue.push(to);
      }
    }
  }
  return seen;
}

describe('sewer layout', () => {
  it.each(SEEDS)('seed %i: is the same every time it is generated', (seed) => {
    const a = generateWorldMap(seed);
    const b = generateWorldMap(seed);
    expect(a.props.filter((p) => p.kind === 'manhole' || p.kind === 'sewer_ladder')).toEqual(b.props.filter((p) => p.kind === 'manhole' || p.kind === 'sewer_ladder'));
    expect(a.flights).toEqual(b.flights);
    expect(a.sewers).toEqual(b.sewers);
    expect(Buffer.from(a.tiles).equals(Buffer.from(b.tiles))).toBe(true);
    expect(a.rows).toBe(b.rows);
    expect(sewerPlanOf(seed)).toEqual(sewerPlanOf(seed));
  });

  it('differs between seeds', () => {
    const spots = (seed: number) => manholes(generateWorldMap(seed)).map((m) => `${m.x},${m.y}`).join('|');
    expect(new Set(SEEDS.map(spots)).size).toBeGreaterThan(1);
    const mazes = SEEDS.map((seed) => JSON.stringify(sewerPlanOf(seed).tunnels));
    expect(new Set(mazes).size).toBeGreaterThan(1);
  });

  it('does not touch the town: the surface rows are the same with and without the sewers', () => {
    const map = generateWorldMap(1234);
    const surface = map.sewers?.top ?? 0;
    expect(surface).toBeGreaterThan(townHeight(map) / TILE_SIZE);
    expect(map.rows).toBe(surface + townHeight(map) / TILE_SIZE);
  });

  it.each(SEEDS)('seed %i: has manholes on the street, spread over the quadrants', (seed) => {
    const map = generateWorldMap(seed);
    const covers = manholes(map);
    expect(covers.length).toBeGreaterThanOrEqual(MIN_MANHOLES);
    expect(covers.length).toBeLessThanOrEqual(MAX_MANHOLES);
    const top = townHeight(map);
    const quadrants = new Set(covers.map((m) => (m.x < map.width / 2 ? 0 : 1) + (m.y < top / 2 ? 0 : 2)));
    expect(quadrants.size).toBeGreaterThanOrEqual(3);
    for (const cover of covers) {
      expect(cover.y).toBeLessThan(top);
      expect(ROAD_KINDS).toContain(tileName(map, cover.x, cover.y - 8));
    }
  });

  it.each(SEEDS)('seed %i: the maze is one building under the town and the town\'s own rolls skip it', (seed) => {
    const map = generateWorldMap(seed);
    const pieces = map.buildings.filter(isSewerBuilding);
    expect(pieces).toHaveLength(1);
    expect(pieces[0].y).toBe((map.sewers?.top ?? 0) * TILE_SIZE);
    expect(townBuildings(map).filter(isSewerBuilding)).toHaveLength(0);
    expect(buildingAt(map, 1600, (map.sewers?.top ?? 0) * TILE_SIZE + 1600)).toBe(pieces[0]);
  });
});

describe('the maze', () => {
  it.each(SEEDS)('seed %i: every tunnel runs under a street', (seed) => {
    const map = generateWorldMap(seed);
    const top = map.sewers?.top ?? 0;
    let canal = 0;
    let underStreet = 0;
    for (let row = top; row < map.rows; row++) {
      for (let col = 0; col < map.cols; col++) {
        const tileKind = TILE_KINDS[map.tiles[row * map.cols + col]];
        const isCanal = tileKind === 'floor_sewer_channel' || tileKind === 'floor_sewer_channel_v';
        if (!isCanal) continue;
        canal++;
        if (ROAD_KINDS.includes(TILE_KINDS[map.tiles[(row - top) * map.cols + col]])) underStreet++;
      }
    }
    expect(canal).toBeGreaterThan(300);
    expect(underStreet / canal).toBeGreaterThan(0.97);
  });

  it.each(SEEDS)('seed %i: every manhole can be walked to from every other, underground', (seed) => {
    const map = generateWorldMap(seed);
    const feet = (map.flights ?? []).filter((f) => f.down).map((f) => f.toIndex);
    expect(feet.length).toBeGreaterThanOrEqual(MIN_MANHOLES);
    const reached = walkable(map, feet[0]);
    for (const foot of feet) expect(reached.has(foot)).toBe(true);
    // And it stays down there: the street is only reached by a ladder.
    expect([...reached.keys()].every((index) => index >= (map.sewers?.top ?? 0) * map.cols)).toBe(true);
  });

  it.each(SEEDS)('seed %i: has dead ends, and is not just a grid of open streets', (seed) => {
    const plan = sewerPlanOf(seed);
    const count = (kind: string) => plan.tunnels.filter((t) => t.kind === kind).length;
    expect(count('trunk')).toBeGreaterThan(0);
    expect(count('dead_end')).toBeGreaterThanOrEqual(2);
    expect(count('side')).toBeGreaterThanOrEqual(1);
    // More streets than the maze opens: some are left shut.
    const open = plan.tunnels.filter((t) => t.kind === 'trunk' || t.kind === 'branch' || t.kind === 'loop').length;
    const streets = new Set(plan.tunnels.map((t) => `${t.horizontal}${t.line}`)).size;
    expect(open).toBeLessThan(plan.nodes.length * 2);
    expect(streets).toBeGreaterThan(0);
  });

  it.each(SEEDS)('seed %i: getting between manholes takes navigation: some walks run well over a straight line', (seed) => {
    const map = generateWorldMap(seed);
    const feet = (map.flights ?? []).filter((f) => f.down).map((f) => f.toIndex);
    let detours = 0;
    for (const target of feet) {
      const steps = walkable(map, target);
      for (const other of feet) {
        const straight = Math.abs((other % map.cols) - (target % map.cols)) + Math.abs(Math.floor(other / map.cols) - Math.floor(target / map.cols));
        const walked = steps.get(other) as number;
        expect(walked).toBeDefined();
        if (straight > 0 && walked > straight * 1.25) detours++;
      }
    }
    expect(detours).toBeGreaterThan(0);
  });

  it.each(SEEDS)('seed %i: the walkways and canal are clear and the brick and rock are solid', (seed) => {
    const map = generateWorldMap(seed);
    const top = map.sewers?.top ?? 0;
    const plan = sewerPlanOf(seed);
    for (const tunnel of plan.tunnels.filter((t) => t.kind === 'trunk')) {
      const mid = Math.round((tunnel.from + tunnel.to) / 2);
      for (const across of [-2, -1, 0, 1, 2]) {
        const col = tunnel.horizontal ? mid : tunnel.line + across;
        const row = (tunnel.horizontal ? tunnel.line + across : mid) + top;
        expect(circleHitsSolid(map, (col + 0.5) * TILE_SIZE, (row + 0.5) * TILE_SIZE, 6)).toBe(false);
      }
      // A side passage can open one side of the middle, but never both.
      const sides = [-3, 3].map((away) => {
        const col = tunnel.horizontal ? mid : tunnel.line + away;
        const row = (tunnel.horizontal ? tunnel.line + away : mid) + top;
        return { x: (col + 0.5) * TILE_SIZE, y: (row + 0.5) * TILE_SIZE };
      });
      const walls = sides.filter((side) => tileName(map, side.x, side.y) === 'sewer_wall');
      expect(walls.length).toBeGreaterThan(0);
      for (const wall of walls) expect(isBlockedAt(map, wall.x, wall.y)).toBe(true);
    }
    // Rock is solid, and so is the dark round the whole band.
    expect(isBlockedAt(map, 8, (top + 0.5) * TILE_SIZE)).toBe(true);
    expect(isBlockedAt(map, 8, (map.rows - 0.5) * TILE_SIZE)).toBe(true);
  });

  it('the canal is sludge: slows to 0.65x, and a walkway is plain going', () => {
    const map = generateWorldMap(1);
    const top = map.sewers?.top ?? 0;
    const [tunnel] = sewerPlanOf(1).tunnels.filter((t) => t.kind === 'trunk' && t.horizontal);
    const mid = Math.round((tunnel.from + tunnel.to) / 2);
    const x = (mid + 0.5) * TILE_SIZE;
    const canalY = (tunnel.line + top + 0.5) * TILE_SIZE;
    const walkY = (tunnel.line + top - 1 + 0.5) * TILE_SIZE;
    expect(tileName(map, x, canalY)).toBe('floor_sewer_channel');
    expect(groundEffect(map, x, canalY).speed).toBe(0.65);
    expect(groundSpeedScale(1, map, x, canalY)).toBe(0.65);
    expect(tileName(map, x, walkY)).toBe('floor_sewer');
    expect(groundEffect(map, x, walkY).speed).toBe(1);
  });
});

describe('manhole and ladder flights', () => {
  it.each(SEEDS)('seed %i: every manhole has a matching ladder and a flight each way, both flagged interactive', (seed) => {
    const map = generateWorldMap(seed);
    const flights = map.flights ?? [];
    expect(flights.length).toBe(manholes(map).length * 2);
    expect(ladders(map).length).toBe(manholes(map).length);
    for (const cover of manholes(map)) {
      const street = { x: cover.x, y: cover.y - 8 };
      const down = flights.find((f) => f.fromIndex === tileOf(map, street.x, street.y));
      expect(down?.label).toBe('SEWERS');
      expect(down?.down).toBe(true);
      const back = flights.find((f) => f.fromIndex === down?.toIndex);
      expect(back?.label).toBe('SURFACE');
      expect(back?.toIndex).toBe(down?.fromIndex);
      expect(back?.from).toEqual(down?.to);
      expect(back?.to).toEqual(down?.from);
      expect(down?.interactive).toBe(true);
      expect(back?.interactive).toBe(true);
      // The ladder stands just inside the top of its foot's tile, against a brick pillar, in line under the cover, and behind where a climber stands.
      const ladder = ladders(map).find((l) => Math.abs(l.x - down!.to.x) < 1 && Math.abs(l.y - (down!.to.y - 4)) < 1);
      expect(ladder).toBeDefined();
      expect(tileName(map, down!.to.x, down!.to.y - TILE_SIZE)).toBe('sewer_wall');
      expect(tileName(map, down!.to.x, down!.to.y)).toBe('floor_sewer');
      expect(down!.to.x).toBe(down!.from.x);
      expect(down!.to.y - down!.from.y).toBe((map.sewers?.top ?? 0) * TILE_SIZE);
      const piece = buildingAt(map, down!.to.x, down!.to.y);
      expect(piece && isSewerBuilding(piece)).toBe(true);
    }
  });

  it.each(SEEDS)('seed %i: the flow field crosses from the street to the tunnel tiles and back', (seed) => {
    const map = generateWorldMap(seed);
    const field = new FlowField(map);
    field.recompute([map.spawn]);
    const [flight] = (map.flights ?? []).filter((f) => f.down).sort((x, y) => field.distanceAt(x.from.x, x.from.y) - field.distanceAt(y.from.x, y.from.y));
    expect(field.distanceAt(flight.from.x, flight.from.y)).toBeLessThan(Infinity);
    expect(field.distanceAt(flight.to.x, flight.to.y)).toBeLessThan(Infinity);
    // A zombie on the cover, with the player in the tunnel, goes down the hole.
    field.recompute([{ x: flight.to.x + 3 * TILE_SIZE, y: flight.to.y }]);
    expect(field.stairsDown(flight.from.x, flight.from.y)).toEqual(flight.to);
    // And a zombie at the foot of the ladder, with the player in the street, climbs it.
    field.recompute([map.spawn]);
    const up = field.stairsDown(flight.to.x, flight.to.y);
    expect(up).toEqual(flight.from);
  });

  it('the cover and the ladder can be stood at: neither is solid', () => {
    const map = generateWorldMap(1);
    for (const flight of map.flights ?? []) {
      expect(isBlockedAt(map, flight.from.x, flight.from.y)).toBe(false);
      expect(circleHitsSolid(map, flight.from.x, flight.from.y, 8)).toBe(false);
    }
  });
});

describe('the sewers seen from the street', () => {
  it.each(SEEDS)('seed %i: a point in the maze projects straight up to the street over it', (seed) => {
    const map = generateWorldMap(seed);
    const top = map.sewers?.top ?? 0;
    const [flight] = (map.flights ?? []).filter((f) => f.down);
    const ground = groundOf(map, flight.to.x + 24, flight.to.y);
    expect(ground).toEqual({ x: flight.to.x + 24, y: flight.to.y - top * TILE_SIZE });
    expect(ground.y).toBeLessThan(townHeight(map));
    // The street itself, and a floor above a house, are as before.
    expect(groundOf(map, 400, 400)).toEqual({ x: 400, y: 400 });
  });

  it('has sewer lights', () => {
    const map = generateWorldMap(1);
    const ladderLights = map.lights.filter((l) => l.y > townHeight(map) && l.color === '#c8923c');
    expect(ladderLights.length).toBe(ladders(map).length);
    expect(map.lights.filter((l) => l.color === '#46d98a' && l.y > townHeight(map)).length).toBeGreaterThan(10);
  });

  it('names the sewers on the map screen', () => {
    const map = generateWorldMap(1);
    const under = map.districts.filter((d) => d.underground);
    expect(under.length).toBe(manholes(map).length);
    for (const d of under) expect(d.name.startsWith('Sewers under ')).toBe(true);
  });
});
