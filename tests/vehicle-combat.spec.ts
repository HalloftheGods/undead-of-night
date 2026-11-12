import { describe, expect, it, vi } from 'vitest';
import { eventsOf, quietSim, addRoamer } from './helpers/sim-harness.ts';
import { drive, seatDriver } from './helpers/vehicle-scene.ts';
import { carSounds, ENGINE_NOISE_INTERVAL_SEC, ENGINE_NOISE_MAX_RADIUS, ENGINE_NOISE_MIN_SPEED, HORN_COOLDOWN_SEC, HORN_NOISE_RADIUS } from '../shared/vehicle-feel.ts';
import { VEHICLE_TOP_SPEED } from '../shared/vehicle-physics.ts';
import { checkVehicleRoadkill, MIN_ROADKILL_SPEED } from '../shared/vehicle-combat.ts';
import { TICK_RATE, WEAPONS } from '../shared/constants.ts';

const noiseCalls = vi.hoisted(() => ({ count: 0, radii: [] as number[] }));
vi.mock('../shared/zombie-senses.ts', async (importOriginal) => {
  const original = await importOriginal<typeof import('../shared/zombie-senses.ts')>();
  return {
    ...original,
    makeNoise: (...args: Parameters<typeof original.makeNoise>) => {
      noiseCalls.count++;
      noiseCalls.radii.push(args[3]);
      original.makeNoise(...args);
    },
  };
});

/** A zombie standing `ahead` px past the car's centre along its heading and `side` px off it. */
function zombieAhead(state: ReturnType<typeof quietSim>['state'], car: { x: number; y: number }, nose: { x: number; y: number }, ahead: number, side = 0) {
  const z = addRoamer(state, 'walker', car.x + nose.x * ahead - nose.y * side, car.y + nose.y * ahead + nose.x * side);
  z.mode = 'wander';
  return z;
}

describe('vehicle roadkill and shove', () => {
  it('a fast car hurts, knocks back, credits the driver and slows', () => {
    const { sim, state } = quietSim();
    const { car, nose, keys } = seatDriver(sim, state);
    drive(sim, 12, keys);
    expect(car.speed).toBeGreaterThan(MIN_ROADKILL_SPEED);
    const z = zombieAhead(state, car, nose, 26);
    z.health = z.maxHealth = 5000;
    const before = car.speed;
    const frames = drive(sim, 1, keys);
    const hits = frames.flatMap((f) => eventsOf(f, 'vehicle_hit'));
    expect(hits.length).toBeGreaterThan(0);
    expect(z.health).toBeLessThan(5000);
    expect(z.knockX * nose.x + z.knockY * nose.y).toBeGreaterThan(0);
    expect(car.speed).toBeLessThan(before);
  });

  it('a kill is credited to the driver in the event', () => {
    const { sim, state } = quietSim();
    const { car, nose, keys } = seatDriver(sim, state);
    drive(sim, 12, keys);
    const z = zombieAhead(state, car, nose, 36);
    z.health = 1;
    const frames = drive(sim, 3, keys);
    const hit = frames.flatMap((f) => eventsOf(f, 'vehicle_hit'))[0];
    expect(hit.kill).toBe(true);
    expect(z.health).toBe(0);
  });

  it('slow contact shoves sideways without damage or event', () => {
    const { sim, state } = quietSim();
    const { car, nose, keys } = seatDriver(sim, state);
    const z = zombieAhead(state, car, nose, 30, 3);
    const frames = drive(sim, 4, keys);
    expect(car.speed).toBeLessThan(MIN_ROADKILL_SPEED);
    expect(car.speed).toBeGreaterThan(0);
    expect(frames.flatMap((f) => eventsOf(f, 'vehicle_hit'))).toHaveLength(0);
    expect(z.health).toBe(z.maxHealth);
    const sideways = Math.abs(-z.knockX * nose.y + z.knockY * nose.x);
    expect(sideways).toBeGreaterThan(0);
  });

  it('the same zombie is hit at most once per cooldown', () => {
    const { sim, state } = quietSim();
    const { car, nose, keys } = seatDriver(sim, state);
    drive(sim, 12, keys);
    const z = zombieAhead(state, car, nose, 36);
    z.health = z.maxHealth = 50000;
    z.radius = 40;
    const frames = drive(sim, 12, keys);
    expect(frames.flatMap((f) => eventsOf(f, 'vehicle_hit')).length).toBeLessThanOrEqual(1);
  });

  it('a boss is hurt but not one-shot and costs the car half its speed', () => {
    const { sim, state } = quietSim();
    const { car, nose } = seatDriver(sim, state);
    car.speed = 210;
    const z = zombieAhead(state, car, nose, 0);
    z.health = 100;
    z.maxHealth = 100;
    z.bossState = {} as never;
    checkVehicleRoadkill(state, car, 'a');
    expect(z.health).toBeGreaterThan(0);
    expect(z.health).toBeLessThan(100);
    expect(car.speed).toBeCloseTo(105, 5);
  });
});

