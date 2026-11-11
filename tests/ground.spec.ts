import { describe, expect, it } from 'vitest';
import { GROUND_EFFECTS, groundAt, groundEffect } from '../shared/ground.ts';
import { TILE_KINDS, TILE_SIZE } from '../shared/protocol.ts';
import type { TileKind } from '../shared/protocol.ts';
import { FLOOD_SPEED_SCALE, groundSpeedScale } from '../shared/town-rules.ts';
import { generateWorldMap } from '../shared/world-map.ts';

const SEED = 4242;

function firstOf(level: number, kind: TileKind): { x: number; y: number } {
  const map = generateWorldMap(SEED, level);
  const index = map.tiles.findIndex((tile) => TILE_KINDS[tile] === kind);
  expect(index).toBeGreaterThanOrEqual(0);
  return { x: ((index % map.cols) + 0.5) * TILE_SIZE, y: (Math.floor(index / map.cols) + 0.5) * TILE_SIZE };
}

describe('ground effects', () => {
  it('only slow and muffle the ground a biome lays down', () => {
    for (const kind of Object.keys(GROUND_EFFECTS)) expect(['water', 'snow', 'sludge', 'ash']).toContain(kind);
    const map = generateWorldMap(SEED, 1);
    expect(groundEffect(map, map.spawn.x, map.spawn.y)).toEqual({ speed: 1, noise: 1 });
    expect(groundAt(map, -5, -5)).toBeNull();
  });

  it.each([
    [4, 'water'],
    [8, 'snow'],
    [5, 'sludge'],
    [10, 'ash'],
  ] as const)('level %i: %s slows walking and changes what a step sounds like', (level, kind) => {
    const spot = firstOf(level, kind);
    const map = generateWorldMap(SEED, level);
    expect(groundAt(map, spot.x, spot.y)).toBe(kind);
    expect(groundSpeedScale(level, map, spot.x, spot.y)).toBeLessThan(1);
    expect(groundEffect(map, spot.x, spot.y).noise).not.toBe(1);
  });

  it('wading in a flooded town is never faster than the town alone', () => {
    const spot = firstOf(4, 'water');
    const map = generateWorldMap(SEED, 4);
    expect(groundSpeedScale(4, map, spot.x, spot.y)).toBeLessThanOrEqual(FLOOD_SPEED_SCALE);
  });

  it('slows movement and increases noise in walkable rubble and shrubs', () => {
    const map = generateWorldMap(SEED, 1);
    const bush = map.props.find((p) => p.kind === 'bush');
    if (bush) {
      const effect = groundEffect(map, bush.x, bush.y - 4);
      expect(effect.speed).toBeLessThanOrEqual(0.75);
      expect(effect.noise).toBeGreaterThanOrEqual(1.2);
    }
    const rubble = map.props.find((p) => p.kind === 'rubble');
    if (rubble) {
      const effect = groundEffect(map, rubble.x, rubble.y - 4);
      expect(effect.speed).toBeLessThanOrEqual(0.75);
    }
  });
});
