import { describe, expect, it } from 'vitest';
import type { VehicleView } from '../shared/protocol.ts';
import { VEHICLE_BODIES } from '../shared/vehicle-bodies.ts';
import { HEADLIGHT_REACH_SCALE, lensesOf, noseOf } from '../src/engine/vehicle-lights.ts';

describe('vehicle headlights and lens positioning', () => {
  const car: VehicleView = {
    id: 1,
    body: 'sedan',
    x: 100,
    y: 100,
    heading: 0,
    speed: 0,
    facing: 'e',
    seats: ['survivor-1'],
  };

  it('calculates nose position along heading', () => {
    const def = VEHICLE_BODIES[car.body];
    const expectedNoseX = car.x + def.length / 2;
    const nose = noseOf(car);
    expect(nose.x).toBeCloseTo(expectedNoseX);
    expect(nose.y).toBeCloseTo(car.y);
  });

  it('calculates dual left and right lens offsets symmetrically from the nose', () => {
    const [leftLens, rightLens] = lensesOf(car);
    const def = VEHICLE_BODIES[car.body];
    const halfLength = def.length / 2;
    const lateralOffset = Math.max(4, def.noseWidth / 2 - 3.5);

    // Facing east (heading 0): forward is +x, lateral is +y (right) / -y (left)
    expect(leftLens.x).toBeCloseTo(car.x + halfLength);
    expect(leftLens.y).toBeCloseTo(car.y - lateralOffset);

    expect(rightLens.x).toBeCloseTo(car.x + halfLength);
    expect(rightLens.y).toBeCloseTo(car.y + lateralOffset);
  });

  it('maintains reach scale greater than 1.5 for highbeams', () => {
    expect(HEADLIGHT_REACH_SCALE).toBeGreaterThan(1.5);
  });
});
