// Moves the car the local player drives every frame, ahead of the sim, and pulls it back to the sim's
// word the way LocalPredictor does for walking, over the car's whole motion: place, heading and speed.

import { facingOf } from '../../shared/vehicle-physics.ts';
import type { VehicleMotion } from '../../shared/vehicle-physics.ts';

/** One step of the car: the shared stepVehicle with this client's map around it. */
export type CarStep = (motion: VehicleMotion, dirX: number, dirY: number, dt: number) => VehicleMotion;

/** Whether the car would be inside something at this pose. */
export type CarBlocked = (motion: VehicleMotion) => boolean;

const SNAP_DISTANCE = 48;
const CORRECTION_RATE = 10;
/** Smaller errors are rounding between frame steps and sim ticks, not mistakes. */
const DEAD_ZONE = 0.75;
const HEADING_DEAD_ZONE = 0.02;
const SPEED_DEAD_ZONE = 3;
const SNAP_HEADING = 1;
const MAX_PENDING = 90;

interface PendingInput {
  readonly seq: number;
  readonly dirX: number;
  readonly dirY: number;
}

interface Correction {
  x: number;
  y: number;
  heading: number;
  speed: number;
}

const NO_CORRECTION = (): Correction => ({ x: 0, y: 0, heading: 0, speed: 0 });

/** Just the motion fields, so a snapshot's whole view can be passed in. */
const poseOf = ({ x, y, heading, speed, facing }: VehicleMotion): VehicleMotion => ({ x, y, heading, speed, facing });

const wrap = (a: number): number => a - Math.round(a / (2 * Math.PI)) * 2 * Math.PI;

/** Runs the shared car step each frame and replays unacknowledged inputs on every snapshot. */
export class VehiclePredictor {
  /** Where the car is shown now. */
  motion: VehicleMotion = { x: 0, y: 0, heading: 0, speed: 0, facing: 'e' };
  private readonly step: CarStep;
  private readonly tickDt: number;
  private readonly isBlocked: CarBlocked;
  private pending: PendingInput[] = [];
  private correction: Correction = NO_CORRECTION();
  private fixRefused = false;
  /** Time moved since the newest recorded input, which replay must also cover. */
  private partialDt = 0;
  private dirX = 0;
  private dirY = 0;

  constructor(step: CarStep, tickDt: number, isBlocked: CarBlocked) {
    this.step = step;
    this.tickDt = tickDt;
    this.isBlocked = isBlocked;
  }

  /** Start from the sim's word with nothing pending. */
  reset(motion: VehicleMotion): void {
    this.motion = poseOf(motion);
    this.pending = [];
    this.correction = NO_CORRECTION();
    this.fixRefused = false;
    this.partialDt = 0;
  }

  /** Remember an input the sim has been sent, to replay until it is acknowledged. */
  record(seq: number, dirX: number, dirY: number): void {
    this.pending.push({ seq, dirX, dirY });
    if (this.pending.length > MAX_PENDING) this.pending.shift();
    this.partialDt = 0;
  }

  /** One frame of driving, with this frame's share of any correction drained in. */
  advance(dirX: number, dirY: number, dt: number): void {
    this.dirX = dirX;
    this.dirY = dirY;
    this.partialDt += dt;
    const moved = this.step(this.motion, dirX, dirY, dt);
    const blend = 1 - Math.exp(-CORRECTION_RATE * dt);
    const fix = this.correction;
    const part: Correction = { x: fix.x * blend, y: fix.y * blend, heading: fix.heading * blend, speed: fix.speed * blend };
    fix.x -= part.x;
    fix.y -= part.y;
    fix.heading -= part.heading;
    fix.speed -= part.speed;
    const heading = moved.heading + part.heading;
    const fixed: VehicleMotion = { x: moved.x + part.x, y: moved.y + part.y, heading, speed: moved.speed + part.speed, facing: facingOf(heading, moved.facing) };
    const refused = this.isBlocked(fixed);
    this.fixRefused ||= refused;
    this.motion = refused ? moved : fixed;
  }

  /** The sim's car as of the input it last acknowledged: replay what it has not heard yet and drift toward the result. */
  reconcile(server: VehicleMotion, ackedSeq: number): void {
    this.pending = this.pending.filter((input) => input.seq > ackedSeq);
    let replay = poseOf(server);
    for (const input of this.pending) replay = this.step(replay, input.dirX, input.dirY, this.tickDt);
    if (this.partialDt > 0) replay = this.step(replay, this.dirX, this.dirY, this.partialDt);

    const error: Correction = {
      x: replay.x - this.motion.x,
      y: replay.y - this.motion.y,
      heading: wrap(replay.heading - this.motion.heading),
      speed: replay.speed - this.motion.speed,
    };
    const distance = Math.hypot(error.x, error.y);
    const isDrifting = distance > DEAD_ZONE || Math.abs(error.heading) > HEADING_DEAD_ZONE || Math.abs(error.speed) > SPEED_DEAD_ZONE;
    const blockedOff = this.fixRefused && isDrifting;
    const mustSnap = distance > SNAP_DISTANCE || Math.abs(error.heading) > SNAP_HEADING || blockedOff || this.isBlocked(this.motion);
    this.fixRefused = false;
    if (mustSnap) {
      this.motion = replay;
      this.correction = NO_CORRECTION();
    } else if (isDrifting) {
      this.correction = error;
    } else {
      this.correction = NO_CORRECTION();
    }
  }
}
