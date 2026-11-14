import { describe, expect, it } from 'vitest';
import { TICK_RATE } from '../shared/constants.ts';
import { moveToNextTown } from '../shared/level-change.ts';
import { hurtPlayer } from '../shared/player-health.ts';
import { WEAPON_ORDER } from '../shared/protocol.ts';
import type { WeaponId } from '../shared/protocol.ts';
import { BURN_NOISE_RADIUS, BURN_PULSE_DAMAGE, BURN_SEC, CORROSION_BRUTE_PER_STACK, CORROSION_MAX_STACKS, CORROSION_PER_STACK, CORROSION_SEC, PIERCE_DAMAGE_SCALE, TRANQ_BRUTE_SPEED, TRANQ_SEC, TRANQ_SPEED } from '../shared/round-effect-data.ts';
import type { GunEffect } from '../shared/round-effect-data.ts';
import type { PlayerState, SimState, ZombieState } from '../shared/sim-state.ts';
import type { GameSimulation } from '../shared/simulation.ts';
import { heldStats } from '../shared/gun-upgrades.ts';
import { syncGun } from '../shared/weapons.ts';
import { segmentHitsSolid } from '../shared/world-query.ts';
import { BUILDING_DEFS } from '../shared/protocol.ts';
import { corrosionScale, igniteZombie, zombieSpeed } from '../shared/zombie-status.ts';
import { addRoamer, addZombie, eventsOf, input, quietSim, steps } from './helpers/sim-harness.ts';

const SECOND = TICK_RATE;
const PULSES_IN_A_BURN = 6;
const ONE_BURN = PULSES_IN_A_BURN * BURN_PULSE_DAMAGE;

function handGun(p: PlayerState, effect: GunEffect | null, weapon: WeaponId = 'pistol'): void {
  p.guns[weapon] = { ammo: 30, fit: { ranks: {}, quirk: null, ...(effect ? { effect } : {}) } };
  p.owned = WEAPON_ORDER.filter((id) => id === weapon || p.owned.includes(id));
  p.weapon = weapon;
  syncGun(p);
}

function armed(effect: GunEffect | null, weapon: WeaponId = 'pistol'): { sim: GameSimulation; state: SimState; p: PlayerState } {
  const { sim, state } = quietSim();
  const [p] = state.players;
  handGun(p, effect, weapon);
  return { sim, state, p };
}

/** A body that stays exactly where it is put. */
function dummy(state: SimState, x: number, y: number, type: ZombieState['type'] = 'walker'): ZombieState {
  const z = addZombie(state, type, x, y);
  z.speed = 0;
  z.cooldownLeft = 1e6;
  return z;
}

/** Fires one round east and lets it land. */
function shoot(sim: GameSimulation, seq: number, ticks = 3): void {
  sim.setInput('a', input({ seq, shoot: true }));
  sim.step();
  sim.setInput('a', input({ seq: seq + 1 }));
  steps(sim, ticks);
}

/** Rounds in a row. Input numbers carry on from the last call, as a client's do. */
function fired(sim: GameSimulation, p: PlayerState, times: number): void {
  for (let i = 0; i < times; i++) {
    p.fireCooldown = 0;
    shoot(sim, p.lastInputSeq + 2);
  }
}

