import { roomFor } from './bag.ts';
import { TICK_DT } from './constants.ts';
import type { Container } from './containers.ts';
import type { Point } from './flow-field.ts';
import type { PlayerState, SimState } from './sim-state.ts';
import { emit } from './sim-state.ts';
import { doorBlocksSegment } from './doors.ts';
import { segmentHitsSolid } from './world-query.ts';
import { makeNoise } from './zombie-senses.ts';

/** Bottles a survivor starts a run with, and the most they can carry. */
export const START_BOTTLES = 1;
export const BOTTLE_CARRY = 3;
/** Furthest a bottle flies, and how far its smash carries. */
export const BOTTLE_RANGE = 170;
export const BOTTLE_NOISE_RADIUS = 220;
export const BOTTLE_COOLDOWN_SEC = 0.6;
/** Odds an empty-handed search still turns up an empty bottle. */
export const BOTTLE_FIND_CHANCE = 0.35;
/** Odds that going through a car sets its alarm off, and how far the alarm is heard. */
export const CAR_ALARM_CHANCE = 0.125;
export const CAR_ALARM_RADIUS = 420;

/** Pulls back along the throw in this many pixels at a time until the line is clear of walls. */
const BACKOFF_STEP = 6;

/** Where a bottle (or anything else thrown at the crosshair) lands: no further than its range, and short of the first wall. */
export function landingSpot(sim: SimState, p: PlayerState, range = BOTTLE_RANGE): Point {
  const aimed = p.aim ?? { x: p.x + Math.cos(p.angle) * range, y: p.y + Math.sin(p.angle) * range };
  const angle = Math.atan2(aimed.y - p.y, aimed.x - p.x);
  let distance = Math.min(range, Math.hypot(aimed.x - p.x, aimed.y - p.y));
  const spotAt = (reach: number): Point => ({ x: p.x + Math.cos(angle) * reach, y: p.y + Math.sin(angle) * reach });
  let spot = spotAt(distance);
  while (distance > 0 && (segmentHitsSolid(sim.map, p.x, p.y, spot.x, spot.y) || doorBlocksSegment(sim, p.x, p.y, spot.x, spot.y))) {
    distance = Math.max(0, distance - BACKOFF_STEP);
    spot = spotAt(distance);
  }
  return spot;
}

/** A throw asked for this tick lands at once and draws everything in earshot to where it broke. */
export function updateThrow(sim: SimState, p: PlayerState): void {
  p.throwCooldown = Math.max(0, p.throwCooldown - TICK_DT);
  const wanted = p.throwQueued;
  p.throwQueued = false;
  const able = wanted && p.bottles > 0 && p.throwCooldown === 0;
  if (!able) return;
  p.bottles -= 1;
  p.throwCooldown = BOTTLE_COOLDOWN_SEC;
  const spot = landingSpot(sim, p);
  makeNoise(sim, spot.x, spot.y, BOTTLE_NOISE_RADIUS);
  emit(sim, { type: 'bottle_smash', playerId: p.id, x: spot.x, y: spot.y, fromX: p.x, fromY: p.y });
}

/** An empty container can still hold an empty bottle, for someone with room for one. */
export function scroungeBottle(sim: SimState, p: PlayerState): boolean {
  const room = p.bottles < BOTTLE_CARRY && roomFor(p, 'bottle');
  const lucky = room && sim.rng() < BOTTLE_FIND_CHANCE;
  if (lucky) p.bottles += 1;
  return lucky;
}

/** Going through a car can set it off: the loudest thing in town that is not a horde. */
export function maybeCarAlarm(sim: SimState, container: Container): boolean {
  const isCar = container.kind === 'car';
  const tripped = isCar && sim.rng() < CAR_ALARM_CHANCE;
  if (!tripped) return false;
  makeNoise(sim, container.x, container.y, CAR_ALARM_RADIUS);
  emit(sim, { type: 'car_alarm', x: container.x, y: container.y });
  return true;
}
