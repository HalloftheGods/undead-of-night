import { describe, expect, it } from 'vitest';
import { BIOMES, biomeFor } from '../shared/biomes.ts';
import { FINAL_LEVEL } from '../shared/levels.ts';
import { OUTDOOR_CONTAINERS } from '../shared/containers.ts';
import { TILE_KINDS, TILE_SIZE } from '../shared/protocol.ts';
import type { PropKind, TileKind } from '../shared/protocol.ts';
import { blockedTiles, generateWorldMap } from '../shared/world-map.ts';

const SEED = 4242;
const countOf = (level: number, kind: PropKind): number => generateWorldMap(SEED, level).props.filter((prop) => prop.kind === kind).length;

describe('biomes', () => {
  it('gives every level its own biome', () => {
    expect(BIOMES).toHaveLength(FINAL_LEVEL);
    expect(new Set(BIOMES.map((biome) => biome.id)).size).toBe(FINAL_LEVEL);
    expect(biomeFor(0)).toBe(BIOMES[0]);
    expect(biomeFor(99)).toBe(BIOMES[FINAL_LEVEL - 1]);
  });

  it('builds the same town for the same seed and level', () => {
    expect(generateWorldMap(SEED, 4)).toEqual(generateWorldMap(SEED, 4));
  });

  it('grows different plants on different levels', () => {
    expect(countOf(1, 'cactus')).toBe(0);
    expect(countOf(3, 'cactus')).toBeGreaterThan(20);
    expect(countOf(4, 'reeds')).toBeGreaterThan(100);
    expect(countOf(5, 'fungus')).toBeGreaterThan(50);
    expect(countOf(8, 'pine')).toBeGreaterThan(countOf(1, 'pine'));
    expect(countOf(10, 'dead_tree')).toBeGreaterThan(50);
    expect(countOf(10, 'tree')).toBe(0);
  });

  it.each(Array.from({ length: FINAL_LEVEL }, (_, index) => index + 1))('level %i: keeps its fence closed and its lamps lit up', (level) => {
    const map = generateWorldMap(SEED, level);
    const blocked = blockedTiles(map);
    for (let i = 0; i < map.cols; i++) {
      expect(blocked[i]).toBe(1);
      expect(blocked[(map.rows - 1) * map.cols + i]).toBe(1);
      expect(blocked[i * map.cols]).toBe(1);
      expect(blocked[i * map.cols + map.cols - 1]).toBe(1);
    }
    expect(map.lights.length).toBeGreaterThan(40);
  });
});

const tilesOf = (level: number, kind: TileKind): number => {
  const map = generateWorldMap(SEED, level);
  // Only the town itself: the sewers below it have their own sludge and water in every level.
  const town = map.tiles.slice(0, (map.townRows ?? map.rows) * map.cols);
  return town.filter((tile) => TILE_KINDS[tile] === kind).length;
};

describe('terrain and landmarks', () => {
  it('lays each level its own ground over the town', () => {
    for (const kind of ['water', 'snow', 'ash', 'sludge'] as const) expect(tilesOf(1, kind)).toBe(0);
    expect(tilesOf(4, 'water')).toBeGreaterThan(500);
    expect(tilesOf(5, 'sludge')).toBeGreaterThan(200);
    expect(tilesOf(8, 'snow')).toBeGreaterThan(1000);
    expect(tilesOf(10, 'ash')).toBeGreaterThan(1000);
  });

  it('keeps the safe square at the park centre free of the new ground', () => {
    for (const level of [4, 5, 8, 10]) {
      const map = generateWorldMap(SEED, level);
      const col = Math.floor(map.spawn.x / TILE_SIZE);
      const row = Math.floor(map.spawn.y / TILE_SIZE);
      expect(TILE_KINDS[map.tiles[row * map.cols + col]]).toBe('sidewalk');
    }
  });

  it('raises a landmark of vehicles on the levels that have one', () => {
    const wrecks = (level: number): number => generateWorldMap(SEED, level).props.filter((prop) => OUTDOOR_CONTAINERS[prop.kind] === 'car').length;
    expect(wrecks(3)).toBeGreaterThan(wrecks(1));
    expect(wrecks(10)).toBeGreaterThan(wrecks(1));
  });
});

describe('town pieces', () => {
  const propsOf = (level: number, kind: PropKind): number => generateWorldMap(SEED, level).props.filter((prop) => prop.kind === kind).length;

  it('walls a street at the cordon, with fence the other levels lack inside the town', () => {
    const inside = (level: number): number =>
      generateWorldMap(SEED, level).props.filter((prop) => (prop.kind === 'fence_h' || prop.kind === 'fence_v') && prop.x > 200 && prop.x < 3000 && prop.y > 200 && prop.y < 3000).length;
    expect(inside(7)).toBeGreaterThan(inside(1));
  });

  it('sets houses ablaze in the last town and sinks them in the marsh', () => {
    expect(propsOf(10, 'fire_barrel')).toBeGreaterThan(propsOf(1, 'fire_barrel') + 10);
    expect(propsOf(9, 'fungus')).toBeGreaterThan(propsOf(1, 'fungus'));
  });
});

describe('street lamps', () => {
  it('stand at the same pitch along a street, not at random', () => {
    const map = generateWorldMap(SEED, 1);
    const lamps = map.props.filter((prop) => prop.kind === 'street_lamp');
    expect(lamps.length).toBeGreaterThan(150);
    const rows = new Map<number, number[]>();
    for (const lamp of lamps) rows.set(lamp.y, [...(rows.get(lamp.y) ?? []), lamp.x]);
    const longest = Math.max(...[...rows.values()].map((xs) => xs.length));
    expect(longest).toBeGreaterThan(4);
  });
});
