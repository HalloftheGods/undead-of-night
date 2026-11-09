import { describe, expect, it } from 'vitest';
import { MERCHANT_ROAM, MERCHANT_STARTS, generateBunkerMap } from '../shared/bunker-map.ts';
import { MERCHANT_IDS, STATION_IDS } from '../shared/home-protocol.ts';
import { PLAYER_RADIUS } from '../shared/constants.ts';
import { TILE_KINDS, TILE_SIZE } from '../shared/protocol.ts';
import type { WorldMap } from '../shared/protocol.ts';
import { groundSpeedScale } from '../shared/town-rules.ts';
import { blockedTiles, circleHitsSolid } from '../shared/world-query.ts';

const map = generateBunkerMap();
const WALL = TILE_KINDS.indexOf('bunker_wall');

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

const tileOf = (x: number, y: number): number => Math.floor(y / TILE_SIZE) * map.cols + Math.floor(x / TILE_SIZE);

describe('the bunker map', () => {
  it('every room and station is reachable from spawn', () => {
    const reached = reachableFrom(map, map.spawn.x, map.spawn.y);
    expect(reached.size).toBeGreaterThan(0);
    for (const district of map.districts) expect(reached.has(tileOf(district.x, district.y))).toBe(true);
    for (const station of map.stations ?? []) {
      expect(circleHitsSolid(map, station.x, station.y, PLAYER_RADIUS)).toBe(false);
      expect(reached.has(tileOf(station.x, station.y))).toBe(true);
    }
    expect(reached.has(tileOf(map.exit?.x ?? 0, (map.exit?.y ?? 0) + 4))).toBe(true);
  });

  it('has every station once but the chest and the merchants, who walk, and spawn on open ground', () => {
    const standing = STATION_IDS.filter((id) => id !== 'chest' && !(MERCHANT_IDS as readonly string[]).includes(id));
    expect((map.stations ?? []).map((station) => station.id).sort()).toEqual([...standing].sort());
    expect(circleHitsSolid(map, map.spawn.x, map.spawn.y, PLAYER_RADIUS)).toBe(false);
  });

  it('has no counters and no merchant props: the merchants start on open hall floor, reachable from spawn', () => {
    const reached = reachableFrom(map, map.spawn.x, map.spawn.y);
    expect(map.props.some((prop) => prop.kind === 'counter' || (MERCHANT_IDS as readonly string[]).includes(prop.kind))).toBe(false);
    for (const id of MERCHANT_IDS) {
      const start = MERCHANT_STARTS[id];
      expect(circleHitsSolid(map, start.x, start.y, PLAYER_RADIUS), id).toBe(false);
      expect(reached.has(tileOf(start.x, start.y)), id).toBe(true);
    }
  });

  it('lets the merchants roam only floor the van does not park on, all of it reachable', () => {
    const reached = reachableFrom(map, map.spawn.x, map.spawn.y);
    for (const box of MERCHANT_ROAM) {
      expect(reached.has(tileOf((box.x0 + box.x1) / 2, (box.y0 + box.y1) / 2))).toBe(true);
      expect(box.x1 < (map.exit?.x ?? 0)).toBe(true);
    }
  });

  it('draws a wall tile under every wall', () => {
    for (const wall of map.walls ?? []) {
      const col = Math.floor((wall.x0 + wall.x1) / 2 / TILE_SIZE);
      const row = Math.floor((wall.y0 + wall.y1) / 2 / TILE_SIZE);
      expect(map.tiles[row * map.cols + col]).toBe(WALL);
    }
  });

  it('is about forty tiles wide, and the town rules leave it alone', () => {
    expect(map.cols).toBe(40);
    expect(groundSpeedScale(0, map, map.spawn.x, map.spawn.y)).toBe(1);
  });
});
