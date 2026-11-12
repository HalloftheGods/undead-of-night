// What a car sounds like to the town: the driver's horn and the engine that draws zombies.

import { TICK_DT, TICK_RATE } from './constants.ts';
import type { PlayerState, SimState, VehicleState } from './sim-state.ts';
import { emit } from './sim-state.ts';
import { VEHICLE_TOP_SPEED } from './vehicle-physics.ts';
import { makeNoise } from './zombie-senses.ts';

/** Seconds between one blast of the horn and the next. */
export const HORN_COOLDOWN_SEC = 0.8;
/** How far a horn carries, in world pixels: the whole block and then some, farther than any gun or engine, so a honk is a dinner bell. */
export const HORN_NOISE_RADIUS = 1200;
/** A car faster than this px/s is loud. */
export const ENGINE_NOISE_MIN_SPEED = 20;
/** Seconds between engine noises while a car rolls: a steady roar, not a ping. */
export const ENGINE_NOISE_INTERVAL_SEC = 0.5;
/** How far a car just over the loud speed carries, in world pixels: more than a shotgun blast (420). */
export const ENGINE_NOISE_RADIUS = 460;
/** How far a car at top speed carries, in world pixels. */
export const ENGINE_NOISE_MAX_RADIUS = 780;
/** An engine running under a driver at a stop: heard close by, less than a pistol shot (260). */
export const ENGINE_IDLE_RADIUS = 140;
/** Seconds between idle engine noises. */
export const ENGINE_IDLE_INTERVAL_SEC = 1.5;

const hornWasHeld = new WeakSet<PlayerState>();

/** The driver's press of the horn key: one blast and one noise, then the cooldown. Holding does not repeat. */
export function honk(sim: SimState, car: VehicleState, driver: PlayerState): void {
  const isEdge = driver.horn && !hornWasHeld.has(driver);
  if (driver.horn) hornWasHeld.add(driver);
  else hornWasHeld.delete(driver);
  const isReady = car.hornLeft <= 0;
  if (!isEdge || !isReady) return;
  car.hornLeft = HORN_COOLDOWN_SEC;
  emit(sim, { type: 'vehicle_horn', vehicle: car.id, x: car.x, y: car.y });
  makeNoise(sim, car.x, car.y, HORN_NOISE_RADIUS);
}

/** How far a rolling car is heard: the faster it goes, the farther. */
export function engineRadius(speed: number): number {
  const pace = Math.min(1, Math.abs(speed) / VEHICLE_TOP_SPEED);
  return ENGINE_NOISE_RADIUS + (ENGINE_NOISE_MAX_RADIUS - ENGINE_NOISE_RADIUS) * pace;
}

/** Once a tick for every car: the horn's cooldown runs down, a rolling car roars, and an engine under a driver idles. */
export function carSounds(sim: SimState, car: VehicleState): void {
  car.hornLeft = Math.max(0, car.hornLeft - TICK_DT);
  const isRolling = Math.abs(car.speed) > ENGINE_NOISE_MIN_SPEED;
  const isBeat = sim.tick % Math.round(ENGINE_NOISE_INTERVAL_SEC * TICK_RATE) === 0;
  if (isRolling && isBeat) {
    makeNoise(sim, car.x, car.y, engineRadius(car.speed));
    return;
  }
  const isIdling = !isRolling && car.seats[0] !== null;
  const isIdleBeat = sim.tick % Math.round(ENGINE_IDLE_INTERVAL_SEC * TICK_RATE) === 0;
  if (isIdling && isIdleBeat) makeNoise(sim, car.x, car.y, ENGINE_IDLE_RADIUS);
}
