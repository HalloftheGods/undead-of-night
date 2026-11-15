import { describe, expect, it } from 'vitest';
import { NORTH_WALL_DEPTH } from '../shared/protocol.ts';
import { BACK_DOOR_HEIGHT, DoorLayer } from '../src/engine/door-layer.ts';

describe('back door art', () => {
  it('stands taller than the wall it is in, as the lockers beside it do', () => {
    expect(BACK_DOOR_HEIGHT).toBeGreaterThan(NORTH_WALL_DEPTH);
    expect(BACK_DOOR_HEIGHT).toBeLessThanOrEqual(30);
  });

  it('is drawn from the foot of the north wall, which is where collision ends', () => {
    const layer = new DoorLayer(NORTH_WALL_DEPTH - 6);
    expect(layer.backFoot({ y: 160 })).toBe(160 + NORTH_WALL_DEPTH);
  });

  it('knows a building has a shut or broken back door, and that an open one is not listed', () => {
    const layer = new DoorLayer(NORTH_WALL_DEPTH - 6);
    layer.set([{ buildingId: 'b1', x: 0, y: 160, facing: 'north', broken: false, planks: 0, worn: false }]);
    expect(layer.hasBackDoor('b1')).toBe(true);
    expect(layer.hasBackDoor('b2')).toBe(false);
  });
});
