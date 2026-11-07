import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BUILDING_DEFS, DOOR_WIDTH, WALL_THICKNESS } from '../shared/protocol.ts';
import type { BuildingInstance, WorldMap } from '../shared/protocol.ts';
import { buildLightBands, lightLevels } from '../src/engine/light-dither.ts';
import { LightField } from '../src/engine/light-field.ts';
import type { Beam, Rgb } from '../src/engine/light-field.ts';
import { flicker, Lighting, parseColor } from '../src/engine/lighting.ts';
import { OcclusionGrid } from '../src/engine/occlusion.ts';
import { fakeCanvas, installFakeBrowser } from './client-fake-dom.ts';

const AMBIENT: Rgb = [24, 28, 52];
const VIEW = 64;

function field(anchors: readonly number[] = [52]): LightField {
  const lights = new LightField(anchors);
  lights.resize(VIEW, VIEW);
  lights.begin(0, 0, AMBIENT);
  return lights;
}

function channels(word: number): [number, number, number] {
  return [word & 255, (word >>> 8) & 255, (word >>> 16) & 255];
}

function render(lights: LightField, size = VIEW): Int32Array {
  const pixels = new Int32Array(size * size);
  lights.write(pixels);
  return pixels;
}

function openBeam(patch: Partial<Beam> = {}): Beam {
  return {
    x: 8,
    y: 32,
    angle: 0,
    reach: 50,
    tanHalf: Math.tan(0.6),
    rays: new Float32Array(9).fill(50),
    color: [255, 208, 132],
    strength: 1,
    ...patch,
  };
}

describe('light levels', () => {
  it('runs from black to full brightness', () => {
    const levels = lightLevels();
    expect(levels[0]).toBe(0);
    expect(levels[levels.length - 1]).toBe(255);
  });

  it('keeps the darkest steps small, where they would show', () => {
    const levels = lightLevels();
    expect(levels[1] - levels[0]).toBeLessThan(levels[levels.length - 1] - levels[levels.length - 2]);
  });

  it('makes each anchor an exact level', () => {
    expect(lightLevels([52, 19])).toEqual(expect.arrayContaining([52, 19]));
  });

  it('brackets every brightness between two levels', () => {
    const { low, high } = buildLightBands(lightLevels([52]));
    for (let value = 0; value < 255; value += 1) {
      expect(low[value]).toBeLessThanOrEqual(value);
      expect(high[value]).toBeGreaterThan(value);
    }
  });
});

