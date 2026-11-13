import { describe, expect, it } from 'vitest';
import { CHEST_STATION, MERCHANT_STARTS, generateBunkerMap, merchantRoam } from '../shared/bunker-map.ts';
import { CAMP_SIZES, gapGround, ringRect } from '../shared/camp/camp-ring.ts';
import { ROSTER_PLACE } from '../shared/camp/camp-layout.ts';
import { MERCHANT_IDS, STATION_IDS } from '../shared/home-protocol.ts';
import { PLAYER_RADIUS } from '../shared/constants.ts';
import { MOVEMENT_ONLY_PROPS } from '../shared/map-protocol.ts';
import { TILE_KINDS, TILE_SIZE } from '../shared/protocol.ts';
import type { WorldMap } from '../shared/protocol.ts';
import { townPrint } from '../shared/town-print.ts';
import { groundSpeedScale } from '../shared/town-rules.ts';
import { blockedTiles, circleHitsSolid, liftProp } from '../shared/world-query.ts';

const first = generateBunkerMap();

/** Every open tile reachable from a point on foot, a tile at a time. */
function reachableFrom(world: WorldMap, x: number, y: number): Set<number> {
  const blocked = blockedTiles(world);
  const seen = new Set<number>();
  const queue = [Math.floor(y / TILE_SIZE) * world.cols + Math.floor(x / TILE_SIZE)];
  while (queue.length > 0) {
    const tile = queue.pop() as number;
    const col = tile % world.cols;
    const row = Math.floor(tile / world.cols);
    const outside = col < 0 || row < 0 || col >= world.cols || row >= world.rows;
    if (outside || seen.has(tile) || blocked[tile] === 1) continue;
    seen.add(tile);
    queue.push(tile - 1, tile + 1, tile - world.cols, tile + world.cols);
  }
  return seen;
}

const tileOf = (x: number, y: number): number => Math.floor(y / TILE_SIZE) * first.cols + Math.floor(x / TILE_SIZE);
const kindAt = (map: WorldMap, x: number, y: number): string => TILE_KINDS[map.tiles[tileOf(x, y)]];

/** Inside the smallest ring's fenced ground, a body's width from the fence. */
function insideFirstRing(x: number, y: number): boolean {
  const rect = ringRect(1);
  return x > rect.col0 * TILE_SIZE + PLAYER_RADIUS && x < (rect.col1 + 1) * TILE_SIZE - PLAYER_RADIUS && y > rect.row0 * TILE_SIZE + PLAYER_RADIUS && y < (rect.row1 + 1) * TILE_SIZE - PLAYER_RADIUS;
}

