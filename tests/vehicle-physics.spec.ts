import { describe, expect, it } from 'vitest';
import { FACING_HEADING, VEHICLE_BODIES } from '../shared/vehicle-bodies.ts';
import {
  VEHICLE_REVERSE_SPEED,
  VEHICLE_TOP_SPEED,
  VEHICLE_TURN_RATE,
  capsuleBlocked,
  capsuleCentres,
  facingOf,
  stepVehicle,
  type Blocked,
  type VehicleMotion,
} from '../shared/vehicle-physics.ts';

const DT = 1 / 20;
const open: Blocked = () => false;
const radiusOf = VEHICLE_BODIES.sedan.radius;
const halfSpan = VEHICLE_BODIES.sedan.length / 2;

interface Box { x0: number; y0: number; x1: number; y1: number }
const boxBlocked = (...boxes: Box[]): Blocked => (x, y, r) =>
  boxes.some((b) => {
    const nx = Math.min(b.x1, Math.max(b.x0, x));
    const ny = Math.min(b.y1, Math.max(b.y0, y));
    return Math.hypot(x - nx, y - ny) < r;
  });

const parked = (over: Partial<VehicleMotion> = {}): VehicleMotion => ({ x: 100, y: 100, heading: 0, speed: 0, facing: 'e', ...over });

function run(m: VehicleMotion, ticks: number, dx: number, dy: number, blocked: Blocked = open, pace = 1): VehicleMotion {
  let cur = m;
  for (let i = 0; i < ticks; i++) cur = stepVehicle(cur, 'sedan', dx, dy, DT, blocked, pace);
  return cur;
}

const GAS = -1;
const BRAKE = 1;
const RIGHT = 1;
const LEFT = -1;

