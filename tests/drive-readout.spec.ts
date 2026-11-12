import { beforeEach, describe, expect, it } from 'vitest';
import type { SnapshotPacket, VehicleView } from '../shared/protocol.ts';
import { driveReadout, formatSpeed, noteDriveSnapshot, readoutOf } from '../src/game/drive-readout.ts';

const car: VehicleView = { id: 7, body: 'sedan', x: 10, y: 10, heading: Math.PI / 2, speed: 123.4, facing: 's', seats: ['a'] };
const frame = (events: SnapshotPacket['events'], vehicles: readonly VehicleView[] = [car]): Pick<SnapshotPacket, 'events' | 'vehicles'> => ({ events, vehicles });

describe('the test drive readout', () => {
  beforeEach(() => noteDriveSnapshot(frame([]), null));

  it('says speed, heading in degrees, facing and body of the car the player sits in', () => {
    expect(readoutOf(car, null)).toEqual({ speed: 123, heading: 90, facing: 's', body: 'sedan', crash: null });
    expect(readoutOf({ ...car, heading: -Math.PI / 2 }, 0.5)).toMatchObject({ heading: 270, crash: 0.5 });
  });

  it('keeps the strength of the last crash while seated, and forgets it on getting out', () => {
    noteDriveSnapshot(frame([{ type: 'vehicle_crash', vehicle: 7, x: 0, y: 0, strength: 0.4 }]), 7);
    expect(driveReadout.value?.crash).toBe(0.4);
    noteDriveSnapshot(frame([]), 7);
    expect(driveReadout.value?.crash).toBe(0.4);
    noteDriveSnapshot(frame([]), null);
    expect(driveReadout.value).toBeNull();
    noteDriveSnapshot(frame([]), 7);
    expect(driveReadout.value?.crash).toBeNull();
  });

  it('ignores another car\'s crash', () => {
    noteDriveSnapshot(frame([{ type: 'vehicle_crash', vehicle: 9, x: 0, y: 0, strength: 0.9 }]), 7);
    expect(driveReadout.value?.crash).toBeNull();
  });

  it('formats speed in mph, km/h, and px/s', () => {
    expect(formatSpeed(220, 'mph')).toBe('31 mph');
    expect(formatSpeed(220, 'kmh')).toBe('50 km/h');
    expect(formatSpeed(220, 'pxs')).toBe('220 px/s');
    expect(formatSpeed(-70, 'mph')).toBe('-10 mph');
    expect(formatSpeed(0, 'mph')).toBe('0 mph');
  });
});