describe('LightField', () => {
  it('leaves an anchored ambient flat, so unlit ground has no pattern', () => {
    const pixels = render(field());
    expect(new Set(pixels).size).toBe(1);
    expect(channels(pixels[0])).toEqual([24, 28, 52]);
  });

  it('writes opaque pixels', () => {
    expect(render(field())[0] >>> 24).toBe(255);
    const lit = field();
    lit.addPool(32, 32, 30, [255, 200, 120], 1);
    expect(render(lit).every((word) => word >>> 24 === 255)).toBe(true);
  });

  it('stipples between two levels and keeps the average brightness', () => {
    const lights = new LightField([]);
    lights.resize(VIEW, VIEW);
    lights.begin(0, 0, [120, 120, 120]);
    const pixels = render(lights);
    expect(new Set(pixels).size).toBe(2);
    const mean = pixels.reduce((sum, word) => sum + (word & 255), 0) / pixels.length;
    expect(mean).toBeGreaterThan(112);
    expect(mean).toBeLessThan(128);
  });

  it('steps all three channels together, so the dark has no colour fringes', () => {
    const lights = new LightField([]);
    lights.resize(VIEW, VIEW);
    lights.begin(0, 0, [100, 50, 25]);
    for (const word of new Set(render(lights))) {
      const [r, g, b] = channels(word);
      expect(g / r).toBeCloseTo(0.5, 1);
      expect(b / r).toBeCloseTo(0.25, 1);
    }
  });

  it('pins the stipple to the world as the view moves', () => {
    const scan = (left: number) => {
      const lights = new LightField([]);
      lights.resize(8, 2);
      lights.begin(left, 0, [120, 120, 120]);
      const pixels = new Int32Array(16);
      lights.write(pixels);
      return Array.from(pixels.slice(0, 8));
    };
    expect(scan(1).slice(0, 7)).toEqual(scan(0).slice(1));
  });

  it('holds its hue where lights stack past full brightness', () => {
    const lights = field();
    lights.addPool(32, 32, 30, [255, 200, 120], 1);
    lights.addPool(32, 32, 30, [255, 200, 120], 1);
    lights.addPool(32, 32, 30, [255, 200, 120], 1);
    const [r, g, b] = channels(render(lights)[32 * VIEW + 32]);
    expect(r).toBe(255);
    expect(b).toBeLessThan(g);
    expect(g).toBeLessThan(r);
  });

  it('fades a pool from the middle to nothing at its radius', () => {
    const lights = field();
    lights.addPool(32, 32, 20, [200, 200, 200], 1);
    expect(lights.brightness(32, 32)).toBeGreaterThan(lights.brightness(42, 32));
    expect(lights.brightness(42, 32)).toBeGreaterThan(lights.brightness(50, 32));
    expect(lights.brightness(53, 32)).toBe(52);
  });

  it('keeps a clipped pool inside its rectangle', () => {
    const lights = field();
    lights.addPool(20, 32, 30, [200, 200, 200], 1, { x0: 10, y0: 10, x1: 30, y1: 50 });
    expect(lights.brightness(20, 32)).toBeGreaterThan(100);
    expect(lights.brightness(34, 32)).toBe(52);
    expect(lights.brightness(20, 54)).toBe(52);
  });

  it('skips a pool entirely off the view', () => {
    const lights = field();
    lights.addPool(-200, -200, 30, [200, 200, 200], 1);
    expect(new Set(render(lights)).size).toBe(1);
  });

  it('throws a warm beam, brightest down its middle', () => {
    const lights = field();
    lights.addBeam(openBeam());
    const pixels = render(lights);
    const [r, , b] = channels(pixels[32 * VIEW + 24]);
    expect(r).toBeGreaterThan(b * 1.5);
    expect(lights.brightness(24, 32)).toBeGreaterThan(lights.brightness(24, 42));
  });

  it('feathers the edge of the beam rather than cutting it', () => {
    const lights = field();
    lights.addBeam(openBeam({ color: [255, 255, 255] }));
    const across = [32, 36, 40, 44].map((y) => lights.brightness(30, y));
    for (let i = 1; i < across.length; i += 1) expect(across[i]).toBeLessThan(across[i - 1]);
    expect(across[0] - across[1]).toBeLessThan(across[0] * 0.5);
  });

  it('lights nothing behind the beam', () => {
    const lights = field();
    lights.addBeam(openBeam({ x: 32, angle: 0 }));
    expect(lights.brightness(20, 32)).toBe(52);
  });

  it('stops at the distance each ray reports', () => {
    const lights = field();
    lights.addBeam(openBeam({ rays: new Float32Array(9).fill(12) }));
    expect(lights.brightness(16, 32)).toBeGreaterThan(100);
    expect(lights.brightness(26, 32)).toBe(52);
  });

  it('shuts a room off from the lamps and sinks the outdoors', () => {
    const lights = field([52, 19, 22]);
    lights.addPool(32, 32, 30, [255, 180, 100], 1);
    const lit = lights.brightness(32, 32);
    lights.enclose({ x0: 24, y0: 24, x1: 40, y1: 40 }, [13, 13, 19], 0.42, 1);
    expect(lights.brightness(32, 32)).toBe(19);
    expect(lights.brightness(4, 4)).toBeCloseTo(52 * 0.42);
    expect(lit).toBeGreaterThan(200);
  });

  it('closes in by degrees as the shell fades', () => {
    const lights = field();
    lights.enclose({ x0: 24, y0: 24, x1: 40, y1: 40 }, [13, 13, 19], 0.42, 0.5);
    expect(lights.brightness(32, 32)).toBeCloseTo((52 + 19) / 2);
    expect(lights.brightness(4, 4)).toBeCloseTo(52 * 0.71);
  });

  it('reports no light off the field', () => {
    expect(field().brightness(-40, 12)).toBe(0);
    expect(field().brightness(12, 900)).toBe(0);
  });

  it('copes with an odd view on an odd offset', () => {
    const lights = new LightField([52]);
    lights.resize(61, 33);
    lights.begin(-3, 7, AMBIENT);
    const pixels = new Int32Array(61 * 33);
    lights.write(pixels);
    expect(pixels.every((word) => word !== 0)).toBe(true);
  });

  it('writes the same pixels whether a stretch is flat or stippled, on either offset', () => {
    for (const left of [0, 1]) {
      const lights = new LightField([52]);
      lights.resize(61, 33);
      lights.begin(left, 0, AMBIENT);
      lights.addPool(30, 16, 14, [200, 180, 150], 1);
      const pixels = new Int32Array(61 * 33);
      lights.write(pixels);
      expect(pixels.every((word) => word !== 0)).toBe(true);
      expect(channels(pixels[0])).toEqual([24, 28, 52]);
      expect(channels(pixels[60])).toEqual([24, 28, 52]);
      expect(channels(pixels[16 * 61 + 30])[0]).toBeGreaterThan(100);
    }
  });
});

