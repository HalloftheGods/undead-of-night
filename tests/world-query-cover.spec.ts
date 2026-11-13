import { describe, expect, it } from 'vitest';
import { MOVEMENT_ONLY_PROPS } from '../shared/map-protocol.ts';
import type { PropKind, WorldMap } from '../shared/protocol.ts';
import { TILE_SIZE } from '../shared/protocol.ts';
import { generateWorldMap } from '../shared/world-map.ts';
import { blockedTiles, circleHitsSolid, isSolidProp, segmentHitsCover, segmentHitsSolid, stopsShots } from '../shared/world-query.ts';

/** Open ground with nothing solid within 48 px, for one prop to stand alone. */
function openSpot(map: WorldMap): { x: number; y: number } {
  for (let y = 200; y < map.height - 200; y += TILE_SIZE) {
    for (let x = 200; x < map.width - 200; x += TILE_SIZE) {
      if (!circleHitsSolid(map, x, y, 48)) return { x, y };
    }
  }
  throw new Error('no open ground');
}

/** A town with one extra prop on open ground: a new map object, so it gets its own solid index. */
function withProp(kind: PropKind): { map: WorldMap; x: number; y: number } {
  const town = generateWorldMap(4242, 1);
  const spot = openSpot(town);
  return { map: { ...town, props: [...town.props, { kind, x: spot.x, y: spot.y }] }, ...spot };
}

const tileOf = (map: WorldMap, x: number, y: number): number => Math.floor(y / TILE_SIZE) * map.cols + Math.floor(x / TILE_SIZE);

describe('fence that stops bodies but not shots or sight', () => {
  it('blocks movement at a camp fence and lets a segment through it', () => {
    const { map, x, y } = withProp('camp_fence_h');
    expect(circleHitsSolid(map, x, y - 3, 1)).toBe(true);
    expect(blockedTiles(map)[tileOf(map, x, y - 3)]).toBe(1);
    expect(segmentHitsSolid(map, x, y - 30, x, y + 30)).not.toBeNull();
    expect(segmentHitsCover(map, x, y - 30, x, y + 30)).toBeNull();
  });

  it('leaves a town fence stopping both', () => {
    const { map, x, y } = withProp('fence_h');
    expect(circleHitsSolid(map, x, y - 3, 1)).toBe(true);
    expect(segmentHitsSolid(map, x, y - 30, x, y + 30)).not.toBeNull();
    expect(segmentHitsCover(map, x, y - 30, x, y + 30)).not.toBeNull();
  });

  it('names the movement-only kinds and keeps the fallen fence walkable', () => {
    expect([...MOVEMENT_ONLY_PROPS].sort()).toEqual(['camp_fence_h', 'camp_fence_v', 'camp_gate', 'camp_post']);
    expect(stopsShots({ kind: 'camp_fence_v', x: 0, y: 0 })).toBe(false);
    expect(stopsShots({ kind: 'fence_v', x: 0, y: 0 })).toBe(true);
    expect(isSolidProp({ kind: 'camp_fence_down_h', x: 0, y: 0 })).toBe(false);
    expect(isSolidProp({ kind: 'camp_fence_down_v', x: 0, y: 0 })).toBe(false);
  });
});
