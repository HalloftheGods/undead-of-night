// A seated driver's headlights: highbeam dual beams cast from the left and right front lenses.

import type { VehicleView } from '../../shared/protocol.ts';
import { VEHICLE_BODIES } from '../../shared/vehicle-bodies.ts';
import { HIGHBEAM_COLOR, type Lighting } from './lighting.ts';
import type { OcclusionGrid } from './occlusion.ts';

/** Highbeam headlights throw further than a survivor's torch. */
export const HEADLIGHT_REACH_SCALE = 1.6;
const HEADLIGHT_STRENGTH = 0.95;

export interface HeadlightLens {
  readonly x: number;
  readonly y: number;
}

/** Left and right headlight positions on the car's nose, aligned with physical light lenses. */
export function lensesOf(car: Pick<VehicleView, 'body' | 'x' | 'y' | 'heading'>): readonly [left: HeadlightLens, right: HeadlightLens] {
  const def = VEHICLE_BODIES[car.body];
  const halfLength = def.length / 2;
  const lateralOffset = Math.max(4, def.noseWidth / 2 - 3.5);

  const forwardX = Math.cos(car.heading);
  const forwardY = Math.sin(car.heading);
  const lateralX = -forwardY;
  const lateralY = forwardX;

  const noseX = car.x + forwardX * halfLength;
  const noseY = car.y + forwardY * halfLength;

  return [
    { x: noseX - lateralX * lateralOffset, y: noseY - lateralY * lateralOffset },
    { x: noseX + lateralX * lateralOffset, y: noseY + lateralY * lateralOffset },
  ];
}

/** Legacy single-nose point for backwards compatibility. */
export function noseOf(car: Pick<VehicleView, 'body' | 'x' | 'y' | 'heading'>): { readonly x: number; readonly y: number } {
  const half = VEHICLE_BODIES[car.body].length / 2;
  return { x: car.x + Math.cos(car.heading) * half, y: car.y + Math.sin(car.heading) * half };
}

/** Dual highbeam beams cast from the left and right lenses of any driven car. */
export function addVehicleHeadlights(lighting: Lighting, grid: OcclusionGrid | null, cars: readonly VehicleView[], torchReach: number, left: number, top: number): void {
  const reach = torchReach * HEADLIGHT_REACH_SCALE;
  for (const car of cars) {
    const hasDriver = car.seats[0] !== null && car.seats[0] !== undefined;
    if (!hasDriver) {
      continue;
    }
    const [leftLens, rightLens] = lensesOf(car);
    lighting.addFlashlight(grid, leftLens.x, leftLens.y, car.heading, reach, HEADLIGHT_STRENGTH, left, top, HIGHBEAM_COLOR);
    lighting.addFlashlight(grid, rightLens.x, rightLens.y, car.heading, reach, HEADLIGHT_STRENGTH, left, top, HIGHBEAM_COLOR);
  }
}