describe('stepVehicle', () => {
  it('up is gas: reaches and caps at top speed along the nose', () => {
    const m = run(parked(), 200, 0, GAS);
    expect(m.speed).toBeCloseTo(VEHICLE_TOP_SPEED, 5);
    expect(m.speed).toBeLessThanOrEqual(VEHICLE_TOP_SPEED);
    expect(m.x).toBeGreaterThan(parked().x + 1000);
    expect(m.y).toBe(parked().y);
  });

  it('gas drives along the nose whichever way the car points on screen', () => {
    const m = run(parked({ heading: FACING_HEADING.s, facing: 's' }), 20, 0, GAS);
    expect(m.y).toBeGreaterThan(parked().y + 20);
    expect(m.x).toBeCloseTo(parked().x, 6);
  });

  it('paceScale lowers top speed', () => {
    const m = run(parked(), 200, 0, GAS, open, 0.5);
    expect(m.speed).toBeCloseTo(VEHICLE_TOP_SPEED * 0.5, 5);
  });

  it('coasts to rest and keeps its heading', () => {
    const moving = parked({ heading: 1, speed: 150 });
    const m = run(moving, 100, 0, 0);
    expect(m.speed).toBe(0);
    expect(m.heading).toBe(1);
  });

  it('right swings the nose clockwise, bounded per tick', () => {
    const m = stepVehicle(parked({ speed: 200 }), 'sedan', RIGHT, GAS, DT, open);
    expect(m.heading).toBeGreaterThan(0);
    expect(m.heading).toBeLessThanOrEqual(VEHICLE_TURN_RATE * DT + 1e-9);
  });

  it('left swings the nose anticlockwise', () => {
    const m = stepVehicle(parked({ speed: 200 }), 'sedan', LEFT, GAS, DT, open);
    expect(m.heading).toBeLessThan(0);
  });

  it('keeps turning for as long as the wheel is held, with no target to settle on', () => {
    const m = run(parked({ speed: 200 }), 10, RIGHT, GAS);
    expect(m.heading).toBeCloseTo(VEHICLE_TURN_RATE * DT * 10, 6);
  });

  it('steers by the car, not the screen: right is clockwise when heading south too', () => {
    const south = parked({ heading: FACING_HEADING.s, facing: 's', speed: 200 });
    const m = stepVehicle(south, 'sedan', RIGHT, GAS, DT, open);
    expect(m.heading).toBeGreaterThan(FACING_HEADING.s);
  });

  it('does not turn at a standstill', () => {
    const m = run(parked(), 20, RIGHT, 0);
    expect(m.heading).toBe(0);
    expect(m.speed).toBe(0);
    expect(m.x).toBe(parked().x);
  });

  it('turns slower at a crawl than at speed', () => {
    const crawl = stepVehicle(parked({ speed: 15 }), 'sedan', RIGHT, 0, DT, open);
    const quick = stepVehicle(parked({ speed: 150 }), 'sedan', RIGHT, 0, DT, open);
    expect(crawl.heading).toBeGreaterThan(0);
    expect(crawl.heading).toBeLessThan(quick.heading / 2);
  });

  it('down brakes, then reverses with the nose kept', () => {
    let m = parked({ speed: 200 });
    let reversed = false;
    for (let i = 0; i < 200; i++) {
      m = stepVehicle(m, 'sedan', 0, BRAKE, DT, open);
      if (m.speed < 0) reversed = true;
      if (!reversed) expect(m.speed).toBeGreaterThanOrEqual(0);
    }
    expect(reversed).toBe(true);
    expect(m.speed).toBeCloseTo(-VEHICLE_REVERSE_SPEED, 5);
    expect(m.x).toBeLessThan(parked().x + 200);
    expect(m.heading).toBe(0);
    expect(m.facing).toBe('e');
  });

  it('gas brakes a car that is backing up before it pulls forward', () => {
    const first = stepVehicle(parked({ speed: -60 }), 'sedan', 0, GAS, DT, open);
    expect(first.speed).toBeGreaterThan(-60);
    expect(first.speed).toBeLessThanOrEqual(0);
    expect(run(parked({ speed: -60 }), 40, 0, GAS).speed).toBeGreaterThan(0);
  });

  it('flips the steering in reverse, like a real car', () => {
    const m = run(parked({ speed: -60 }), 5, RIGHT, BRAKE);
    expect(m.heading).toBeLessThan(0);
  });

  it('stops the nose within 2px of a wall and never inside it', () => {
    const wall: Box = { x0: 300, y0: -1000, x1: 400, y1: 1000 };
    const blocked = boxBlocked(wall);
    let m = parked();
    let crashed = 0;
    for (let i = 0; i < 200; i++) {
      const s = stepVehicle(m, 'sedan', 0, GAS, DT, blocked);
      crashed = Math.max(crashed, s.crash);
      m = s;
      expect(capsuleBlocked('sedan', m.x, m.y, m.heading, blocked)).toBe(false);
    }
    const nose = m.x + halfSpan;
    expect(wall.x0 - nose).toBeGreaterThanOrEqual(-1e-6);
    expect(wall.x0 - nose).toBeLessThan(2);
    expect(m.speed).toBe(0);
    expect(crashed).toBeGreaterThan(0);
  });

  it('slides along a wall and reports only the lost share', () => {
    const wall: Box = { x0: -1000, y0: 200, x1: 1000, y1: 300 };
    const blocked = boxBlocked(wall);
    // Heading east and a little south, into a wall below.
    const start = parked({ y: 200 - radiusOf - 2, speed: 150, heading: 0.1 });
    const step = stepVehicle(start, 'sedan', 0, GAS, DT, blocked);
    expect(step.x).toBeGreaterThan(start.x + 3);
    expect(step.speed).toBeGreaterThan(100);
    expect(step.crash).toBeLessThan(40);
    expect(capsuleBlocked('sedan', step.x, step.y, step.heading, blocked)).toBe(false);
  });

  it('reports a big crash when hitting a wall square', () => {
    const blocked = boxBlocked({ x0: 123, y0: -1000, x1: 300, y1: 1000 });
    const step = stepVehicle(parked({ x: 100, speed: 200 }), 'sedan', 0, GAS, DT, blocked);
    expect(step.crash).toBeGreaterThan(150);
  });

  it('reports no crash in the open', () => {
    expect(stepVehicle(parked({ speed: 100 }), 'sedan', 0, GAS, DT, open).crash).toBe(0);
  });

  it('refuses to rotate into a wall', () => {
    // A long wall 1px off the car's south side: any turn toward it would put an end of the car inside.
    const blocked = boxBlocked({ x0: -1000, y0: 100 + radiusOf + 1, x1: 5000, y1: 400 });
    let m = parked({ speed: 100 });
    for (let i = 0; i < 40; i++) {
      m = stepVehicle(m, 'sedan', RIGHT, GAS, DT, blocked);
      expect(capsuleBlocked('sedan', m.x, m.y, m.heading, blocked)).toBe(false);
    }
    expect(m.heading).toBe(0);
    expect(m.x).toBeGreaterThan(parked().x + 100);
  });

  it('is deterministic', () => {
    const blocked = boxBlocked({ x0: 250, y0: 90, x1: 280, y1: 400 });
    const a = run(parked(), 120, 0.4, GAS, blocked);
    const b = run(parked(), 120, 0.4, GAS, blocked);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe('capsule', () => {
  it('places two circles along the heading', () => {
    const [a, b] = capsuleCentres('sedan', 50, 60, Math.PI / 2);
    const reach = halfSpan - radiusOf;
    expect(a.x).toBeCloseTo(50, 9);
    expect(a.y).toBeCloseTo(60 + reach, 9);
    expect(b.y).toBeCloseTo(60 - reach, 9);
  });

  it('is blocked when either end hits', () => {
    const box = boxBlocked({ x0: 118, y0: 90, x1: 140, y1: 110 });
    expect(capsuleBlocked('sedan', 100, 100, 0, box)).toBe(true);
    expect(capsuleBlocked('sedan', 100, 100, Math.PI / 2, box)).toBe(false);
  });
});

describe('facingOf', () => {
  it('picks the nearest cardinal', () => {
    expect(facingOf(0, 'n')).toBe('e');
    expect(facingOf(FACING_HEADING.s, 'e')).toBe('s');
    expect(facingOf(Math.PI, 's')).toBe('w');
    expect(facingOf(-Math.PI / 2, 'e')).toBe('n');
    expect(facingOf(3 * Math.PI, 'e')).toBe('w');
  });

  it('holds the previous facing just past the diagonal', () => {
    const justPast = Math.PI / 4 + (5 * Math.PI) / 180;
    expect(facingOf(justPast, 'e')).toBe('e');
    expect(facingOf(justPast, 's')).toBe('s');
  });

  it('switches once well past the diagonal', () => {
    const wellPast = Math.PI / 4 + (15 * Math.PI) / 180;
    expect(facingOf(wellPast, 'e')).toBe('s');
  });

  it('does not flicker around the diagonal', () => {
    let f = facingOf(0, 'e');
    let switches = 0;
    for (let i = 0; i < 200; i++) {
      const h = Math.PI / 4 + Math.sin(i) * 0.05;
      const next = facingOf(h, f);
      if (next !== f) switches++;
      f = next;
    }
    expect(switches).toBe(0);
  });
});