describe('flame rounds', () => {
  it('burn for about three seconds after the hit, on top of the shot', () => {
    const { sim, state, p } = armed('incendiary');
    const z = dummy(state, p.x + 30, p.y);
    shoot(sim, 1);
    expect(z.status?.burnLeft).toBeGreaterThan(0);
    steps(sim, (BURN_SEC + 1) * SECOND);
    expect(z.status?.burnLeft).toBe(0);
    expect(z.health).toBeCloseTo(z.maxHealth - 34 - ONE_BURN);
  });

  it('light nothing hotter for being fired faster: a second hit only keeps it going', () => {
    const { sim, state, p } = armed(null);
    const z = dummy(state, p.x + 30, p.y);
    igniteZombie(state, z, 'a');
    steps(sim, SECOND);
    igniteZombie(state, z, 'a');
    steps(sim, (BURN_SEC + 1) * SECOND);
    expect(z.maxHealth - z.health).toBeCloseTo((BURN_SEC + 1) * 2 * BURN_PULSE_DAMAGE);
  });

  it('catch one touching body, which cannot pass it on', () => {
    const { sim, state, p } = armed(null);
    const left = dummy(state, p.x + 60, p.y);
    const lit = dummy(state, p.x + 73, p.y);
    const right = dummy(state, p.x + 86, p.y);
    const beyond = dummy(state, p.x + 99, p.y);
    igniteZombie(state, lit, 'a');
    steps(sim, BURN_SEC * SECOND - 5);
    const alight = [left, right, beyond].filter((z) => (z.status?.burnLeft ?? 0) > 0);
    expect(alight.length).toBe(1);
    expect(alight[0]).not.toBe(beyond);
    expect(beyond.status).toBeUndefined();
  });

  it('do not jump a gap', () => {
    const { sim, state, p } = armed(null);
    const lit = dummy(state, p.x + 60, p.y);
    const apart = dummy(state, p.x + 90, p.y);
    igniteZombie(state, lit, 'a');
    steps(sim, BURN_SEC * SECOND);
    expect(apart.status).toBeUndefined();
  });

  it('credit the shooter with what the fire finishes, off a caught body too', () => {
    const { sim, state, p } = armed(null);
    const lit = dummy(state, p.x + 60, p.y);
    const caught = dummy(state, p.x + 73, p.y);
    caught.health = 1;
    igniteZombie(state, lit, 'a');
    sim.snapshot();
    steps(sim, SECOND);
    expect(caught.health).toBe(0);
    expect(p.kills).toBe(1);
    expect(p.score).toBe(1);
    expect(eventsOf(sim.snapshot(), 'zombie_die')[0].killerId).toBe('a');
  });

  it('keep the credit for a shooter who refreshed and came back under a new id', () => {
    const { sim, state } = quietSim([]);
    sim.addPlayer('old', 'a', 'token');
    const z = dummy(state, state.players[0].x + 60, state.players[0].y);
    z.health = 1;
    igniteZombie(state, z, 'old');
    sim.removePlayer('old');
    sim.addPlayer('new', 'a', 'token');
    steps(sim, SECOND);
    expect(z.health).toBe(0);
    expect(state.players[0].kills).toBe(1);
  });

  it('draw a roaming zombie the way a noise does', () => {
    const { state, p } = armed(null);
    const lit = dummy(state, p.x + 60, p.y);
    const near = addRoamer(state, 'walker', lit.x + BURN_NOISE_RADIUS - 10, lit.y);
    const far = addRoamer(state, 'walker', lit.x + BURN_NOISE_RADIUS + 10, lit.y);
    igniteZombie(state, lit, 'a');
    expect(near.mode).toBe('alert');
    expect(far.mode).toBe('wander');
    expect(state.noises.length).toBe(1);
  });

  it('keep roaring while they burn', () => {
    const { sim, state, p } = armed(null);
    const lit = dummy(state, p.x + 60, p.y);
    igniteZombie(state, lit, 'a');
    state.noises = [];
    const roamer = addRoamer(state, 'walker', lit.x + 40, lit.y);
    steps(sim, SECOND + 1);
    expect(roamer.mode).not.toBe('wander');
  });

  it('burn out on a body far from everyone just the same', () => {
    const { sim, state, p } = armed(null);
    const z = addRoamer(state, 'brute', p.x + 2000, p.y);
    igniteZombie(state, z, 'a');
    steps(sim, (BURN_SEC + 1) * SECOND);
    expect(z.status?.burnLeft).toBe(0);
    expect(z.maxHealth - z.health).toBeCloseTo(ONE_BURN);
  });
});

