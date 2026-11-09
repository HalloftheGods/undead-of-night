import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlayerEntity } from '../shared/protocol.ts';
import { generateWorldMap } from '../shared/world-map.ts';
import { buildArtBook } from '../src/art/index.ts';
import { glowOf } from '../src/art/glow.ts';
import { RAMPS } from '../src/art/palette.ts';
import type { PixelSprite } from '../src/art/types.ts';
import { BuildingLayer } from '../src/engine/building-layer.ts';
import { EntityRenderer } from '../src/engine/entity-renderer.ts';
import { EMPTY_SCENE } from '../src/engine/scene.ts';
import { BODY_HALF_WIDTH, BODY_REACH, isCovered } from '../src/engine/self-lit.ts';
import { VisualStore } from '../src/engine/visuals.ts';
import { fakeCanvas, installFakeBrowser } from './client-fake-dom.ts';

const art = buildArtBook();
function colourAt(sprite: PixelSprite, x: number, y: number): number {
  const i = (y * sprite.w + x) * 4;
  return (sprite.rgba[i] << 16) | (sprite.rgba[i + 1] << 8) | sprite.rgba[i + 2];
}

describe('self-lit art', () => {
  it('marks a pumpkin face on a house, and every mark sits on a lit face pixel', () => {
    let found = 0;
    for (const [kind, variants] of Object.entries(art.environment.buildings)) {
      for (const sprite of variants) {
        for (const pixel of glowOf(sprite)) {
          found += 1;
          expect(sprite.rgba[(pixel.y * sprite.w + pixel.x) * 4 + 3]).toBe(255);
          expect(colourAt(sprite, pixel.x, pixel.y), `${kind} mark at ${pixel.x},${pixel.y}`).toBe(RAMPS.fire[3]);
        }
      }
    }
    expect(found).toBeGreaterThan(0);
  });

  it('marks the candy pail while its candle burns, and none once it has been searched', () => {
    const bowl = art.containers.bowl;
    expect(glowOf(bowl.closed).length).toBeGreaterThan(0);
    expect(glowOf(bowl.opened)).toHaveLength(0);
  });

  it('leaves ordinary sprites unmarked', () => {
    expect(glowOf(art.environment.props.chest)).toHaveLength(0);
    expect(glowOf(art.zombies.walker.walk[0].frames[0])).toHaveLength(0);
  });
});

describe('a figure in front of a lit face', () => {
  it('covers it when standing just south and within a body width', () => {
    expect(isCovered(100, 80, [{ x: 100, y: 100 }])).toBe(true);
    expect(isCovered(100 + BODY_HALF_WIDTH, 80, [{ x: 100, y: 100 }])).toBe(true);
  });

  it('does not cover it from beside, behind or far below', () => {
    expect(isCovered(100, 80, [{ x: 100 + BODY_HALF_WIDTH + 1, y: 100 }])).toBe(false);
    expect(isCovered(100, 80, [{ x: 100, y: 70 }])).toBe(false);
    expect(isCovered(100, 80, [{ x: 100, y: 80 + BODY_REACH + 1 }])).toBe(false);
  });
});

describe('drawing the glow after the lightmap', () => {
  const map = generateWorldMap(1234);

  beforeEach(() => installFakeBrowser());

  function setup() {
    const buildings = new BuildingLayer(art.environment);
    buildings.setMap(map);
    const entities = new EntityRenderer(art, new VisualStore(), buildings, true);
    entities.setMap(map, () => undefined);
    const ctx = fakeCanvas().getContext();
    const fills = vi.fn();
    ctx.fillRect = fills;
    return { buildings, entities, ctx, fills };
  }

  const withGlow = (buildings: BuildingLayer) => buildings.placed.find((placed) => glowOf(placed.sprite).length > 0);

  function draw(entities: EntityRenderer, ctx: ReturnType<ReturnType<typeof fakeCanvas>['getContext']>, x: number, y: number, light: number, players: PlayerEntity[] = []) {
    const scene = { ...EMPTY_SCENE, players };
    entities.drawSelfLit(ctx as unknown as CanvasRenderingContext2D, scene, x - 240, y - 180, 480, 360, () => light);
  }

  it('lights a house\'s pumpkin faces in the dark', () => {
    const { buildings, entities, ctx, fills } = setup();
    const placed = withGlow(buildings);
    expect(placed).toBeDefined();
    draw(entities, ctx, placed!.building.x, placed!.building.y, 20);
    expect(fills).toHaveBeenCalled();
  });

  it('draws nothing where the town has no lit faces in view', () => {
    const { entities, ctx, fills } = setup();
    draw(entities, ctx, -5000, -5000, 20);
    expect(fills).not.toHaveBeenCalled();
  });

  it('lets the shell\'s glow go as the house opens around the player', () => {
    const closed = setup();
    const placed = withGlow(closed.buildings)!;
    draw(closed.entities, closed.ctx, placed.building.x, placed.building.y, 20);
    const shut = closed.fills.mock.calls.length;

    const open = setup();
    const same = withGlow(open.buildings)!;
    same.reveal = 1;
    draw(open.entities, open.ctx, same.building.x, same.building.y, 20);
    expect(open.fills.mock.calls.length).toBeLessThan(shut);
  });

  it('keeps a figure standing in front of a pumpkin from being painted over', () => {
    const clear = setup();
    const placed = withGlow(clear.buildings)!;
    const face = glowOf(placed.sprite)[0];
    draw(clear.entities, clear.ctx, placed.building.x, placed.building.y, 20);
    const bare = clear.fills.mock.calls.length;

    const crowded = setup();
    const target = withGlow(crowded.buildings)!;
    const x = target.x0 + face.x;
    const y = target.y0 + face.y + 12;
    const stander = { id: 'p1', x, y, angle: 0 } as unknown as PlayerEntity;
    draw(crowded.entities, crowded.ctx, target.building.x, target.building.y, 20, [stander]);
    expect(crowded.fills.mock.calls.length).toBeLessThan(bare);
  });
});
