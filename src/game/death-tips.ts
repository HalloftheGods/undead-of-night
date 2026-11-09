/**
 * One tip on the Game Over screen, a different one each death. Every line restates something How to Play
 * already says (game/how-to-play.ts), so a tip can never promise what the game does not do.
 */
import { browserStore, readJson, writeJson, type Store } from './storage.ts';

export const DEATH_TIPS: readonly string[] = [
  'Gunshots carry. Shoving is silent, so save the gun for a crowd.',
  'Headshots save ammo. The crosshair turns red over a head.',
  'Every house has a candy bowl by its front door. Each candy works for about a horde.',
  'A Jawbreaker halves the damage you take while it works.',
  'Throw a bottle to pull zombies away from where you need to be.',
  'Sneaking is slow, but quiet. Sprinting is heard, and you cannot keep it up.',
  'A grey screamer that spots you calls everything nearby. Shoot it first.',
  'After the first horde a supply crate comes down on a red flare. Others will hear it too.',
  'Ammo and health never refill on their own. Search buildings between hordes.',
  'Stay quiet and let them wander past. Not every zombie needs a bullet.',
];

const TIP_KEY = 'outbreak.deathTip';

/** The tip after the one shown last time, wrapping round, and remembered for next time. */
export function nextDeathTip(store: Store | null = browserStore()): string {
  const saved = readJson(store, TIP_KEY);
  const last = typeof saved === 'number' && Number.isInteger(saved) ? saved : -1;
  const index = (last + 1 + DEATH_TIPS.length) % DEATH_TIPS.length;
  writeJson(store, TIP_KEY, index);
  return DEATH_TIPS[index];
}