describe('acid rounds', () => {
  it('stack up to three, each raising the damage the zombie takes', () => {
    const { sim, state, p } = armed('acid');
    const z = dummy(state, p.x + 30, p.y, 'brute');
    fired(sim, p, 5);
    expect(z.status?.corrosion).toBe(CORROSION_MAX_STACKS);
    expect(corrosionScale(z)).toBeCloseTo(1 + CORROSION_MAX_STACKS * CORROSION_BRUTE_PER_STACK);
  });

  it('bite deeper into a brute than into a walker', () => {
    const corroded = (type: ZombieState['type']) => ({ type, status: { corrosion: CORROSION_MAX_STACKS } }) as ZombieState;
    expect(corrosionScale(corroded('walker'))).toBeCloseTo(1 + CORROSION_MAX_STACKS * CORROSION_PER_STACK);
    expect(corrosionScale(corroded('brute'))).toBeGreaterThan(corrosionScale(corroded('walker')));
  });

  it('only make acid rounds cost more, so a plain gun never passes the cap on a corroded body', () => {
    const { sim, state, p } = armed('acid');
    const z = dummy(state, p.x + 30, p.y, 'brute');
    fired(sim, p, 3);
    handGun(p, null);
    const before = z.health;
    fired(sim, p, 1);
    expect(before - z.health).toBeCloseTo(34);
  });

  it('put one stack on a body for a whole shotgun blast, however many pellets land', () => {
    const { sim, state, p } = armed('acid', 'shotgun');
    const z = dummy(state, p.x + 12, p.y, 'brute');
    fired(sim, p, 1);
    expect(z.status?.corrosion).toBe(1);
  });

  it('leave a capped carbine no stronger beside an acid shotgun', () => {
    const { sim, state, p } = armed('acid', 'shotgun');
    const z = dummy(state, p.x + 12, p.y, 'brute');
    fired(sim, p, 1);
    p.guns.carbine = { ammo: 30, fit: { ranks: { damage: 2, fireRate: 2 }, quirk: null } };
    p.owned = ['pistol', 'shotgun', 'carbine'];
    p.weapon = 'carbine';
    syncGun(p);
    const before = z.health;
    fired(sim, p, 1);
    expect(before - z.health).toBeCloseTo(heldStats(p).damage);
  });

  it('feed a burn', () => {
    const { sim, state, p } = armed('acid');
    const z = dummy(state, p.x + 30, p.y, 'brute');
    fired(sim, p, 3);
    const before = z.health;
    igniteZombie(state, z, 'a');
    steps(sim, (BURN_SEC + 1) * SECOND);
    expect(before - z.health).toBeCloseTo(ONE_BURN * (1 + CORROSION_MAX_STACKS * CORROSION_BRUTE_PER_STACK));
  });

  it('wear off about five seconds after the last hit', () => {
    const { sim, state, p } = armed('acid');
    const z = dummy(state, p.x + 30, p.y);
    shoot(sim, 1);
    expect(z.status?.corrosion).toBe(1);
    steps(sim, CORROSION_SEC * SECOND);
    expect(z.status?.corrosion).toBe(0);
    expect(corrosionScale(z)).toBe(1);
  });
});

