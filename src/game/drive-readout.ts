// What the Test Drive readout says while the local player is seated: the car's speed, heading, facing and body,
// and how hard the last crash was. Fed one snapshot at a time; plain numbers and words, nothing drawn here.

import { shallowRef } from 'vue';
import type { SnapshotPacket, VehicleView } from '../../shared/protocol.ts';

export interface DriveReadout {
  /** px/s, signed: negative is reversing. */
  readonly speed: number;
  /** Degrees clockwise from east, 0 up to 359. */
  readonly heading: number;
  readonly facing: string;
  readonly body: string;
  /** Strength of the last crash this seat has had, as a fraction of top speed, or null for none yet. */
  readonly crash: number | null;
}

export const driveReadout = shallowRef<DriveReadout | null>(null);
let lastCrash: number | null = null;

export function readoutOf(car: VehicleView, crash: number | null): DriveReadout {
  const degrees = Math.round((car.heading * 180) / Math.PI);
  return { speed: Math.round(car.speed), heading: ((degrees % 360) + 360) % 360, facing: car.facing, body: car.body, crash };
}

const same = (a: DriveReadout | null, b: DriveReadout | null): boolean =>
  a === b || (a !== null && b !== null && a.speed === b.speed && a.heading === b.heading && a.facing === b.facing && a.body === b.body && a.crash === b.crash);

/** `seatedIn` is the id of the car the local player sits in, or null when on foot. Call for every snapshot, so no crash slips between frames. */
export function noteDriveSnapshot(snapshot: Pick<SnapshotPacket, 'events' | 'vehicles'>, seatedIn: number | null): void {
  const car = seatedIn === null ? undefined : snapshot.vehicles?.find((candidate) => candidate.id === seatedIn);
  if (seatedIn === null || car === undefined) {
    lastCrash = null;
    if (driveReadout.value !== null) driveReadout.value = null;
    return;
  }
  for (const event of snapshot.events) {
    if (event.type === 'vehicle_crash' && event.vehicle === seatedIn) lastCrash = event.strength;
  }
  const next = readoutOf(car, lastCrash);
  if (!same(driveReadout.value, next)) driveReadout.value = next;
}
