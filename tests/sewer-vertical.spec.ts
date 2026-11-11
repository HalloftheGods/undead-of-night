import { describe, expect, it } from 'vitest';
import { TILE_KINDS } from '../shared/protocol.ts';
import { createRng } from '../shared/rng.ts';
import { planSewers } from '../shared/sewers.ts';
import { planTown } from '../shared/town-plan.ts';
import { blockedTiles, generateWorldMap } from '../shared/world-map.ts';

const SEEDS = Array.from({ length: 100 }, (_, i) => i + 1);

describe('vertical sewer tunnels', () => {
  it('every seed plans tunnels running north-south as well as east-west', () => {
    const missing: number[] = [];
    for (const seed of SEEDS) {
      const plan = planSewers(seed, planTown(createRng(seed)).roads, 200, 200);
      const open = plan.tunnels.filter((t) => t.kind !== 'dead_end' && t.kind !== 'side');
      if (!open.some((t) => !t.horizontal) || !open.some((t) => t.horizontal)) missing.push(seed);
    }
    expect(missing).toEqual([]);
  });

  it('paints vertical canal tiles and keeps every manhole connected', () => {
    const noVertical: number[] = [];
    const disconnected: number[] = [];
    for (const seed of SEEDS.slice(0, 20)) {
      const map = generateWorldMap(seed);
      const top = map.sewers?.top ?? 0;
      let vertical = 0;
      for (let i = top * map.cols; i < map.tiles.length; i++) if (TILE_KINDS[map.tiles[i]] === 'floor_sewer_channel_v') vertical++;
      if (vertical === 0) noVertical.push(seed);
      const blocked = blockedTiles(map);
      const feet = (map.flights ?? []).filter((f) => f.down).map((f) => f.toIndex);
      const seen = new Set<number>([feet[0]]);
      const queue = [feet[0]];
      for (let h = 0; h < queue.length; h++) {
        const at = queue[h];
        const col = at % map.cols;
        for (const to of [col > 0 ? at - 1 : -1, col < map.cols - 1 ? at + 1 : -1, at - map.cols, at + map.cols]) {
          if (to >= 0 && to < map.tiles.length && !blocked[to] && !seen.has(to)) {
            seen.add(to);
            queue.push(to);
          }
        }
      }
      if (!feet.every((f) => seen.has(f))) disconnected.push(seed);
    }
    expect(noVertical).toEqual([]);
    expect(disconnected).toEqual([]);
  }, 180000);
});