describe('piercing rounds', () => {
  it('go through the first body and hit the next for less, and no further', () => {
    const { sim, state, p } = armed('piercing');
    const brutes = [40, 80, 120].map((gap) => dummy(state, p.x + gap, p.y, 'brute'));
    shoot(sim, 1, 15);
    const taken = brutes.map((z) => z.maxHealth - z.health);
    expect(taken[0]).toBeCloseTo(34);
    expect(taken[1]).toBeCloseTo(34 * PIERCE_DAMAGE_SCALE);
    expect(taken[2]).toBe(0);
    expect(state.bullets.length).toBe(0);
  });

  it('carry on from a body they killed', () => {
    const { sim, state, p } = armed('piercing');
    const first = dummy(state, p.x + 30, p.y);
    const second = dummy(state, p.x + 60, p.y);
    first.health = 1;
    shoot(sim, 1, 10);
    expect(first.health).toBe(0);
    expect(second.maxHealth - second.health).toBeCloseTo(34 * PIERCE_DAMAGE_SCALE);
  });

  it('reach the second body inside the same tick when it stands right behind', () => {
    const { sim, state, p } = armed('piercing');
    const first = dummy(state, p.x + 8, p.y, 'brute');
    const second = dummy(state, p.x + 12, p.y, 'brute');
    sim.setInput('a', input({ seq: 1, shoot: true }));
    sim.step();
    expect(first.health).toBeLessThan(first.maxHealth);
    expect(second.health).toBeLessThan(second.maxHealth);
  });

  it('are still stopped by a wall', () => {
    const { sim, state, p } = armed('piercing');
    const walled = state.map.buildings.flatMap((building) => {
      const { w, h, doorX } = BUILDING_DEFS[building.kind];
      const x = building.x + (doorX < w / 2 ? w - 24 : 24);
      const south = building.y + h;
      const openOutside = segmentHitsSolid(state.map, x, south + 34, x, south + 8) === null;
      const blocked = segmentHitsSolid(state.map, x, south + 8, x, south - 14) !== null;
      return openOutside && blocked ? [{ x, south }] : [];
    })[0];
    p.x = walled.x;
    p.y = walled.south + 34;
    const outside = dummy(state, walled.x, walled.south + 12, 'brute');
    const inside = dummy(state, walled.x, walled.south - 18, 'brute');
    sim.setInput('a', input({ seq: 1, shoot: true, angle: -Math.PI / 2 }));
    steps(sim, 15);
    expect(outside.health).toBeLessThan(outside.maxHealth);
    expect(inside.health).toBe(inside.maxHealth);
  });
});

describe('tranq rounds', () => {
  it('slow a hit zombie for about three seconds', () => {
    const { sim, state, p } = armed('tranq');
    const z = dummy(state, p.x + 30, p.y);
    z.speed = 30;
    shoot(sim, 1);
    expect(zombieSpeed(z)).toBeCloseTo(30 * TRANQ_SPEED);
    steps(sim, TRANQ_SEC * SECOND);
    expect(zombieSpeed(z)).toBe(30);
  });

  it('do less to a brute', () => {
    const { sim, state, p } = armed('tranq');
    const z = dummy(state, p.x + 30, p.y, 'brute');
    z.speed = 30;
    shoot(sim, 1);
    expect(zombieSpeed(z)).toBeCloseTo(30 * TRANQ_BRUTE_SPEED);
  });

  it('really do hold a chaser back', () => {
    const walked = (effect: GunEffect | null): number => {
      const { sim, state, p } = armed(effect);
      const z = addZombie(state, 'walker', p.x + 100, p.y);
      z.health = z.maxHealth = 500;
      shoot(sim, 1, 6);
      const startX = z.x;
      steps(sim, SECOND);
      return startX - z.x;
    };
    expect(walked('tranq')).toBeLessThan(walked(null) * 0.6);
  });

  it('hit lighter than a plain round', () => {
    const { sim, state, p } = armed('tranq');
    const z = dummy(state, p.x + 30, p.y, 'brute');
    shoot(sim, 1);
    expect(z.maxHealth - z.health).toBeCloseTo(34 * 0.7);
  });
});

