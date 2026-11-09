// A dark-red rim so a zombie reads against a dark night outside a lamp or the flashlight cone.
// The outline pass paints the shadow side of a figure in near-black ink, which vanishes on dark
// ground. This recolours those outermost ink pixels to blood[1]. No pixel is added or removed
// (same silhouette, size and anchor) and it is deep enough not to glow when the figure is lit.

import { INK, INK_SOFT, RAMPS } from '../palette.ts';
import type { Clip, DirClips, PixelSprite, ZombieArt } from '../types.ts';

export const ZOMBIE_RIM = RAMPS.blood[1];

const R = (ZOMBIE_RIM >> 16) & 255;
const G = (ZOMBIE_RIM >> 8) & 255;
const B = ZOMBIE_RIM & 255;
const INKS = new Set<number>([INK, INK_SOFT]);

export function rimmed(sprite: PixelSprite): PixelSprite {
  const { w, h, rgba } = sprite;
  const out = new Uint8ClampedArray(rgba);
  const clear = (x: number, y: number): boolean => x < 0 || y < 0 || x >= w || y >= h || rgba[(y * w + x) * 4 + 3] === 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (rgba[i + 3] === 0) continue;
      const ink = INKS.has((rgba[i] << 16) | (rgba[i + 1] << 8) | rgba[i + 2]);
      const edge = clear(x - 1, y) || clear(x + 1, y) || clear(x, y - 1) || clear(x, y + 1);
      if (!ink || !edge) continue;
      out[i] = R;
      out[i + 1] = G;
      out[i + 2] = B;
    }
  }
  return { ...sprite, rgba: out };
}

const clip = (c: Clip): Clip => ({ ...c, frames: c.frames.map(rimmed) });
const dirs = (d: DirClips): DirClips => d.map(clip);

/** Every walk, attack and death frame of a zombie, rimmed. */
export function rimZombie(art: ZombieArt): ZombieArt {
  return { ...art, walk: dirs(art.walk), attack: dirs(art.attack), death: clip(art.death) };
}
