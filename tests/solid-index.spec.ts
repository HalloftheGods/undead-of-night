import { describe, expect, it } from 'vitest';
import { TILE_SIZE } from '../shared/protocol.ts';
import type { WorldMap } from '../shared/protocol.ts';
import { generateWorldMap } from '../shared/world-map.ts';
import { blockedTiles, circleHitsSolid, isLifted, isSolidProp, liftProp, propBox, restoreSolids, setSolid, wallBoxes } from '../shared/world-query.ts';
import type { Box } from '../shared/world-query.ts';

const centreOf = (box: Box): { x: number; y: number } => ({ x: (box.x0 + box.x1) / 2, y: (box.y0 + box.y1) / 2 });
const tileOf = (map: WorldMap, x: number, y: number): number => Math.floor(y / TILE_SIZE) * map.cols + Math.floor(x / TILE_SIZE);

/** A solid prop standing alone: nothing else solid within a tile of its box. */
function loneProp(map: WorldMap): number {
  const apart = (box: Box, o: Box): boolean =>
    o.x1 < box.x0 - TILE_SIZE || o.x0 > box.x1 + TILE_SIZE || o.y1 < box.y0 - TILE_SIZE || o.y0 > box.y1 + TILE_SIZE;
  const index = map.props.findIndex((prop, i) => {
    if (!isSolidProp(prop)) return false;
    const box = propBox(prop);
    const othersApart = map.props.every((other, j) => j === i || !isSolidProp(other) || apart(box, propBox(other)));
    return othersApart && wallBoxes(map).every((wall) => apart(box, wall));
  });
  if (index < 0) throw new Error('no lone prop on the map');
  return index;
}

/** Open ground far from everything, for placing a dynamic box. */
function openSpot(map: WorldMap): { x: number; y: number } {
  for (let y = 200; y < map.height - 200; y += TILE_SIZE) {
    for (let x = 200; x < map.width - 200; x += TILE_SIZE) {
      if (!circleHitsSolid(map, x, y, 40)) return { x, y };
    }
  }
  throw new Error('no open ground');
}

describe('solid index: lifting props and dynamic boxes', () => {
  it('liftProp removes one prop from the index, editing the blocked array in place, and is idempotent', () => {
    const map = generateWorldMap(4242, 1);
    const blocked = blockedTiles(map);
    const i = loneProp(map);
    const { x, y } = centreOf(propBox(map.props[i]));
    expect(circleHitsSolid(map, x, y, 1)).toBe(true);
    expect(blocked[tileOf(map, x, y)]).toBe(1);

    liftProp(map, i);
    liftProp(map, i);

    expect(isLifted(map, i)).toBe(true);
    expect(circleHitsSolid(map, x, y, 1)).toBe(false);
    expect(blockedTiles(map)).toBe(blocked);
    expect(blocked[tileOf(map, x, y)]).toBe(0);
  });

  it('setSolid places, moves and removes a keyed box, recomputing each touched tile', () => {
    const map = generateWorldMap(4242, 1);
    const blocked = blockedTiles(map);
    const a = openSpot(map);
    const box = { x0: a.x - 10, y0: a.y - 10, x1: a.x + 10, y1: a.y + 10 };
    setSolid(map, 'test:1', box);
    expect(circleHitsSolid(map, a.x, a.y, 1)).toBe(true);
    expect(blocked[tileOf(map, a.x, a.y)]).toBe(1);

    const moved = { x0: box.x0 + 64, y0: box.y0, x1: box.x1 + 64, y1: box.y1 };
    setSolid(map, 'test:1', moved);
    expect(circleHitsSolid(map, a.x, a.y, 1)).toBe(false);
    expect(blocked[tileOf(map, a.x, a.y)]).toBe(0);
    expect(circleHitsSolid(map, a.x + 64, a.y, 1)).toBe(true);

    setSolid(map, 'test:1', null);
    expect(circleHitsSolid(map, a.x + 64, a.y, 1)).toBe(false);
    expect(blocked[tileOf(map, a.x + 64, a.y)]).toBe(0);
    expect(blockedTiles(map)).toBe(blocked);
  });

  it('a tile shared with another solid stays blocked when one of them goes', () => {
    const map = generateWorldMap(4242, 1);
    const a = openSpot(map);
    setSolid(map, 'test:a', { x0: a.x - 4, y0: a.y - 4, x1: a.x - 1, y1: a.y - 1 });
    setSolid(map, 'test:b', { x0: a.x + 1, y0: a.y + 1, x1: a.x + 4, y1: a.y + 4 });
    setSolid(map, 'test:a', null);
    expect(blockedTiles(map)[tileOf(map, a.x + 2, a.y + 2)]).toBe(1);
    expect(circleHitsSolid(map, a.x + 2, a.y + 2, 1)).toBe(true);
  });

  it('restoreSolids puts lifted props back and clears every dynamic box', () => {
    const map = generateWorldMap(4242, 1);
    const i = loneProp(map);
    const { x, y } = centreOf(propBox(map.props[i]));
    const a = openSpot(map);
    liftProp(map, i);
    setSolid(map, 'test:1', { x0: a.x - 10, y0: a.y - 10, x1: a.x + 10, y1: a.y + 10 });

    restoreSolids(map);

    expect(isLifted(map, i)).toBe(false);
    expect(circleHitsSolid(map, x, y, 1)).toBe(true);
    expect(circleHitsSolid(map, a.x, a.y, 1)).toBe(false);
  });
});
