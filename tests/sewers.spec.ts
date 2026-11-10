import { describe, expect, it } from 'vitest';
import { FlowField } from '../shared/flow-field.ts';
import { groundEffect } from '../shared/ground.ts';
import { isSewerBuilding } from '../shared/map-protocol.ts';
import { TILE_SIZE } from '../shared/protocol.ts';
import type { BuildingInstance, WorldMap } from '../shared/protocol.ts';
import { MAX_MANHOLES, MIN_MANHOLES } from '../shared/sewers.ts';
import { townBuildings, townHeight } from '../shared/storeys.ts';
import { groundSpeedScale } from '../shared/town-rules.ts';
import { buildingAt, circleHitsSolid, generateWorldMap, isBlockedAt } from '../shared/world-map.ts';
import { groundOf } from '../shared/world-query.ts';

const SEEDS = [1, 2, 3, 99, 1234, 777777];

const sewerPieces = (map: WorldMap): BuildingInstance[] => map.buildings.filter(isSewerBuilding);
const manholes = (map: WorldMap) => map.props.filter((prop) => prop.kind === 'manhole');
const ladders = (map: WorldMap) => map.props.filter((prop) => prop.kind === 'sewer_ladder');
const tileOf = (map: WorldMap, x: number, y: number) => Math.floor(y / TILE_SIZE) * map.cols + Math.floor(x / TILE_SIZE);

describe('sewer layout', () => {
  it.each(SEEDS)('seed %i: is the same every time it is generated', (seed) => {
    const a = generateWorldMap(seed);
    const b = generateWorldMap(seed);
    expect(a.props.filter((p) => p.kind === 'manhole' || p.kind === 'sewer_ladder')).toEqual(b.props.filter((p) => p.kind === 'manhole' || p.kind === 'sewer_ladder'));
    expect(sewerPieces(a)).toEqual(sewerPieces(b));
    expect(a.flights).toEqual(b.flights);
    expect(Buffer.from(a.tiles).equals(Buffer.from(b.tiles))).toBe(true);
    expect(a.rows).toBe(b.rows);
  });

  it('differs between seeds', () => {
    const spots = (seed: number) => manholes(generateWorldMap(seed)).map((m) => `${m.x},${m.y}`).join('|');
    expect(new Set(SEEDS.map(spots)).size).toBeGreaterThan(1);
  });

  it.each(SEEDS)('seed %i: has four to six manholes on the street, spread over the quadrants', (seed) => {
    const map = generateWorldMap(seed);
    const covers = manholes(map);
    expect(covers.length).toBeGreaterThanOrEqual(MIN_MANHOLES);
    expect(covers.length).toBeLessThanOrEqual(MAX_MANHOLES);
    const top = townHeight(map);
    const quadrants = new Set(covers.map((m) => (m.x < map.width / 2 ? 0 : 1) + (m.y < top / 2 ? 0 : 2)));
    expect(quadrants.size).toBeGreaterThanOrEqual(3);
    for (const cover of covers) {
      expect(cover.y).toBeLessThan(top);
      expect(['asphalt', 'asphalt_cracked', 'lane_h', 'lane_v']).toContain(tileName(map, cover.x, cover.y - 8));
    }
  });

  it.each(SEEDS)('seed %i: puts the sewers in the annex band below the town, as one connected chain', (seed) => {
    const map = generateWorldMap(seed);
    const pieces = sewerPieces(map);
    expect(pieces.length).toBeGreaterThan(0);
    for (const piece of pieces) {
      expect(piece.y).toBeGreaterThanOrEqual(townHeight(map));
      expect(buildingAt(map, piece.x + 40, piece.y + 40)).toBe(piece);
    }
    // The town's own rolls are not told about them as houses.
    expect(townBuildings(map).filter(isSewerBuilding)).toHaveLength(0);
    const field = new FlowField(map);
    field.recompute([map.spawn]);
    for (const piece of pieces) {
      expect(field.distanceAt(piece.x + 40, piece.y + 40)).toBeLessThan(Infinity);
    }
  });
});

function tileName(map: WorldMap, x: number, y: number): string {
  const kinds = ['asphalt', 'asphalt_cracked', 'lane_h', 'lane_v', 'crosswalk_h', 'crosswalk_v', 'parking_line', 'sidewalk', 'curb_n', 'curb_s', 'curb_e', 'curb_w', 'grass', 'dirt', 'water', 'snow', 'ash', 'sludge', 'floor_wood', 'floor_tile', 'floor_concrete', 'floor_carpet', 'floor_sewer', 'floor_sewer_channel', 'sewer_wall', 'bunker_wall', 'void'];
  return kinds[map.tiles[tileOf(map, x, y)]];
}

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
      // The foot of the ladder is under a ladder prop, in a sewer piece.
      const ladder = ladders(map).find((l) => Math.abs(l.x - down!.to.x) < 1 && Math.abs(l.y - (down!.to.y - 8)) < 1);
      expect(ladder).toBeDefined();
      const piece = buildingAt(map, down!.to.x, down!.to.y);
      expect(piece && isSewerBuilding(piece)).toBe(true);
    }
  });

  it.each(SEEDS)('seed %i: the flow field crosses from the street to the tunnel tiles and back', (seed) => {
    const map = generateWorldMap(seed);
    const field = new FlowField(map);
    field.recompute([map.spawn]);
    // The chain links every ladder, so the way down to the sewers is through the manhole nearest the spawn.
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

  it('the cover itself can be stood on, and the ladder is a wall prop', () => {
    const map = generateWorldMap(1);
    for (const flight of map.flights ?? []) {
      expect(isBlockedAt(map, flight.from.x, flight.from.y)).toBe(false);
      expect(circleHitsSolid(map, flight.from.x, flight.from.y, 8)).toBe(false);
    }
  });
});

