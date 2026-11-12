// One deterministic step for a driven car. The sim runs it each tick and the client runs it to
// predict the local driver's car, so it reads no sim state, no clock and no randomness.

import { FACING_HEADING, VEHICLE_BODIES, VEHICLE_FACINGS, type VehicleBody, type VehicleFacing } from './vehicle-bodies.ts';

/** Fastest a car goes forward, in px/s. */
export const VEHICLE_TOP_SPEED = 220;
/** Fastest a car backs up, in px/s. */
export const VEHICLE_REVERSE_SPEED = 70;
/** Speed gained per second under power, in px/s^2. */
export const VEHICLE_ACCEL = 300;
/** Speed shed per second when the stick points against the way the car is going. */
export const VEHICLE_BRAKE = 520;
/** Speed shed per second with no input. */
export const VEHICLE_COAST = 160;
/** How fast the heading can swing at full grip, in rad/s. */
export const VEHICLE_TURN_RATE = 3.2;
/** How far off the nose the stick can point (about 120 degrees) before the car brakes and backs up instead. */
export const REVERSE_CONE = (2 * Math.PI) / 3;

/** Grip a parked car has, so it can pull out; it rises to 1 by GRIP_FULL_SPEED. */
const GRIP_AT_REST = 0.35;
const GRIP_FULL_SPEED = 60;
/** Same sub-step size as walking, so stopping distance barely depends on the frame rate. */
const MAX_SUBSTEP = 1;
/** Past the diagonal a facing must be overshot by this much before it changes. */
const FACING_HYSTERESIS = (10 * Math.PI) / 180;
const QUARTER_TURN = Math.PI / 2;

export interface VehicleMotion {
  /** Centre of the footprint. */
  x: number;
  y: number;
  /** Radians on screen axes: east 0, south a quarter turn clockwise. */
  heading: number;
  /** Signed: positive along the heading, negative when reversing. */
  speed: number;
  facing: VehicleFacing;
}

export interface VehicleStep extends VehicleMotion {
  /** px/s of speed lost against a solid this step, 0 when nothing was hit. */
  readonly crash: number;
}

/** The caller's map solids, doors and bounds: true when a circle here would be inside something. */
export type Blocked = (x: number, y: number, r: number) => boolean;

const wrapAngle = (a: number): number => {
  const turns = Math.round(a / (2 * Math.PI));
  return a - turns * 2 * Math.PI;
};

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** The cardinal a heading points nearest to, holding the previous one until the heading is well past the diagonal so art never flickers. */
export function facingOf(heading: number, previous: VehicleFacing): VehicleFacing {
  const offPrevious = Math.abs(wrapAngle(heading - FACING_HEADING[previous]));
  const holdsPrevious = offPrevious <= QUARTER_TURN / 2 + FACING_HYSTERESIS;
  if (holdsPrevious) return previous;
  const quarter = Math.round(wrapAngle(heading) / QUARTER_TURN);
  const order: readonly VehicleFacing[] = ['e', 's', 'w', 'n'];
  return order[((quarter % 4) + 4) % 4] ?? previous;
}

/** The two circles a moving car collides as, one at each end of its body. */
export function capsuleCentres(body: VehicleBody, x: number, y: number, heading: number): readonly [{ x: number; y: number }, { x: number; y: number }] {
  const def = VEHICLE_BODIES[body];
  const reach = def.length / 2 - def.radius;
  const dx = Math.cos(heading) * reach;
  const dy = Math.sin(heading) * reach;
  return [
    { x: x + dx, y: y + dy },
    { x: x - dx, y: y - dy },
  ];
}

/** Whether either end of the car would be inside a solid at this pose. */
export function capsuleBlocked(body: VehicleBody, x: number, y: number, heading: number, isBlocked: Blocked): boolean {
  const radius = VEHICLE_BODIES[body].radius;
  const [front, back] = capsuleCentres(body, x, y, heading);
  return isBlocked(front.x, front.y, radius) || isBlocked(back.x, back.y, radius);
}

const gripAt = (speed: number): number => clamp(GRIP_AT_REST + ((1 - GRIP_AT_REST) * Math.abs(speed)) / GRIP_FULL_SPEED, GRIP_AT_REST, 1);

