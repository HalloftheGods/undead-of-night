import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GroundFog } from '../src/engine/ground-fog.ts';
import { LEVEL_LOOKS } from '../src/engine/level-look.ts';
import { fakeCanvas, installFakeBrowser } from './client-fake-dom.ts';

describe('GroundFog', () => {
  beforeEach(() => {
    installFakeBrowser();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('skips rendering when outdoors is 0', () => {
    const fog = new GroundFog(false);
    const canvas = fakeCanvas();
    const ctx = canvas.getContext();
    fog.draw(ctx as unknown as CanvasRenderingContext2D, LEVEL_LOOKS.night, 0, 0, 320, 240, 10, 0);
    expect(ctx.drawImageCalls).toBe(0);
  });

  it('draws wave sheets for sheet fog theme', () => {
    const fog = new GroundFog(false);
    const canvas = fakeCanvas();
    const ctx = canvas.getContext();
    fog.draw(ctx as unknown as CanvasRenderingContext2D, LEVEL_LOOKS.emergency, 0, 0, 320, 240, 5, 1);
    expect(ctx.drawImageCalls).toBe(8);
  });

  it('draws both sheets and tendrils for flooded theme', () => {
    const fog = new GroundFog(false);
    const canvas = fakeCanvas();
    const ctx = canvas.getContext();
    fog.draw(ctx as unknown as CanvasRenderingContext2D, LEVEL_LOOKS.flooded, 0, 0, 320, 240, 5, 1);
    expect(ctx.drawImageCalls).toBe(22);
  });

  it('draws tendrils for contaminated theme', () => {
    const fog = new GroundFog(false);
    const canvas = fakeCanvas();
    const ctx = canvas.getContext();
    fog.draw(ctx as unknown as CanvasRenderingContext2D, LEVEL_LOOKS.contaminated, 0, 0, 320, 240, 5, 1);
    expect(ctx.drawImageCalls).toBe(14);
  });

  it('accepts lightAt boost function to illuminate fog', () => {
    const fog = new GroundFog(false);
    const canvas = fakeCanvas();
    const ctx = canvas.getContext();
    const lightAt = (_x: number, _y: number) => 180;
    fog.draw(ctx as unknown as CanvasRenderingContext2D, LEVEL_LOOKS.night, 0, 0, 320, 240, 5, 1, lightAt);
    expect(ctx.drawImageCalls).toBe(22);
  });

  it('skips rendering for bunker theme with no fog', () => {
    const fog = new GroundFog(false);
    const canvas = fakeCanvas();
    const ctx = canvas.getContext();
    fog.draw(ctx as unknown as CanvasRenderingContext2D, LEVEL_LOOKS.bunker, 0, 0, 320, 240, 5, 1);
    expect(ctx.drawImageCalls).toBe(0);
  });
});
