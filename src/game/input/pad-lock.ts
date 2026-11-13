// The pad's headshot aim: the right stick locks a zombie, and a ring closes on its head. Fire as the ring
// closes and the shot goes to the head; fire early and it goes to the chest. Pure geometry and timing, tested
// without a page. run-frame.ts holds the state and the overlay draws the ring.

import type { EntityId, ZombieEntity } from '../../../shared/protocol.ts';
import type { NavDirection } from './gamepad-input.ts';

/** Where the ring starts, in pixels. It closes on the head's own radius. */
export const RING_START_RADIUS = 28;
const RING_END_RADIUS = 4;
/** Seconds for the ring to close with no streak, the floor a streak shortens it to, and the step per headshot. */
const RING_PERIOD = 0.9;
const RING_PERIOD_FLOOR = 0.55;
const RING_PERIOD_STEP = 0.05;
/** The last stretch of the close that sends a shot to the head. */
const PERFECT_WINDOW = 0.15;
/** Each zombie in reach past the first quickens the ring by this much, up to the cap: a horde is a faster fight. */
const CROWD_STEP = 0.08;
const CROWD_MAX_SPEED = 2;

/** How many times faster the ring runs with `count` zombies in reach: 1 for one or none, 2 at thirteen or more. */
export function crowdSpeed(count: number): number {
  return Math.min(CROWD_MAX_SPEED, 1 + CROWD_STEP * Math.max(0, count - 1));
}

/** A headshot streak lasts this long past the last headshot, as the sim's does. */
const STREAK_LAPSE_MS = 3500;
/** Sideways drift counts double against distance ahead, as menu focus does. */
const LATERAL_WEIGHT = 2;

interface Point {
  readonly x: number;
  readonly y: number;
}

export type LockCandidate = Pick<ZombieEntity, 'id' | 'type' | 'x' | 'y' | 'angle' | 'health'>;

/** Seconds for one close of the ring after `streak` headshots in a row. */
export function ringPeriod(streak: number): number {
  return Math.max(RING_PERIOD_FLOOR, RING_PERIOD - RING_PERIOD_STEP * Math.max(0, streak - 1));
}

/** The ring `elapsedSec` into a cycle: it shrinks, flags the perfect window, and starts over each period. */
export function ringAt(elapsedSec: number, streak: number): { radius: number; perfect: boolean; progress: number } {
  const period = ringPeriod(streak);
  const phase = (elapsedSec % period) / period;
  const radius = RING_START_RADIUS - (RING_START_RADIUS - RING_END_RADIUS) * phase;
  return { radius, perfect: (elapsedSec % period) >= period - PERFECT_WINDOW, progress: phase };
}

let streak = 0;
let headshots = 0;
let streakAtMs = Number.NEGATIVE_INFINITY;

/** A headshot of the local player's landed; `chain` is the sim's streak length. */
export function noteHeadshotStreak(chain: number, nowMs: number): void {
  streak = chain;
  headshots += 1;
  streakAtMs = nowMs;
}

export function currentStreak(nowMs: number): number {
  return nowMs - streakAtMs > STREAK_LAPSE_MS ? 0 : streak;
}

/** How many headshots have landed: a change means the ring should start over. */
export function headshotCount(): number {
  return headshots;
}

export function resetStreak(): void {
  streak = 0;
  headshots = 0;
  streakAtMs = Number.NEGATIVE_INFINITY;
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * The zombie to lock. Nothing locks by itself: with no push the current lock stays while it is alive and in reach,
 * else there is none. A push steps to the nearest living zombie that way from the current one, or from the survivor
 * when nothing is locked, and loops to the far end of the line if nothing lies that way. `canReach` rules a zombie out, as walls do: nobody inside a house is locked from outside, or the other way round.
 */
export function pickLock(from: Point, zombies: readonly LockCandidate[], current: EntityId | null, direction: NavDirection | null, reach: number, canReach: (zombie: LockCandidate) => boolean = () => true): EntityId | null {
  const held = zombies.find((zombie) => zombie.id === current && zombie.health > 0 && distance(from, zombie) <= reach && canReach(zombie));
  if (direction === null) return held ? held.id : null;
  const origin: Point = held ?? from;
  let best: EntityId | null = held ? held.id : null;
  let bestScore = Infinity;
  for (const zombie of zombies) {
    if (zombie.id === held?.id || zombie.health <= 0 || distance(from, zombie) > reach || !canReach(zombie)) continue;
    const dx = zombie.x - origin.x;
    const dy = zombie.y - origin.y;
    const along = direction === 'right' ? dx : direction === 'left' ? -dx : direction === 'down' ? dy : -dy;
    const across = direction === 'left' || direction === 'right' ? Math.abs(dy) : Math.abs(dx);
    if (along < 1) continue;
    const score = along + LATERAL_WEIGHT * across;
    if (score < bestScore) {
      best = zombie.id;
      bestScore = score;
    }
  }
  if (best !== null && best !== held?.id) return best;
  // Nothing further that way: loop round to the far end of the line, as menu focus does, so the lock never sticks at the back.
  let far: EntityId | null = null;
  let farScore = -Infinity;
  for (const zombie of zombies) {
    if (zombie.id === held?.id || zombie.health <= 0 || distance(from, zombie) > reach || !canReach(zombie)) continue;
    const dx = zombie.x - origin.x;
    const dy = zombie.y - origin.y;
    const along = direction === 'right' ? dx : direction === 'left' ? -dx : direction === 'down' ? dy : -dy;
    const across = direction === 'left' || direction === 'right' ? Math.abs(dy) : Math.abs(dx);
    const score = -along - LATERAL_WEIGHT * across;
    if (score > farScore) {
      far = zombie.id;
      farScore = score;
    }
  }
  return far ?? best;
}
