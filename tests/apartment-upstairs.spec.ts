import { describe, expect, it } from 'vitest';
import { furnish } from '../shared/building-interiors.ts';
import { PARTITIONS, partitionBoxes } from '../shared/building-plans.ts';
import { PLAYER_RADIUS } from '../shared/constants.ts';
import type { MapBuilder } from '../shared/map-builder.ts';
import { BUILDING_DEFS, TILE_SIZE, WALL_THICKNESS } from '../shared/protocol.ts';
import type { BuildingInstance, PropInstance } from '../shared/protocol.ts';
import { stairsPoint, stairsPoints } from '../shared/storeys.ts';
import { propBox } from '../shared/world-query.ts';

const CELL = 4;

/** Every floor point a player can stand on, flooded from the stairs, in cells of CELL pixels. */
function reachable(kind: 'apartment' | 'apartment_upstairs'): { reached: Set<string>; open: Set<string> } {
  const building: BuildingInstance = { id: 'a1', kind, x: 0, y: 0, variant: 0 };
  const props: PropInstance[] = [];
  furnish({ rng: () => 0, fixture: (prop: PropInstance['kind'], x: number, y: number) => props.push({ kind: prop, x, y }) } as unknown as MapBuilder, building);
  const solids = [...props.map(propBox), ...partitionBoxes(building, true)];
  const { w, h } = BUILDING_DEFS[kind];
  const inset = WALL_THICKNESS + PLAYER_RADIUS;
  const open = new Set<string>();
  for (let y = inset; y <= h - inset; y += CELL) {
    for (let x = inset; x <= w - inset; x += CELL) {
      const blocked = solids.some((s) => x > s.x0 - PLAYER_RADIUS && x < s.x1 + PLAYER_RADIUS && y > s.y0 - PLAYER_RADIUS && y < s.y1 + PLAYER_RADIUS);
      if (!blocked) open.add(`${x},${y}`);
    }
  }
  const start = stairsPoint(building)!;
  const first = [...open].sort((a, b) => dist(a, start) - dist(b, start))[0];
  const reached = new Set<string>([first]);
  const queue = [first];
  while (queue.length) {
    const [x, y] = queue.pop()!.split(',').map(Number);
    for (const [dx, dy] of [[CELL, 0], [-CELL, 0], [0, CELL], [0, -CELL]]) {
      const next = `${x + dx},${y + dy}`;
      if (open.has(next) && !reached.has(next)) {
        reached.add(next);
        queue.push(next);
      }
    }
  }
  return { reached, open };
}

function dist(cell: string, p: { x: number; y: number }): number {
  const [x, y] = cell.split(',').map(Number);
  return Math.hypot(x - p.x, y - p.y);
}

describe('the apartment floor above', () => {
  it('has no inside walls: no hall to a back door it does not have, no stubs to snag on', () => {
    expect(PARTITIONS.apartment_upstairs ?? []).toEqual([]);
  });

  it('has no inside walls below: an open lobby', () => {
    expect(PARTITIONS.apartment ?? []).toEqual([]);
  });

  it('is one connected floor: every open spot can be walked to from the stairs', () => {
    const { reached, open } = reachable('apartment_upstairs');
    expect(open.size).toBeGreaterThan(300);
    expect(reached.size).toBe(open.size);
  });

  it('has stairs tiles with room to step on and off for all flights', () => {
    for (const kind of ['apartment', 'apartment_upstairs'] as const) {
      const { reached } = reachable(kind);
      const building: BuildingInstance = { id: 'a1', kind, x: 0, y: 0, variant: 0 };
      for (const at of stairsPoints(building)) {
        const near = [...reached].filter((c) => dist(c, at) < TILE_SIZE * 1.5);
        expect(near.length).toBeGreaterThan(8);
      }
    }
  });
});
