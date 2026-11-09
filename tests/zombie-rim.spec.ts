import { describe, expect, it } from 'vitest';
import { INK, INK_SOFT } from '../src/art/palette.ts';
import { buildZombies } from '../src/art/zombies.ts';
import { ZOMBIE_RIM, rimmed } from '../src/art/zombies/rim.ts';
import type { PixelSprite } from '../src/art/types.ts';
import type { ZombieType } from '../shared/protocol.ts';

const TYPES: ZombieType[] = ['walker', 'runner', 'bloater', 'brute', 'screamer'];
const hex = (s: PixelSprite, i: number): number => (s.rgba[i] << 16) | (s.rgba[i + 1] << 8) | s.rgba[i + 2];

function frames(type: ZombieType): PixelSprite[] {
  const art = buildZombies()[type];
  return [...art.walk, ...art.attack].flatMap((c) => c.frames).concat(art.death.frames);
}

describe('zombie rim', () => {
  it.each(TYPES)('%s has a dark-red rim and no outer near-black ink', (type) => {
    let rim = 0;
    let ink = 0;
    for (const s of frames(type)) {
      for (let y = 0; y < s.h; y++) {
        for (let x = 0; x < s.w; x++) {
          const i = (y * s.w + x) * 4;
          if (s.rgba[i + 3] === 0) continue;
          const edge = [[-1, 0], [1, 0], [0, -1], [0, 1]].some(([dx, dy]) => {
            const nx = x + dx;
            const ny = y + dy;
            return nx < 0 || ny < 0 || nx >= s.w || ny >= s.h || s.rgba[(ny * s.w + nx) * 4 + 3] === 0;
          });
          if (!edge) continue;
          const c = hex(s, i);
          if (c === ZOMBIE_RIM) rim++;
          if (c === INK || c === INK_SOFT) ink++;
        }
      }
    }
    expect(rim).toBeGreaterThan(0);
    expect(ink).toBe(0);
  });

  it('keeps silhouette: same size, anchor and alpha', () => {
    const s: PixelSprite = { w: 3, h: 1, ax: 1, ay: 0, rgba: new Uint8ClampedArray([13, 11, 22, 255, 200, 200, 200, 255, 0, 0, 0, 0]) };
    const r = rimmed(s);
    expect([r.w, r.h, r.ax, r.ay]).toEqual([3, 1, 1, 0]);
    expect(Array.from(r.rgba).filter((_, i) => i % 4 === 3)).toEqual([255, 255, 0]);
    expect(hex(r, 0)).toBe(ZOMBIE_RIM);
    expect(hex(r, 4)).toBe(0xc8c8c8);
  });
});
