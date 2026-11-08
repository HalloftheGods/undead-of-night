import { describe, expect, it } from 'vitest';
import { SURVIVOR_SKIN_COUNT, WEAPON_ORDER } from '../shared/protocol.ts';
import { buildSurvivors, MUZZLE_OFFSETS } from '../src/art/survivors.ts';
import type { Clip, PixelSprite } from '../src/art/types.ts';

const AXES = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];

function opaqueAt(sprite: PixelSprite, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < sprite.w && y < sprite.h && sprite.rgba[(y * sprite.w + x) * 4 + 3] === 255;
}

function bounds(sprite: PixelSprite): { w: number; h: number } {
  const xs: number[] = [];
  const ys: number[] = [];
  for (let y = 0; y < sprite.h; y++) {
    for (let x = 0; x < sprite.w; x++) {
      if (opaqueAt(sprite, x, y)) {
        xs.push(x);
        ys.push(y);
      }
    }
  }
  return { w: Math.max(...xs) - Math.min(...xs) + 1, h: Math.max(...ys) - Math.min(...ys) + 1 };
}

describe('survivors', () => {
  const art = buildSurvivors();

  it('gives each skin its own look', () => {
    expect(art).toHaveLength(SURVIVOR_SKIN_COUNT);
    const looks = art.map((skin) => skin.weapons.pistol.idle[2].frames[0].rgba.join());
    expect(new Set(looks).size).toBe(SURVIVOR_SKIN_COUNT);
  });

  it('frames every animation the design calls for', () => {
    for (const skin of art) {
      for (const id of WEAPON_ORDER) {
        const set = skin.weapons[id];
        for (let dir = 0; dir < 8; dir++) {
          expect(set.idle[dir].frames).toHaveLength(2);
          expect(set.walk[dir].frames.length).toBeGreaterThanOrEqual(4);
          expect(set.fire[dir].frames.length).toBeGreaterThanOrEqual(2);
          expect(set.reload[dir].frames.length).toBeGreaterThanOrEqual(4);
          expect(set.fire[dir].loop).toBe(false);
        }
      }
      expect(skin.downed.frames.length).toBeGreaterThanOrEqual(2);
      expect(skin.dead.loop).toBe(false);
    }
  });

  it('ends the fire clip before the next carbine round', () => {
    const fire: Clip = art[0].weapons.carbine.fire[0];
    expect(fire.frames.length / fire.fps).toBeLessThan(0.115);
  });

  it('stays in the character scale', () => {
    for (const skin of art) {
      const { w, h } = bounds(skin.weapons.pistol.idle[6].frames[0]);
      expect(h).toBeGreaterThanOrEqual(18);
      expect(h).toBeLessThanOrEqual(32);
      expect(w).toBeLessThanOrEqual(26);
    }
  });

  it('makes Kai the smallest of the cast', () => {
    const heights = art.map((skin) => bounds(skin.weapons.pistol.idle[2].frames[0]).h);
    const sol = heights[heights.length - 1];
    expect(heights.slice(0, -1).every((height) => height > sol)).toBe(true);
  });

  it('gives each survivor a portrait from the same frame', () => {
    const sizes = new Set(art.map(({ portrait }) => `${portrait.w}x${portrait.h}`));
    expect(sizes.size).toBe(1);
  });

  it('puts each muzzle offset on the last pixel of the barrel', () => {
    for (const id of WEAPON_ORDER) {
      expect(MUZZLE_OFFSETS[id]).toHaveLength(8);
      MUZZLE_OFFSETS[id].forEach(({ x, y }, dir) => {
        const frame = art[0].weapons[id].idle[dir].frames[0];
        const px = x + frame.ax;
        const py = y + frame.ay + art[0].gunDrop;
        const [ax, ay] = AXES[dir];
        expect(opaqueAt(frame, px, py), `${id} ${dir} tip`).toBe(true);
        // Facing the viewer the barrel lies over the legs, so only the tip itself can be checked.
        if (dir !== 2) expect(opaqueAt(frame, px + ax * 3, py + ay * 3), `${id} ${dir} past tip`).toBe(false);
      });
    }
  });

  it('points the muzzle along the facing', () => {
    for (const id of WEAPON_ORDER) {
      MUZZLE_OFFSETS[id].forEach(({ x, y }, dir) => {
        const [ax, ay] = AXES[dir];
        // Chest height, not the feet, is the origin a gun points from.
        const dot = ax * x + ay * (y + 12);
        expect(dot, `${id} ${dir}`).toBeGreaterThan(0);
      });
    }
  });
});