describe('moving about the sewers', () => {
  it.each(SEEDS)('seed %i: walkways and tunnel are clear, and the perimeter and the dark are solid', (seed) => {
    const map = generateWorldMap(seed);
    for (const piece of sewerPieces(map).filter((b) => b.kind === 'sewer_tunnel_h')) {
      const rowTop = piece.y;
      // Walkway rows (first and last of the six) and the trench in the middle are all open to a body.
      for (const dy of [24, 40, 56, 72]) {
        expect(circleHitsSolid(map, piece.x + 96, rowTop + dy, 6)).toBe(false);
      }
      // The dark above and below is solid.
      expect(circleHitsSolid(map, piece.x + 96, rowTop - 8, 6)).toBe(true);
      expect(circleHitsSolid(map, piece.x + 96, rowTop + 96 + 8, 6)).toBe(true);
    }
    const first = sewerPieces(map).reduce((a, b) => (a.x < b.x ? a : b));
    expect(circleHitsSolid(map, first.x - 8, first.y + 64, 6)).toBe(true);
    // A walkway is continuous from one end of the chain to the other.
    const field = new FlowField(map);
    field.recompute([map.spawn]);
    const last = sewerPieces(map).reduce((a, b) => (a.x > b.x ? a : b));
    expect(field.distanceAt(last.x + 80, last.y + 8 * 5)).toBeLessThan(Infinity);
  });

  it.each(SEEDS)('seed %i: the trench is sludge or water between concrete walkways, and sludge slows to 0.65x', (seed) => {
    const map = generateWorldMap(seed);
    const kinds = new Set<string>();
    for (const piece of sewerPieces(map).filter((b) => b.kind === 'sewer_tunnel_h')) {
      const x = piece.x + 96;
      expect(tileName(map, x, piece.y + 8)).toBe('floor_concrete');
      expect(tileName(map, x, piece.y + 88)).toBe('floor_concrete');
      const trench = tileName(map, x, piece.y + 40);
      expect(['sludge', 'water']).toContain(trench);
      expect(tileName(map, x, piece.y + 56)).toBe(trench);
      kinds.add(trench);
      expect(groundEffect(map, x, piece.y + 8).speed).toBe(1);
      if (trench === 'sludge') {
        expect(groundEffect(map, x, piece.y + 40).speed).toBe(0.65);
        expect(groundSpeedScale(1, map, x, piece.y + 40)).toBe(0.65);
      }
      expect(groundSpeedScale(1, map, x, piece.y + 8)).toBe(1);
    }
    expect(kinds.size).toBeGreaterThan(0);
  });

  it('a sludge tile gives 0.65x and a concrete tile 1.0x', () => {
    const map = generateWorldMap(1);
    const tunnel = sewerPieces(map).find((b) => b.kind === 'sewer_tunnel_h') as BuildingInstance;
    const sludgeTunnel = sewerPieces(map).find((b) => b.kind === 'sewer_tunnel_h' && tileName(map, b.x + 96, b.y + 40) === 'sludge') ?? tunnel;
    const x = sludgeTunnel.x + 96;
    if (tileName(map, x, sludgeTunnel.y + 40) === 'sludge') expect(groundEffect(map, x, sludgeTunnel.y + 40).speed).toBe(0.65);
    expect(groundEffect(map, x, sludgeTunnel.y + 8).speed).toBe(1);
  });
});

describe('the sewers seen from the street', () => {
  it.each(SEEDS)('seed %i: a point in a sewer projects to a manhole street', (seed) => {
    const map = generateWorldMap(seed);
    const piece = sewerPieces(map)[2];
    const ground = groundOf(map, piece.x + 40, piece.y + 40);
    expect(ground.y).toBeLessThan(townHeight(map));
    const covers = (map.flights ?? []).filter((f) => f.down).map((f) => f.from);
    expect(covers).toContainEqual(ground);
    // The street itself, and a floor above a house, are as before.
    expect(groundOf(map, 400, 400)).toEqual({ x: 400, y: 400 });
  });

  it('has sewer lights', () => {
    const map = generateWorldMap(1);
    const ladderLights = map.lights.filter((l) => l.y > townHeight(map) && l.color === '#c8923c');
    expect(ladderLights.length).toBe(ladders(map).length);
    expect(map.lights.some((l) => l.color === '#46d98a' && l.y > townHeight(map))).toBe(true);
  });

  it('names the sewers on the map screen', () => {
    const map = generateWorldMap(1);
    const under = map.districts.filter((d) => d.underground);
    expect(under.length).toBe(manholes(map).length);
    for (const d of under) expect(d.name.startsWith('Sewers under ')).toBe(true);
  });
});
