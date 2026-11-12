// A seated driver's headlights: the flashlight's beam, from the car's nose along its heading, reaching further.

import type { VehicleView } from '../../shared/protocol.ts';
import { VEHICLE_BODIES } from '../../shared/vehicle-bodies.ts';
import type { Lighting } from './lighting.ts';
import type { OcclusionGrid } from './occlusion.ts';

/** Headlights throw this much further than a survivor's torch. */
export const HEADLIGHT_REACH_SCALE = 1.4;
const HEADLIGHT_STRENGTH = 1;

/** Where a car's nose is on the ground. */
export function noseOf(car: Pick<VehicleView, 'body' | 'x' | 'y' | 'heading'>): { readonly x: number; readonly y: number } {
  const half = VEHICLE_BODIES[car.body].length / 2;
  return { x: car.x + Math.cos(car.heading) * half, y: car.y + Math.sin(car.heading) * half };
}

/** One beam per car with somebody at the wheel. Riders carry no torch of their own. */
export function addVehicleHeadlights(lighting: Lighting, grid: OcclusionGrid | null, cars: readonly VehicleView[], torchReach: number, left: number, top: number): void {
  for (const car of cars) {
    const hasDriver = car.seats[0] !== null && car.seats[0] !== undefined;
    if (!hasDriver) continue;
    const nose = noseOf(car);
    lighting.addFlashlight(grid, nose.x, nose.y, car.heading, torchReach * HEADLIGHT_REACH_SCALE, HEADLIGHT_STRENGTH, left, top);
  }
}
