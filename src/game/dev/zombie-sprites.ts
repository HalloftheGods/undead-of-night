import type { ArtBook, Clip, PixelSprite, ZombieArt } from '../../art/types.ts';
import { clipFrame } from '../../engine/sprite-cache.ts';

/** The clips a zombie plays, in the order the sprites page lists them. */
export const ZOMBIE_ANIMATIONS = ['walk', 'attack', 'death', 'get up', 'lying'] as const;
export type ZombieAnimation = (typeof ZOMBIE_ANIMATIONS)[number];

/** The eight facings, in the order the art indexes them. */
export const FACINGS = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'] as const;

/** Directional clips use the facing; death and the rest ignore it. */
export function clipOf(art: ZombieArt, animation: ZombieAnimation, facing: number): Clip {
  if (animation === 'walk') return art.walk[facing];
  if (animation === 'attack') return art.attack[facing];
  if (animation === 'get up') return { ...art.death, frames: [...art.death.frames].reverse(), loop: false };
  return art.death;
}

/** The frame on screen `seconds` in. A one-shot clip holds its last frame; `loopOnce` restarts it after a pause so it can be watched. */
export function frameAt(art: ZombieArt, animation: ZombieAnimation, facing: number, seconds: number): PixelSprite {
  if (animation === 'lying') return art.death.frames[art.death.frames.length - 1];
  const clip = clipOf(art, animation, facing);
  const length = clip.frames.length / clip.fps;
  const cycle = clip.loop ? seconds : seconds % (length + 0.6);
  return clipFrame(clip, cycle);
}

export const zombieTypes = (art: ArtBook): string[] => Object.keys(art.zombies);