describe('Lighting', () => {
  beforeEach(() => {
    installFakeBrowser();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('runs a frame through to the screen and leaves the target as it found it', () => {
    const lighting = new Lighting();
    lighting.resize(120, 80);
    lighting.begin(10, 20);
    lighting.addPool(60, 40, 30, '#ffb066', 0.8);
    lighting.enclose({ x0: 40, y0: 20, x1: 80, y1: 60 }, 1);
    lighting.addFlashlight(null, 70, 60, 0, 40, 1, 10, 20);
    lighting.finish();
    const target = fakeCanvas().getContext();
    lighting.apply(target as unknown as CanvasRenderingContext2D);
    expect(target.globalCompositeOperation).toBe('source-over');
    expect(target.globalAlpha).toBe(1);
    expect(target.drawImageCalls).toBeGreaterThan(0);
  });

  it('lays last frame\'s light down again, moved with the camera, and reads brightness where it now lies', () => {
    const lighting = new Lighting();
    lighting.resize(120, 80);
    expect(lighting.reuse(0, 0)).toBe(false);
    lighting.begin(10, 20);
    lighting.addPool(60, 40, 20, '#ffffff', 1);
    lighting.finish();
    const lit = lighting.brightness(60, 40);
    // The camera moves 3 right and 2 down: the same spot in the world is now 3 left and 2 up on screen.
    expect(lighting.reuse(13, 22)).toBe(true);
    expect(lighting.brightness(57, 38)).toBe(lit);
    const target = fakeCanvas().getContext();
    lighting.apply(target as unknown as CanvasRenderingContext2D);
    expect(target.globalCompositeOperation).toBe('source-over');
    expect(target.drawImageCalls).toBe(2);
  });

  it('works the light out afresh once the camera has moved too far for the old one', () => {
    const lighting = new Lighting();
    lighting.resize(120, 80);
    lighting.begin(0, 0);
    lighting.finish();
    expect(lighting.reuse(100, 0)).toBe(false);
  });

  it('reads colours from the map and the fx', () => {
    expect(parseColor('#ff7a2e')).toEqual([255, 122, 46]);
    expect(parseColor('#000')).toEqual([0, 0, 0]);
    expect(parseColor('#fa0')).toEqual([255, 170, 0]);
  });

  it('falls back to white for something it cannot read', () => {
    expect(parseColor('moonlight')).toEqual([255, 255, 255]);
  });

  it('keeps a failing lamp between off and full', () => {
    for (let time = 0; time < 20; time += 0.37) {
      const level = flicker(time, 3);
      expect(level).toBeGreaterThan(0);
      expect(level).toBeLessThanOrEqual(1);
    }
  });
});

describe('occlusion', () => {
  const shop: BuildingInstance = { id: 'b1', kind: 'pharmacy', x: 160, y: 160, variant: 0 };
  const { w, h, doorX } = BUILDING_DEFS.pharmacy;
  const south = shop.y + h;
  const doorCentre = shop.x + doorX;

  const map = {
    width: 800,
    height: 800,
    cols: 50,
    rows: 50,
    buildings: [shop],
    props: [
      { kind: 'dumpster' as const, x: 600, y: 200 },
      { kind: 'barrier' as const, x: 60, y: 160 },
    ],
  } as unknown as WorldMap;
  const grid = new OcclusionGrid(map);

  it('stops a ray from outside at the wall', () => {
    expect(grid.cast(100, 200, 0, 200)).toBeGreaterThan(50);
    expect(grid.cast(100, 200, 0, 200)).toBeLessThanOrEqual(60);
  });

  it('does not let a ray in through the door, since the roof covers what is behind it', () => {
    const dist = grid.cast(doorCentre, south + 40, -Math.PI / 2, 200);
    expect(dist).toBeLessThanOrEqual(40 + WALL_THICKNESS);
  });

  it('keeps a ray from inside the room behind the walls', () => {
    const fromMiddle = grid.cast(shop.x + w / 2, shop.y + h / 2, 0, 300);
    expect(fromMiddle).toBeLessThanOrEqual(w / 2);
    expect(fromMiddle).toBeGreaterThan(w / 2 - WALL_THICKNESS - 8);
  });

  it('lets a ray from inside out through the door', () => {
    const y = south - 20;
    expect(grid.cast(doorCentre, y, Math.PI / 2, 120)).toBe(120);
  });

  it('stops a ray from inside at the south wall beside the door', () => {
    const beside = doorCentre - DOOR_WIDTH / 2 - 12;
    expect(grid.cast(beside, south - 20, Math.PI / 2, 120)).toBeLessThanOrEqual(24);
  });

  it('carries light up a facade only when the ray heads north from outside', () => {
    const north = grid.cast(shop.x + 20, south + 30, -Math.PI / 2, 200, 0, 40);
    const plain = grid.cast(shop.x + 20, south + 30, -Math.PI / 2, 200);
    expect(north - plain).toBe(40);

    const heading = grid.cast(shop.x + 20, shop.y - 30, Math.PI / 2, 200, 0, 40);
    expect(heading).toBe(grid.cast(shop.x + 20, shop.y - 30, Math.PI / 2, 200));
  });

  it('never carries light through a wall from inside', () => {
    const y = shop.y + 40;
    const plain = grid.cast(shop.x + 40, y, -Math.PI / 2, 200);
    expect(grid.cast(shop.x + 40, y, -Math.PI / 2, 200, 20, 40)).toBe(plain);
  });

  it('stops at a tall prop and lights a little of its face', () => {
    const plain = grid.cast(520, 193, 0, 200);
    expect(plain).toBeLessThan(80);
    expect(grid.cast(520, 193, 0, 200, 20)).toBe(plain + 20);
  });

  it('lets light pass over low props', () => {
    expect(grid.cast(20, 156, 0, 100)).toBe(100);
  });

  it('runs the full length through open ground', () => {
    expect(grid.cast(100, 500, 0, 200)).toBe(200);
  });
});
