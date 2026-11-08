import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BUILDING_DEFS } from '../shared/protocol.ts';
import type { ZombieEntity, ZombieType } from '../shared/protocol.ts';
import { generateWorldMap } from '../shared/world-map.ts';
import { buildArtBook } from '../src/art/index.ts';
import type { PixelSprite } from '../src/art/types.ts';
import { BuildingLayer } from '../src/engine/building-layer.ts';
import { EntityRenderer } from '../src/engine/entity-renderer.ts';
import { EMPTY_SCENE } from '../src/engine/scene.ts';
import { VisualStore } from '../src/engine/visuals.ts';
import { blinking, EYE_LIT_FLOOR, eyeGlow, eyePhase, eyesOf } from '../src/engine/zombie-eyes.ts';
import { fakeCanvas, installFakeBrowser } from './client-fake-dom.ts';

const art = buildArtBook();
const TYPES: readonly ZombieType[] = ['walker', 'runner', 'bloater', 'brute', 'screamer'];
const FRONT = [0, 1, 2, 3, 4];
const BACK = [5, 6, 7];

function paintedRows(sprite: PixelSprite): [number, number] {
  let top = -1;
  let bottom = -1;
  for (let y = 0; y < sprite.h; y += 1) {
    for (let x = 0; x < sprite.w; x += 1) {
      if (sprite.rgba[(y * sprite.w + x) * 4 + 3] === 0) continue;
      if (top < 0) top = y;
      bottom = y;
    }
  }
  return [top, bottom];
}

describe('zombie eyes in the art', () => {
  it.each(TYPES)('finds eyes in every %s frame that faces the camera, and nothing else', (type) => {
    const zombie = art.zombies[type];
    for (const clips of [zombie.walk, zombie.attack]) {
      for (const dir of FRONT) {
        for (const frame of clips[dir].frames) {
          const eyes = eyesOf(frame, type);
          expect(eyes.length).toBeGreaterThan(0);
          // Two eyes, or one from the side; the brute's are two pixels each.
          expect(eyes.length).toBeLessThanOrEqual(6);
          if (type !== 'bloater') continue;
          // Its belly shares the eye green: only the head may count.
          const [top, bottom] = paintedRows(frame);
          for (const eye of eyes) expect((eye.y - top) / (bottom - top)).toBeLessThan(0.2);
        }
      }
    }
  });

  it.each(TYPES)('finds none on a %s seen from behind', (type) => {
    const zombie = art.zombies[type];
    for (const dir of BACK) {
      for (const frame of zombie.walk[dir].frames) expect(eyesOf(frame, type)).toHaveLength(0);
    }
  });

  it('keeps what it found for a frame', () => {
    const frame = art.zombies.walker.walk[2].frames[0];
    expect(eyesOf(frame, 'walker')).toBe(eyesOf(frame, 'walker'));
  });
});

describe('how bright the eyes burn', () => {
  it('burns in full under moonlight and in a dark room', () => {
    expect(eyeGlow(0)).toBe(1);
    expect(eyeGlow(31)).toBe(1);
    expect(eyeGlow(52)).toBe(1);
  });

  it('fades to a glint in the beam, never brighter as the light grows', () => {
    expect(eyeGlow(255)).toBeCloseTo(EYE_LIT_FLOOR);
    let last = eyeGlow(0);
    for (let light = 0; light <= 300; light += 10) {
      expect(eyeGlow(light)).toBeLessThanOrEqual(last);
      last = eyeGlow(light);
    }
  });

  it('blinks briefly, and not in time across a horde', () => {
    let shut = 0;
    const steps = 5300;
    for (let i = 0; i < steps; i += 1) if (blinking(i / 1000, 0.3)) shut += 1;
    expect(shut / steps).toBeGreaterThan(0.01);
    expect(shut / steps).toBeLessThan(0.05);
    expect(eyePhase('z1')).not.toBe(eyePhase('z2'));
  });
});

describe('zombie eyes on screen', () => {
  const map = generateWorldMap(4242);

  beforeEach(() => {
    installFakeBrowser();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function setup() {
    const buildings = new BuildingLayer(art.environment);
    buildings.setMap(map);
    const visuals = new VisualStore();
    const entities = new EntityRenderer(art, visuals, buildings, true);
    const ctx = fakeCanvas().getContext();
    const fills = vi.fn();
    ctx.fillRect = fills;
    return { buildings, visuals, entities, ctx, fills };
  }

  const zombie = (x: number, y: number, angle = Math.PI / 2): ZombieEntity => ({
    id: 'z1', type: 'walker', x, y, angle, health: 10, maxHealth: 10, attacking: false,
  });

  /** Somewhere in the open street, with no building over or in front of it. */
  function openGround(buildings: BuildingLayer): { x: number; y: number } {
    for (let y = 200; y < 3000; y += 37) {
      for (let x = 200; x < 3000; x += 37) {
        const clear = !buildings.isHidden(x, y) && buildings.placed.every((placed) => (
          x < placed.x0 - 60 || x > placed.x1 + 60 || y < placed.y0 - 60 || y > placed.y1 + 60
        ));
        if (clear) return { x, y };
      }
    }
    throw new Error('no open ground on the test map');
  }

  function draw(entities: EntityRenderer, ctx: ReturnType<ReturnType<typeof fakeCanvas>['getContext']>, z: ZombieEntity, light: number) {
    const scene = { ...EMPTY_SCENE, zombies: [z] };
    const left = z.x - 160;
    const top = z.y - 120;
    const c = ctx as unknown as CanvasRenderingContext2D;
    entities.drawWorld(c, scene, left, top, 320, 240, 0, 1 / 60);
    entities.drawEyes(c, scene, left, top, 320, 240, 0, () => light);
  }

  it('lights the eyes of a zombie facing the camera in the dark', () => {
    const { buildings, entities, ctx, fills } = setup();
    const spot = openGround(buildings);
    draw(entities, ctx, zombie(spot.x, spot.y), 20);
    expect(fills).toHaveBeenCalled();
  });

  it('shows no eyes on a zombie walking away', () => {
    const { buildings, entities, ctx, fills } = setup();
    const spot = openGround(buildings);
    draw(entities, ctx, zombie(spot.x, spot.y, -Math.PI / 2), 20);
    expect(fills).not.toHaveBeenCalled();
  });

  it('keeps the eyes of a zombie inside a closed building hidden under its roof', () => {
    const { buildings, entities, ctx, fills } = setup();
    const building = map.buildings[0];
    const def = BUILDING_DEFS[building.kind];
    const x = building.x + def.w / 2;
    const y = building.y + def.h / 2;
    expect(buildings.isHidden(x, y)).toBe(true);
    draw(entities, ctx, zombie(x, y), 20);
    expect(fills).not.toHaveBeenCalled();
  });

  it('puts out the eyes of a zombie already shown dying', () => {
    const { buildings, entities, ctx, fills } = setup();
    const spot = openGround(buildings);
    entities.addCorpse('z1', 'walker', spot.x, spot.y, 0);
    draw(entities, ctx, zombie(spot.x, spot.y), 20);
    expect(fills).not.toHaveBeenCalled();
  });
});
