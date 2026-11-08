import { beforeAll, describe, expect, it } from 'vitest';
import { buildArtBook } from '../src/art/index.ts';
import { inPalette } from '../src/art/palette.ts';
import type { AmbientFxArt, Clip, PixelSprite } from '../src/art/types.ts';

function opaquePixels(sprite: PixelSprite): number {
  let count = 0;
  for (let i = 3; i < sprite.rgba.length; i += 4) count += Number(sprite.rgba[i] === 255);
  return count;
}

function colorsOf(sprite: PixelSprite): number[] {
  const out: number[] = [];
  for (let i = 0; i < sprite.rgba.length; i += 4) {
    if (sprite.rgba[i + 3] === 255) out.push((sprite.rgba[i] << 16) | (sprite.rgba[i + 1] << 8) | sprite.rgba[i + 2]);
  }
  return out;
}

describe('ambient fx art', () => {
  let ambient: AmbientFxArt;
  const clips: [string, Clip][] = [];
  const lists: [string, readonly PixelSprite[]][] = [];

  beforeAll(() => {
    ambient = buildArtBook().fx.ambient;
    for (const [key, value] of Object.entries(ambient)) {
      if (Array.isArray(value)) lists.push([key, value as PixelSprite[]]);
      else clips.push([key, value as Clip]);
    }
  });

  it('exposes twelve assets', () => {
    expect(clips.length + lists.length).toBe(12);
    expect(clips.map(([k]) => k).sort()).toEqual(['emberDrift', 'hitSpark', 'leafFall', 'pickupRing', 'rainSplash', 'rainStreak', 'sporeDrift']);
    expect(lists.map(([k]) => k).sort()).toEqual(['bloodFootprints', 'bulletHoles', 'glassShards', 'gibs', 'scorchDecals']);
  });

  it('gives every clip several same-sized frames with something visible', () => {
    for (const [name, clip] of clips) {
      expect(clip.frames.length, name).toBeGreaterThanOrEqual(4);
      expect(clip.fps, name).toBeGreaterThan(0);
      for (const f of clip.frames) {
        expect([name, f.w, f.h, f.ax, f.ay]).toEqual([name, clip.frames[0].w, clip.frames[0].h, clip.frames[0].ax, clip.frames[0].ay]);
        expect(opaquePixels(f), name).toBeGreaterThan(0);
      }
    }
  });

  it('animates: no clip repeats a frame back to back', () => {
    for (const [name, clip] of clips) {
      clip.frames.slice(1).forEach((f, i) => {
        expect(Buffer.from(f.rgba).equals(Buffer.from(clip.frames[i].rgba)), `${name} frame ${i + 1}`).toBe(false);
      });
    }
  });

  it('keeps every still non-empty, in palette, with more than one variant', () => {
    for (const [name, list] of lists) {
      expect(list.length, name).toBeGreaterThanOrEqual(2);
      for (const s of list) {
        expect(opaquePixels(s), name).toBeGreaterThan(0);
        expect(colorsOf(s).filter((c) => !inPalette(c)), name).toEqual([]);
      }
    }
  });

  it('makes scorch marks grow and gibs differ', () => {
    const widths = ambient.scorchDecals.map((s) => s.w);
    expect(widths).toEqual([...widths].sort((a, b) => a - b));
    expect(new Set(ambient.gibs.map((g) => Buffer.from(g.rgba).toString('hex'))).size).toBe(ambient.gibs.length);
  });

  it('widens the pickup ring and the rain ripple as they play', () => {
    for (const clip of [ambient.pickupRing, ambient.rainSplash]) {
      const spread = clip.frames.map((f) => {
        let min = f.w;
        let max = -1;
        for (let y = 0; y < f.h; y++) {
          for (let x = 0; x < f.w; x++) {
            if (f.rgba[(y * f.w + x) * 4 + 3] === 255) {
              min = Math.min(min, x);
              max = Math.max(max, x);
            }
          }
        }
        return max - min;
      });
      expect(spread[spread.length - 1]).toBeGreaterThan(spread[0]);
    }
  });
});
