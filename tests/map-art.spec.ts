import { beforeAll, describe, expect, it, vi } from 'vitest';
import { BUILDING_DEFS, BUILDING_KINDS, TILE_SIZE } from '../shared/protocol.ts';
import { generateWorldMap } from '../shared/world-map.ts';
import { BUILDING_LOOK, paintBuilding, PLACE_GROUPS, PLACE_LOOK } from '../src/game/map-buildings.ts';
import { paintScenery } from '../src/game/map-ground.ts';
import { TownMapView } from '../src/game/town-map.ts';
import { fakeCanvas, installFakeBrowser } from './client-fake-dom.ts';

const PX = TILE_SIZE / 2;

function fills(paint: (ctx: CanvasRenderingContext2D) => void): number[][] {
  const ctx = fakeCanvas().getContext() as unknown as CanvasRenderingContext2D;
  const spy = vi.spyOn(ctx, 'fillRect');
  paint(ctx);
  return spy.mock.calls;
}

describe('the town map in pixel art', () => {
  beforeAll(() => installFakeBrowser());

  it('gives every kind of building a look from a group the key lists', () => {
    for (const kind of BUILDING_KINDS) expect(PLACE_GROUPS).toContain(BUILDING_LOOK[kind].group);
    for (const group of PLACE_GROUPS) expect(BUILDING_LOOK[PLACE_LOOK[group].sample].group).toBe(group);
  });

  it('paints each building inside its footprint, bar a one pixel outline and its shadow', () => {
    for (const kind of BUILDING_KINDS) {
      const { w, h, doorX } = BUILDING_DEFS[kind];
      const box = { x0: 10, y0: 10, x1: 10 + w / PX, y1: 10 + h / PX };
      for (const [x, y, fw, fh] of fills((ctx) => paintBuilding(ctx, box, kind, doorX / PX, 3))) {
        expect(x).toBeGreaterThanOrEqual(box.x0 - 1);
        expect(y).toBeGreaterThanOrEqual(box.y0 - 1);
        expect(x + fw).toBeLessThanOrEqual(box.x1 + 2);
        expect(y + fh).toBeLessThanOrEqual(box.y1 + 2);
      }
    }
  });

  it('draws trees and parked cars from the town, and skips the furniture inside', () => {
    const map = generateWorldMap(4242);
    const outside = fills((ctx) => paintScenery(ctx, map.props, 2));
    expect(outside.length).toBeGreaterThan(0);
    const indoors = fills((ctx) => paintScenery(ctx, [{ kind: 'shelf', x: 100, y: 100 }, { kind: 'sofa', x: 50, y: 50 }], 2));
    expect(indoors).toEqual([]);
  });

  it('paints a whole town and a bunker without trouble', () => {
    const map = generateWorldMap(4242);
    const view = new TownMapView(map);
    const ctx = fakeCanvas().getContext() as unknown as CanvasRenderingContext2D;
    const exit = { id: 'exit', x: 400, y: 400 } as never;
    expect(() => view.paint(ctx, [], null, exit, [], { x: 300, y: 300, landed: false } as never)).not.toThrow();
    expect(() => view.paint(ctx, [], null, exit, [], { x: 300, y: 300, landed: true } as never)).not.toThrow();
  });
});