describe('horn', () => {
  it('honks on the press edge, once per cooldown, with one noise', () => {
    const { sim, state } = quietSim();
    seatDriver(sim, state);
    noiseCalls.count = 0;
    const frames = [...drive(sim, 5, { horn: true }), ...drive(sim, 2), ...drive(sim, 3, { horn: true })];
    expect(frames.flatMap((f) => eventsOf(f, 'vehicle_horn'))).toHaveLength(1);
    expect(noiseCalls.count).toBe(1);
    const later = [...drive(sim, Math.ceil(HORN_COOLDOWN_SEC * TICK_RATE) + 2), ...drive(sim, 2, { horn: true })];
    expect(later.flatMap((f) => eventsOf(f, 'vehicle_horn'))).toHaveLength(1);
  });

  it('a passenger or a pedestrian cannot honk', () => {
    const { sim } = quietSim();
    const frames = drive(sim, 5, { horn: true });
    expect(frames.flatMap((f) => eventsOf(f, 'vehicle_horn'))).toHaveLength(0);
  });
});

describe('engine noise', () => {
  it('a rolling car pushes a noise every interval; a slow empty one stays quiet', () => {
    const { sim, state } = quietSim();
    const { car } = seatDriver(sim, state);
    car.seats[0] = null;
    noiseCalls.count = 0;
    car.speed = ENGINE_NOISE_MIN_SPEED - 1;
    for (let i = 0; i < 3 * TICK_RATE; i++, state.tick++) carSounds(state, car);
    expect(noiseCalls.count).toBe(0);
    car.speed = ENGINE_NOISE_MIN_SPEED + 40;
    for (let i = 0; i < 3 * TICK_RATE; i++, state.tick++) carSounds(state, car);
    expect(noiseCalls.count).toBe(Math.floor(3 / ENGINE_NOISE_INTERVAL_SEC));
  });

  it('is louder than any gun, and louder still at speed', () => {
    const { sim, state } = quietSim();
    const { car } = seatDriver(sim, state);
    const loudest = Math.max(...Object.values(WEAPONS).map((w) => w.noiseRadius));
    const radiusAt = (speed: number): number => {
      noiseCalls.radii.length = 0;
      car.speed = speed;
      for (let i = 0; i < 2 * TICK_RATE; i++, state.tick++) carSounds(state, car);
      return Math.max(...noiseCalls.radii);
    };
    expect(radiusAt(ENGINE_NOISE_MIN_SPEED + 1)).toBeGreaterThan(loudest);
    expect(radiusAt(VEHICLE_TOP_SPEED)).toBeGreaterThan(radiusAt(ENGINE_NOISE_MIN_SPEED + 1));
  });

  it('an idling engine under a driver is heard, but only close by', () => {
    const { sim, state } = quietSim();
    const { car } = seatDriver(sim, state);
    car.speed = 0;
    noiseCalls.count = 0;
    noiseCalls.radii.length = 0;
    for (let i = 0; i < 3 * TICK_RATE; i++, state.tick++) carSounds(state, car);
    expect(noiseCalls.count).toBeGreaterThan(0);
    expect(Math.max(...noiseCalls.radii)).toBeLessThan(WEAPONS.pistol.noiseRadius);
  });

  it('draws a zombie far beyond gunshot range to a car at speed', () => {
    const { sim, state } = quietSim();
    const { car, nose, keys } = seatDriver(sim, state);
    const farther = WEAPONS.shotgun.noiseRadius + 80;
    const z = addRoamer(state, 'walker', car.x + nose.x * farther, car.y + nose.y * farther);
    z.mode = 'wander';
    let noticed = false;
    for (let i = 0; i < Math.round(1.5 * TICK_RATE); i++) {
      drive(sim, 1, keys);
      noticed ||= z.mode !== 'wander';
    }
    expect(noticed).toBe(true);
  });
});

describe('horn loudness', () => {
  it('carries farther than a shotgun and a flat-out engine: the whole block', () => {
    expect(HORN_NOISE_RADIUS).toBeGreaterThan(WEAPONS.shotgun.noiseRadius);
    expect(HORN_NOISE_RADIUS).toBeGreaterThan(ENGINE_NOISE_MAX_RADIUS);
  });
});