const approachZero = (speed: number, amount: number): number => (speed > 0 ? Math.max(0, speed - amount) : Math.min(0, speed + amount));

/** The speed and heading the stick asks for this tick, before anything is in the way. */
function drive(motion: VehicleMotion, dirX: number, dirY: number, dt: number, paceScale: number): { speed: number; heading: number } {
  const hasInput = Math.hypot(dirX, dirY) > 1e-9;
  if (!hasInput) return { speed: approachZero(motion.speed, VEHICLE_COAST * dt), heading: motion.heading };

  const diff = wrapAngle(Math.atan2(dirY, dirX) - motion.heading);
  const wantsForward = Math.abs(diff) <= REVERSE_CONE;
  const isReversing = motion.speed < 0;
  const isMovingForward = motion.speed > 0;

  if (wantsForward) {
    if (isReversing) return { speed: approachZero(motion.speed, VEHICLE_BRAKE * dt), heading: motion.heading };
    const cap = VEHICLE_TOP_SPEED * paceScale;
    const isOverCap = motion.speed > cap;
    const speed = isOverCap ? Math.max(cap, motion.speed - VEHICLE_COAST * dt) : Math.min(cap, motion.speed + VEHICLE_ACCEL * dt);
    const maxTurn = VEHICLE_TURN_RATE * gripAt(speed) * dt;
    return { speed, heading: motion.heading + clamp(diff, -maxTurn, maxTurn) };
  }

  if (isMovingForward) return { speed: approachZero(motion.speed, VEHICLE_BRAKE * dt), heading: motion.heading };
  const speed = Math.max(-VEHICLE_REVERSE_SPEED, motion.speed - VEHICLE_ACCEL * dt);
  const tailDiff = wrapAngle(Math.atan2(dirY, dirX) - (motion.heading + Math.PI));
  const maxTurn = VEHICLE_TURN_RATE * gripAt(speed) * dt;
  return { speed, heading: motion.heading + clamp(tailDiff, -maxTurn, maxTurn) };
}

/**
 * Advances a car one tick. The stick says where to go, not gas and steer: the car turns toward it,
 * or brakes and backs out when it points behind. Slides along walls one axis at a time like walking does.
 */
export function stepVehicle(
  motion: VehicleMotion,
  body: VehicleBody,
  dirX: number,
  dirY: number,
  dt: number,
  isBlocked: Blocked,
  paceScale = 1,
): VehicleStep {
  const wanted = drive(motion, dirX, dirY, dt, paceScale);
  const turned = wanted.heading !== motion.heading;
  const canTurn = turned && !capsuleBlocked(body, motion.x, motion.y, wanted.heading, isBlocked);
  const heading = canTurn ? wrapAngle(wanted.heading) : motion.heading;

  const intended = Math.abs(wanted.speed) * dt;
  const isStill = !(intended > 0);
  if (isStill) return { x: motion.x, y: motion.y, heading, speed: wanted.speed, facing: facingOf(heading, motion.facing), crash: 0 };

  const steps = Math.ceil(intended / MAX_SUBSTEP);
  const along = Math.sign(wanted.speed) * (intended / steps);
  const stepX = Math.cos(heading) * along;
  const stepY = Math.sin(heading) * along;
  let x = motion.x;
  let y = motion.y;
  let moved = 0;

  for (let i = 0; i < steps; i++) {
    const isFullClear = !capsuleBlocked(body, x + stepX, y + stepY, heading, isBlocked);
    const isXClear = !isFullClear && stepX !== 0 && !capsuleBlocked(body, x + stepX, y, heading, isBlocked);
    const isYClear = !isFullClear && !isXClear && stepY !== 0 && !capsuleBlocked(body, x, y + stepY, heading, isBlocked);
    const nx = isFullClear || isXClear ? x + stepX : x;
    const ny = isFullClear || isYClear ? y + stepY : y;
    moved += Math.hypot(nx - x, ny - y);
    x = nx;
    y = ny;
  }

  const kept = Math.min(1, moved / intended);
  const speed = wanted.speed * kept;
  const crash = Math.abs(wanted.speed) - Math.abs(speed);
  return { x, y, heading, speed, facing: facingOf(heading, motion.facing), crash: crash > 1e-9 ? crash : 0 };
}
