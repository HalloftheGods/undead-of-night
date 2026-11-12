// What this client believes about cars: the sim's list kept in step with the map's solids, other
// people's cars blended between snapshots, and the one the local player drives, predicted.

import { TICK_DT } from '../../shared/constants.ts';
import { viewsBlockCircle } from '../../shared/doors.ts';
import type { DoorView, PlayerEntity, SnapshotPacket, VehicleView, WorldMap } from '../../shared/protocol.ts';
import { groundSpeedScale } from '../../shared/town-rules.ts';
import { isResting, restBoxOf } from '../../shared/vehicle-choice.ts';
import { carBlockedAt } from '../../shared/vehicle-footprint.ts';
import { capsuleBlocked, stepVehicle } from '../../shared/vehicle-physics.ts';
import type { Blocked, VehicleMotion } from '../../shared/vehicle-physics.ts';
import { liftProp, restoreSolids, setSolid } from '../../shared/world-query.ts';
import { lerp, lerpAngle } from './snapshot-buffer.ts';
import type { SnapshotSample } from './snapshot-buffer.ts';
import { VehiclePredictor } from './vehicle-predictor.ts';

/** Further than this in one step is a car that was moved, not driven. */
const TELEPORT_PX = 96;

/** What the car-keeping needs from the world around it. */
export interface CarHost {
  map(): WorldMap;
  doors(): readonly DoorView[];
  level(): number;
}

const solidKey = (id: number): string => `vehicle:${id}`;

/** The car as it was a moment ago and as it is now, blended; a car that jumped is simply where it is now. */
export function blendVehicle(from: VehicleView | undefined, to: VehicleView, alpha: number): VehicleView {
  const isTeleport = !from || Math.hypot(to.x - from.x, to.y - from.y) > TELEPORT_PX;
  if (isTeleport) return to;
  return { ...to, x: lerp(from.x, to.x, alpha), y: lerp(from.y, to.y, alpha), heading: lerpAngle(from.heading, to.heading, alpha), speed: lerp(from.speed, to.speed, alpha) };
}

/** The sim's cars at interpolated places, the way zombies are. */
export function interpolateVehicles({ from, to, alpha }: SnapshotSample): VehicleView[] {
  const before = new Map((from.snapshot.vehicles ?? []).map((car) => [car.id, car]));
  return (to.snapshot.vehicles ?? []).map((car) => blendVehicle(before.get(car.id), car, alpha));
}

/** The cars a client draws and collides with. */
export class ClientVehicles {
  private readonly host: CarHost;
  private newest: readonly VehicleView[] = [];
  /** The car the local player is predicting, by id. */
  private driven: number | null = null;
  private body: VehicleView['body'] = 'sedan';
  private readonly predictor: VehiclePredictor;

  constructor(host: CarHost) {
    this.host = host;
    this.predictor = new VehiclePredictor(
      (motion, dirX, dirY, dt) => this.stepCar(motion, dirX, dirY, dt),
      TICK_DT,
      (motion) => capsuleBlocked(this.body, motion.x, motion.y, motion.heading, this.roadBlocked),
    );
  }

  /** The id of the car being driven here, or null. */
  get drivenId(): number | null {
    return this.driven;
  }

  /** The cars as the newest snapshot lists them. */
  get views(): readonly VehicleView[] {
    return this.newest;
  }

  /** Same rule as the sim's roadBlocked: the shared carBlockedAt, with the doors this client has been told of. */
  private readonly roadBlocked: Blocked = (x, y, r) =>
    carBlockedAt(this.host.map(), x, y, r, (dx, dy, dr) => viewsBlockCircle(this.host.map(), this.host.doors(), dx, dy, dr));

  private stepCar(motion: VehicleMotion, dirX: number, dirY: number, dt: number): VehicleMotion {
    const pace = groundSpeedScale(this.host.level(), this.host.map(), motion.x, motion.y);
    const { x, y, heading, speed, facing } = stepVehicle(motion, this.body, dirX, dirY, dt, this.roadBlocked, pace);
    return { x, y, heading, speed, facing };
  }

  /** The solid under the driven car follows the predicted pose: gone while it rolls, its resting box once stopped. */
  private settle(): void {
    if (this.driven === null) return;
    const m = this.predictor.motion;
    const car: VehicleView = { id: this.driven, body: this.body, seats: [], ...m };
    setSolid(this.host.map(), solidKey(this.driven), isResting(m) ? restBoxOf(car) : null);
  }

  /** Runs `work` with the driven car's own solid out of the way, as it is in the sim while the car moves. */
  private withCarClear(work: () => void): void {
    if (this.driven === null) return;
    setSolid(this.host.map(), solidKey(this.driven), null);
    try {
      work();
    } finally {
      this.settle();
    }
  }

  /** A new snapshot: every listed car leaves its parking spot, and rests as a solid or rolls as none; then the driven car is reconciled. */
  sync(snapshot: SnapshotPacket, local: PlayerEntity | null): void {
    const map = this.host.map();
    const views = snapshot.vehicles ?? [];
    const emptied = views.length === 0 && this.newest.length > 0;
    if (emptied) restoreSolids(map);
    this.newest = views;
    for (const car of views) {
      liftProp(map, car.id);
      if (car.id !== this.driven) setSolid(map, solidKey(car.id), isResting(car) ? restBoxOf(car) : null);
    }
    const car = views.find((candidate) => candidate.id === this.driven);
    const isDriving = car !== undefined && local?.vehicle?.id === this.driven;
    if (isDriving) this.withCarClear(() => this.predictor.reconcile(car, local.lastInputSeq));
  }

  /** The map goes back as built, for a run that starts over on the same one. */
  reset(): void {
    restoreSolids(this.host.map());
    this.newest = [];
    this.driven = null;
  }

  /** The sim has been sent this input. */
  record(seq: number, dirX: number, dirY: number): void {
    this.predictor.record(seq, dirX, dirY);
  }

  /** Which car the local player should be predicted in right now, if any. */
  private seatedCar(local: PlayerEntity | null, running: boolean): VehicleView | null {
    const atTheWheel = local !== null && local.status === 'alive' && running && local.vehicle?.seat === 0;
    return atTheWheel ? (this.newest.find((car) => car.id === local.vehicle?.id) ?? null) : null;
  }

  /** Hands the car back to the sim's word once the local player is out of the driver's seat. */
  private release(): void {
    const id = this.driven;
    this.driven = null;
    const car = this.newest.find((candidate) => candidate.id === id);
    if (car) setSolid(this.host.map(), solidKey(car.id), isResting(car) ? restBoxOf(car) : null);
  }

  /** One frame of the local driver's car, ahead of the sim. Returns where it is, or null when nobody local drives. */
  drive(local: PlayerEntity | null, dirX: number, dirY: number, dt: number, running: boolean): VehicleMotion | null {
    const car = this.seatedCar(local, running);
    const changed = (car?.id ?? null) !== this.driven;
    if (changed && this.driven !== null) this.release();
    if (!car) return null;
    if (changed) {
      this.driven = car.id;
      this.body = car.body;
      this.predictor.reset(car);
    }
    this.withCarClear(() => this.predictor.advance(dirX, dirY, dt));
    return this.predictor.motion;
  }

  /** This frame's cars to draw: the buffered ones blended, the driven one where prediction has it. */
  shown(sample: SnapshotSample): VehicleView[] {
    const blended = interpolateVehicles(sample);
    if (this.driven === null) return blended;
    const m = this.predictor.motion;
    return blended.map((car) => (car.id === this.driven ? { ...car, ...m } : car));
  }
}
