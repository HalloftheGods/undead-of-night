// One deterministic step for a driven car. The sim runs it each tick and the client runs it to
// predict the local driver's car, so it reads no sim state, no clock and no randomness.

import { FACING_HEADING, VEHICLE_BODIES, type VehicleBody, type VehicleFacing } from './vehicle-bodies.ts';

/** Fastest a car goes forward, in px/s. */
export const VEHICLE_TOP_SPEED = 220;
/** Fastest a car backs up, in px/s. */
export const VEHICLE_REVERSE_SPEED = 70;
/** Speed gained per second under power, in px/s^2. */
export const VEHICLE_ACCEL = 300;
/** Speed shed per second when the pedal is against the way the car is rolling. */
export const VEHICLE_BRAKE = 520;
/** Speed shed per second with no input. */
export const VEHICLE_COAST = 160;
/** How fast the heading can swing at full grip, in rad/s. */
export const VEHICLE_TURN_RATE = 3.2;

/** A car steers only while it rolls: nothing at rest, the whole turn rate from this speed up, in px/s. */
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

const gripAt = (speed: number): number => clamp(Math.abs(speed) / GRIP_FULL_SPEED, 0, 1);

const approachZero = (speed: number, amount: number): number => (speed > 0 ? Math.max(0, speed - amount) : Math.min(0, speed + amount));

/** Gas: a car backing up brakes first, then it gathers speed to the cap. Over the cap (off the road, say) it eases down to it. */
function gas(speed: number, dt: number, paceScale: number): number {
  if (speed < 0) return approachZero(speed, VEHICLE_BRAKE * dt);
  const cap = VEHICLE_TOP_SPEED * paceScale;
  const isOverCap = speed > cap;
  return isOverCap ? Math.max(cap, speed - VEHICLE_COAST * dt) : Math.min(cap, speed + VEHICLE_ACCEL * dt);
}

/** The other pedal: a car rolling forward brakes, and once stopped it backs up. */
function brakeOrReverse(speed: number, dt: number): number {
  if (speed > 0) return approachZero(speed, VEHICLE_BRAKE * dt);
  return Math.max(-VEHICLE_REVERSE_SPEED, speed - VEHICLE_ACCEL * dt);
}

function pedal(speed: number, throttle: number, dt: number, paceScale: number): number {
  if (throttle > 0) return gas(speed, dt, paceScale);
  if (throttle < 0) return brakeOrReverse(speed, dt);
  return approachZero(speed, VEHICLE_COAST * dt);
}

/**
 * The speed and heading the driver asks for this tick, before anything is in the way. The stick is read
 * from the driver's seat: up is gas, down is the brake and then reverse, left and right turn the wheel.
 * The wheel only bites while the car rolls, and backing up it swings the nose the other way.
 */
function drive(motion: VehicleMotion, dirX: number, dirY: number, dt: number, paceScale: number): { speed: number; heading: number } {
  const speed = pedal(motion.speed, -Math.sign(dirY), dt, paceScale);
  const wheel = clamp(dirX, -1, 1);
  const turn = wheel * Math.sign(speed) * VEHICLE_TURN_RATE * gripAt(speed) * dt;
  return { speed, heading: motion.heading + turn };
}

/**
 * Advances a car one tick. dirX is the wheel (right is positive) and dirY the pedals (up, negative, is gas),
 * both from the driver's seat rather than the screen. Slides along walls one axis at a time like walking does.
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
