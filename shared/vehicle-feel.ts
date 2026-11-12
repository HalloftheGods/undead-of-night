// What a car sounds like to the town: the driver's horn and the engine that draws zombies.

import { TICK_DT, TICK_RATE } from './constants.ts';
import type { PlayerState, SimState, VehicleState } from './sim-state.ts';
import { emit } from './sim-state.ts';
import { makeNoise } from './zombie-senses.ts';

/** Seconds between one blast of the horn and the next. */
export const HORN_COOLDOWN_SEC = 0.8;
/** How far a horn carries, in world pixels. */
export const HORN_NOISE_RADIUS = 420;
/** A car faster than this px/s is loud. */
export const ENGINE_NOISE_MIN_SPEED = 60;
/** Seconds between engine noises while a car is loud. */
export const ENGINE_NOISE_INTERVAL_SEC = 1.5;
/** How far the engine carries, in world pixels. */
export const ENGINE_NOISE_RADIUS = 220;

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

/** Once a tick for every car: the horn's cooldown runs down, and a moving car makes a noise every interval. */
export function carSounds(sim: SimState, car: VehicleState): void {
  car.hornLeft = Math.max(0, car.hornLeft - TICK_DT);
  const isLoud = Math.abs(car.speed) > ENGINE_NOISE_MIN_SPEED;
  const isBeat = sim.tick % Math.round(ENGINE_NOISE_INTERVAL_SEC * TICK_RATE) === 0;
  if (isLoud && isBeat) makeNoise(sim, car.x, car.y, ENGINE_NOISE_RADIUS);
}
