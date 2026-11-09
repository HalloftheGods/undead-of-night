// The undead. Each zombie lives in src/art/zombies/; the rig and body there are shared.
// The walker is the style anchor every art lane copies.

import type { ZombieType } from '../../shared/protocol.ts';
import type { ZombieArt } from './types.ts';
import { buildBloater } from './zombies/bloater.ts';
import { buildBrute } from './zombies/brute.ts';
import { buildRunner } from './zombies/runner.ts';
import { buildScreamer } from './zombies/screamer.ts';
import { rimZombie } from './zombies/rim.ts';
import { buildWalker } from './zombies/walker.ts';

export { referenceWalker } from './zombies/walker.ts';

/**
 * ZombieArt.footDrop per type: rows from the anchor down to where the soles stand, read off
 * the walk frames (lowest painted row minus ay) on 2026-11-06. Side views of the walker,
 * runner and screamer sit at 3 throughout and the bloater's mostly at 5 (4 seen from the
 * front); the brute's side views reach 9 to 11, but that is the rock it drags, so its value
 * comes from the front and back views. A redrawn zombie needs its value measured again;
 * tests/sprite-look-7133.spec.ts checks each against the south-facing walk.
 */
const FOOT_DROP: Readonly<Record<ZombieType, number>> = { walker: 3, runner: 3, bloater: 4, brute: 4, screamer: 3 };

function grounded(type: ZombieType, art: ZombieArt): ZombieArt {
  return rimZombie({ ...art, footDrop: FOOT_DROP[type] });
}

export function buildZombies(): Record<ZombieType, ZombieArt> {
  return {
    walker: grounded('walker', buildWalker()),
    runner: grounded('runner', buildRunner()),
    bloater: grounded('bloater', buildBloater()),
    brute: grounded('brute', buildBrute()),
    screamer: grounded('screamer', buildScreamer()),
  };
}