describe('the camp map', () => {
  it('is one size of map at every camp size, outdoors, with no walls', () => {
    for (const size of CAMP_SIZES) {
      const map = generateBunkerMap(size);
      expect([map.cols, map.rows]).toEqual([72, 48]);
      expect(map.walls).toEqual([]);
      expect(map.camp?.size).toBe(size);
      expect([...new Set([...map.tiles].map((t) => TILE_KINDS[t]))].sort()).toEqual(['dirt', 'grass']);
    }
    expect(groundSpeedScale(0, first, first.spawn.x, first.spawn.y)).toBe(1);
  });

  it('wears the fenced ground and the gate track to dirt and leaves the wilderness grass', () => {
    expect(kindAt(first, first.spawn.x, first.spawn.y)).toBe('dirt');
    expect(kindAt(first, first.width - 8, (first.exit?.y ?? 0) - 8)).toBe('dirt');
    expect(kindAt(first, 40, 40)).toBe('grass');
    expect(kindAt(generateBunkerMap(1), 20 * TILE_SIZE, 20 * TILE_SIZE)).toBe('grass');
    expect(kindAt(generateBunkerMap(5), 20 * TILE_SIZE, 20 * TILE_SIZE)).toBe('dirt');
  });

  it('has every station once but the chest, the press, which lands last, and the merchants, who walk', () => {
    const offMap = new Set<string>(['chest', 'press', ...MERCHANT_IDS]);
    const standing = STATION_IDS.filter((id) => !offMap.has(id));
    expect((first.stations ?? []).map((station) => station.id).sort()).toEqual([...standing].sort());
    expect(first.props.some((prop) => prop.kind === 'counter' || prop.kind === 'blast_door' || (MERCHANT_IDS as readonly string[]).includes(prop.kind))).toBe(false);
  });

  it.each(CAMP_SIZES)('keeps every station, the spawn, the chest, the van and the merchants where they are at size %i, on open ground inside the smallest ring', (size) => {
    const map = generateBunkerMap(size);
    expect(map.stations).toEqual(first.stations);
    expect(map.spawn).toEqual(first.spawn);
    expect(map.exit).toEqual(first.exit);
    const reached = reachableFrom(map, map.spawn.x, map.spawn.y);
    const spots = [...(map.stations ?? []), CHEST_STATION, map.spawn, ...MERCHANT_IDS.map((id) => MERCHANT_STARTS[id]), { x: ROSTER_PLACE.x, y: ROSTER_PLACE.y + 20 }];
    for (const spot of spots) {
      expect(circleHitsSolid(map, spot.x, spot.y, PLAYER_RADIUS), JSON.stringify(spot)).toBe(false);
      expect(insideFirstRing(spot.x, spot.y), JSON.stringify(spot)).toBe(true);
      expect(reached.has(tileOf(spot.x, spot.y)), JSON.stringify(spot)).toBe(true);
    }
    expect(insideFirstRing(map.exit?.x ?? 0, map.exit?.y ?? 0)).toBe(true);
    expect(reached.has(tileOf(map.exit?.x ?? 0, (map.exit?.y ?? 0) + 4))).toBe(true);
    for (const district of map.districts) expect(reached.has(tileOf(district.x, district.y)), district.name).toBe(true);
  });

  it('keeps station circles apart, the Roster spot among them', () => {
    const circles = [...(first.stations ?? []), CHEST_STATION, { id: 'roster', x: ROSTER_PLACE.x, y: ROSTER_PLACE.y + 20, radius: 28 }];
    for (const a of circles) {
      for (const b of circles) {
        if (a === b) continue;
        expect(Math.hypot(a.x - b.x, a.y - b.y), `${a.id} and ${b.id}`).toBeGreaterThanOrEqual(56);
      }
    }
  });

  it.each(CAMP_SIZES)('closes the camp at size %i: nobody walks out, and the fence is its first props in ring order', (size) => {
    const map = generateBunkerMap(size);
    const sections = map.camp?.sections ?? [];
    expect(sections.length).toBeGreaterThan(30);
    sections.forEach((section, i) => expect(map.props[i]).toEqual({ kind: section.kind, x: section.x, y: section.y }));
    expect(map.props.filter((prop) => MOVEMENT_ONLY_PROPS.has(prop.kind))).toHaveLength(sections.length);
    const reached = reachableFrom(map, map.spawn.x, map.spawn.y);
    expect(reached.has(tileOf(24, 24))).toBe(false);
    const rect = ringRect(size);
    expect(reached.size).toBeLessThanOrEqual((rect.col1 - rect.col0 + 1) * (rect.row1 - rect.row0 + 1));
  });

  it('opens a way out where a section is lifted, and only there', () => {
    const map = generateBunkerMap(2);
    const section = (map.camp?.sections ?? []).find((s) => s.breachable && s.side === 'w');
    if (!section) throw new Error('no breachable section on the west side');
    liftProp(map, section.index);
    const box = gapGround(section);
    expect(circleHitsSolid(map, (box.x0 + box.x1) / 2, (box.y0 + box.y1) / 2, 2)).toBe(false);
    expect(reachableFrom(map, map.spawn.x, map.spawn.y).has(tileOf(24, 24))).toBe(true);
  });

  it('keeps the ground outside every breachable section open for the horde, at every size', () => {
    for (const size of CAMP_SIZES) {
      const map = generateBunkerMap(size);
      for (const section of (map.camp?.sections ?? []).filter((s) => s.breachable)) {
        const box = gapGround(section);
        const mid = { x: (box.x0 + box.x1) / 2, y: (box.y0 + box.y1) / 2 };
        for (const tiles of [4, 5.5, 7]) {
          const spot = { x: mid.x + section.out.x * tiles * TILE_SIZE, y: mid.y + section.out.y * tiles * TILE_SIZE };
          expect(circleHitsSolid(map, spot.x, spot.y, 12), `size ${size} section ${section.index} at ${tiles}`).toBe(false);
        }
      }
    }
  });

  it('builds the same camp twice and a different one at each size', () => {
    const prints = CAMP_SIZES.map((size) => townPrint(generateBunkerMap(size)));
    expect(new Set(prints).size).toBe(CAMP_SIZES.length);
    expect(townPrint(generateBunkerMap(3))).toBe(prints[2]);
  });

  it('lets the merchants roam only ground west of the van, inside the fence, all of it reachable', () => {
    for (const size of CAMP_SIZES) {
      const map = generateBunkerMap(size);
      const rect = ringRect(size);
      const reached = reachableFrom(map, map.spawn.x, map.spawn.y);
      for (const box of merchantRoam(size)) {
        expect(reached.has(tileOf((box.x0 + box.x1) / 2, (box.y0 + box.y1) / 2))).toBe(true);
        expect(box.x1 < (map.exit?.x ?? 0)).toBe(true);
        expect(box.x0).toBeGreaterThanOrEqual(rect.col0 * TILE_SIZE);
        expect(box.y0).toBeGreaterThanOrEqual(rect.row0 * TILE_SIZE);
        expect(box.y1).toBeLessThanOrEqual((rect.row1 + 1) * TILE_SIZE);
      }
    }
  });

  it('lights the fire and the lanterns', () => {
    expect(first.lights.filter((light) => light.flicker)).toHaveLength(1);
    expect(first.lights.length).toBeGreaterThanOrEqual(3);
  });
});