describe('every effect', () => {
  it('leaves a shove alone: only a bullet carries it', () => {
    const { sim, state, p } = armed('incendiary');
    const z = dummy(state, p.x + 14, p.y);
    sim.setInput('a', input({ seq: 1, melee: true }));
    steps(sim, 2);
    expect(z.health).toBeLessThan(z.maxHealth);
    expect(z.status).toBeUndefined();
  });

  it('lets a headshot land as ever', () => {
    const { sim, state, p } = armed('incendiary');
    const z = dummy(state, p.x + 30, p.y, 'brute');
    p.aim = null;
    sim.snapshot();
    state.bullets.push({ id: 'b', shooterId: 'a', x: p.x, y: p.y, vx: 520, vy: 0, damage: 34, rangeLeft: 300, headTarget: z, effect: 'incendiary' });
    steps(sim, 3);
    expect(eventsOf(sim.snapshot(), 'headshot').length).toBe(1);
    expect(z.maxHealth - z.health).toBeGreaterThanOrEqual(34 * 1.5);
    expect(z.status?.burnLeft).toBeGreaterThan(0);
  });

  it('shows on the zombie in a snapshot, and a clean body says nothing', () => {
    const { sim, state, p } = armed(null);
    const lit = dummy(state, p.x + 60, p.y);
    const clean = dummy(state, p.x + 120, p.y);
    igniteZombie(state, lit, 'a');
    const { zombies } = sim.snapshot();
    expect(zombies.find((z) => z.id === lit.id)?.burning).toBe(true);
    expect(Object.keys(zombies.find((z) => z.id === clean.id) ?? {})).not.toContain('burning');
    expect(Object.keys(zombies.find((z) => z.id === clean.id) ?? {})).not.toContain('corrosion');
  });

  it('tells clients what took hold', () => {
    const { sim, state, p } = armed('acid');
    const z = dummy(state, p.x + 30, p.y);
    sim.snapshot();
    shoot(sim, 1);
    const [status] = eventsOf(sim.snapshot(), 'zombie_status');
    expect(status).toMatchObject({ effect: 'acid', zombieId: z.id, stacks: 1 });
  });

  it('marks the shot and its bullets, and a plain gun marks nothing', () => {
    const { sim } = armed('tranq');
    sim.setInput('a', input({ seq: 1, shoot: true }));
    sim.step();
    const frame = sim.snapshot();
    expect(eventsOf(frame, 'shot')[0].effect).toBe('tranq');
    expect(frame.bullets[0].effect).toBe('tranq');
    const plain = armed(null);
    plain.sim.setInput('a', input({ seq: 1, shoot: true }));
    plain.sim.step();
    expect(Object.keys(plain.sim.snapshot().bullets[0])).not.toContain('effect');
  });

  it('clears with the level, and the carried gun keeps its effect', () => {
    const { state, p } = armed('incendiary');
    const z = dummy(state, p.x + 60, p.y);
    igniteZombie(state, z, 'a');
    moveToNextTown(state);
    expect(state.zombies.some((each) => each.status)).toBe(false);
    expect(p.guns.pistol?.fit?.effect).toBe('incendiary');
  });

  it('goes with the gun on death', () => {
    const { sim, state } = quietSim(['a', 'b']);
    const [p] = state.players;
    handGun(p, 'acid');
    p.kits.tranq = 1;
    hurtPlayer(state, p, 1000);
    p.status = 'dead';
    state.intermissionLeft = 0;
    sim.step();
    expect(p.status).toBe('alive');
    expect(p.guns.pistol?.fit).toBeUndefined();
    expect(p.kits.tranq).toBe(0);
  });

  it('survives a refresh in co-op on the gun and on the zombie', () => {
    const { sim, state } = quietSim([]);
    sim.addPlayer('old', 'a', 'token');
    sim.addPlayer('mate', 'b', 'other');
    handGun(state.players[0], 'tranq');
    state.players[0].kits.acid = 1;
    const z = dummy(state, state.players[0].x + 60, state.players[0].y);
    igniteZombie(state, z, 'old');
    sim.removePlayer('old');
    sim.addPlayer('new', 'a', 'token');
    const back = state.players.find((each) => each.id === 'new') as PlayerState;
    expect(back.guns.pistol?.fit?.effect).toBe('tranq');
    expect(back.kits.acid).toBe(1);
    expect(z.status?.burnerId).toBe('new');
  });

  it('plays out the same from the same seed and inputs', () => {
    const run = (): string => {
      const { sim, state, p } = armed('incendiary', 'shotgun');
      for (let i = 0; i < 12; i++) addZombie(state, i % 4 === 3 ? 'bloater' : 'walker', p.x + 40 + (i % 4) * 14, p.y - 20 + Math.floor(i / 4) * 14);
      const frames: string[] = [];
      for (let tick = 0; tick < 200; tick++) {
        sim.setInput('a', input({ seq: tick + 1, shoot: tick % 25 === 0 }));
        sim.step();
        frames.push(JSON.stringify(sim.snapshot()));
      }
      return frames.join();
    };
    expect(run()).toBe(run());
  });
});
