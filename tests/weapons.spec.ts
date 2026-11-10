import { describe, expect, it } from 'vitest';
import { MELEE_COOLDOWN_SEC, MELEE_DAMAGE, MELEE_RANGE, START_SPARE_ROUNDS, TICK_DT, TICK_RATE, WEAPONS } from '../shared/constants.ts';
import { WEAPON_ORDER } from '../shared/protocol.ts';
import { buildingBox, propBox } from '../shared/world-map.ts';
import { circleHitsSolid } from '../shared/world-query.ts';
import { addRoamer, addZombie, eventsOf, findBuilding, clearWay, findProp, input, quietSim, stepUntil, steps } from './helpers/sim-harness.ts';
import type { PlayerState } from '../shared/sim-state.ts';

function arm(p: PlayerState, weapon: 'carbine' | 'shotgun', ammo: number, reserve: number): void {
  p.guns[weapon] = { ammo };
  p.ammoBag[weapon] = reserve;
  p.owned = ['pistol', weapon];
  p.weapon = weapon;
  p.ammo = ammo;
  p.reserve = reserve;
  p.magSize = WEAPONS[weapon].magSize;
}

describe('firing', () => {
  it('respects the fire interval while the trigger is held', () => {
    const { sim } = quietSim();
    sim.setInput('a', input({ seq: 1, shoot: true }));
    steps(sim, TICK_RATE * 3);
    const shots = eventsOf(sim.snapshot(), 'shot').length;
    expect(shots).toBeGreaterThanOrEqual(Math.floor(3000 / WEAPONS.pistol.fireIntervalMs) - 1);
    expect(shots).toBeLessThanOrEqual(Math.ceil(3000 / WEAPONS.pistol.fireIntervalMs) + 1);
  });

  it('holds the carbine to its nominal rate although it does not divide the tick', () => {
    const { sim, state } = quietSim();
    arm(state.players[0], 'carbine', 30, 0);
    sim.setInput('a', input({ seq: 1, shoot: true }));
    steps(sim, TICK_RATE * 2);
    const shots = eventsOf(sim.snapshot(), 'shot').length;
    expect(shots).toBeGreaterThanOrEqual(Math.floor(2000 / WEAPONS.carbine.fireIntervalMs) - 1);
  });

  it('fires eight spread pellets from the shotgun for one shell', () => {
    const { sim, state } = quietSim();
    arm(state.players[0], 'shotgun', 6, 10);
    sim.setInput('a', input({ seq: 1, shoot: true }));
    sim.step();
    sim.setInput('a', input({ seq: 2, shoot: false }));
    expect(state.bullets.length).toBe(WEAPONS.shotgun.pellets);
    const headings = state.bullets.map((b) => Math.atan2(b.vy, b.vx));
    expect(new Set(headings).size).toBeGreaterThan(4);
    for (const heading of headings) expect(Math.abs(heading)).toBeLessThanOrEqual(WEAPONS.shotgun.spreadRad);
    expect(state.players[0].ammo).toBe(5);
  });

  it('expires bullets at their range', () => {
    const { sim, state } = quietSim();
    const bullet = { id: 'b', shooterId: 'a', x: state.map.spawn.x, y: state.map.spawn.y, vx: 300, vy: 0, damage: 1, rangeLeft: 50 };
    state.bullets.push(bullet);
    steps(sim, 6);
    expect(bullet.x - state.map.spawn.x).toBeLessThanOrEqual(50.01);
    expect(state.bullets.length).toBe(0);
  });
});

describe('bullets cannot tunnel', () => {
  it.each([500, 5000, 100000])('stops on a building at %i px/s', (speed) => {
    const { sim, state } = quietSim();
    // A crate with open floor to its left: one stacked against a wall has nowhere to fire from.
    const crates = sim.map.props.filter((p) => p.kind === 'crate_stack').map(propBox);
    const box = crates.find((c) => !circleHitsSolid(sim.map, c.x0 - 4, (c.y0 + c.y1) / 2, 3.9)) ?? propBox(findProp(sim, 'crate_stack'));
    const y = (box.y0 + box.y1) / 2;
    state.bullets.push({ id: 'b', shooterId: 'a', x: box.x0 - 8, y, vx: speed, vy: 0, damage: 10, rangeLeft: 4000 });
    steps(sim, 3);
    expect(state.bullets.length).toBe(0);
    const impacts = eventsOf(sim.snapshot(), 'bullet_impact');
    expect(impacts.length).toBe(1);
    expect(impacts[0].x).toBeCloseTo(box.x0, 1);
  });

  it.each([500, 5000, 100000])('hits a zombie at %i px/s', (speed) => {
    const { sim, state } = quietSim();
    const { x, y } = state.map.spawn;
    const zombie = addZombie(state, 'runner', x + 60, y);
    state.bullets.push({ id: 'b', shooterId: 'a', x: x + 45, y, vx: speed, vy: 0, damage: 5, rangeLeft: 4000 });
    sim.step();
    expect(zombie.health).toBeLessThan(zombie.maxHealth);
    expect(state.bullets.length).toBe(0);
  });

  it('hits a zombie pressed up against the shooter', () => {
    const { sim, state } = quietSim();
    const [p] = state.players;
    const zombie = addZombie(state, 'walker', p.x + 9, p.y);
    sim.setInput('a', input({ seq: 1, shoot: true, angle: 0 }));
    sim.step();
    expect(zombie.health).toBeLessThan(zombie.maxHealth);
  });

  it('cannot shoot through a wall the shooter is pressed against', () => {
    const { sim, state } = quietSim();
    const [p] = state.players;
    const box = buildingBox(findBuilding(sim, 'house'));
    p.x = box.x1 - 24;
    p.y = box.y1 + 6.01;
    const behindWall = addZombie(state, 'walker', p.x, box.y1 - 20);
    behindWall.speed = 0;
    sim.setInput('a', input({ seq: 1, shoot: true, angle: -Math.PI / 2 }));
    steps(sim, 6);
    expect(behindWall.health).toBe(behindWall.maxHealth);
    expect(eventsOf(sim.snapshot(), 'bullet_impact').length).toBeGreaterThan(0);
  });

  it('takes the nearer of two zombies in line', () => {
    const { sim, state } = quietSim();
    const { x, y } = state.map.spawn;
    const far = addZombie(state, 'walker', x + 40, y);
    const near = addZombie(state, 'walker', x + 20, y);
    state.bullets.push({ id: 'b', shooterId: 'a', x, y, vx: 3000, vy: 0, damage: 5, rangeLeft: 100 });
    sim.step();
    expect(near.health).toBeLessThan(near.maxHealth);
    expect(far.health).toBe(far.maxHealth);
  });

  it('knocks a hit zombie back along the shot', () => {
    const { sim, state } = quietSim();
    const [p] = state.players;
    const { dx, dy } = clearWay(state, 160);
    const zombie = addZombie(state, 'bloater', p.x + dx * 120, p.y + dy * 120);
    zombie.speed = 0;
    const start = { x: zombie.x, y: zombie.y };
    state.bullets.push({ id: 'b', shooterId: 'a', x: p.x + dx * 100, y: p.y + dy * 100, vx: dx * 900, vy: dy * 900, damage: 1, rangeLeft: 100 });
    steps(sim, 6);
    expect((zombie.x - start.x) * dx + (zombie.y - start.y) * dy).toBeGreaterThan(0);
  });
});

describe('reloading', () => {
  it('takes reloadMs and refills the magazine', () => {
    const { sim, state } = quietSim();
    const [p] = state.players;
    p.guns.pistol!.ammo = 3;
    p.ammo = 3;
    sim.setInput('a', input({ seq: 1, reload: true }));
    sim.step();
    sim.setInput('a', input({ seq: 2 }));
    expect(p.reload).toBeGreaterThan(0);
    expect(p.reload).toBeLessThan(1);
    const expected = WEAPONS.pistol.reloadMs / 1000 / TICK_DT;
    const ticks = stepUntil(sim, () => p.reload === 0, 100);
    expect(ticks + 1).toBeGreaterThanOrEqual(expected - 1);
    expect(ticks + 1).toBeLessThanOrEqual(expected + 1);
    expect(p.ammo).toBe(WEAPONS.pistol.magSize);
    expect(p.reserve).toBe(START_SPARE_ROUNDS - (WEAPONS.pistol.magSize - 3));
    const snapshot = sim.snapshot();
    expect(eventsOf(snapshot, 'reload_start').length).toBe(1);
    expect(eventsOf(snapshot, 'reload_end').length).toBe(1);
  });

  it('draws only what the reserve holds', () => {
    const { sim, state } = quietSim();
    const [p] = state.players;
    arm(p, 'carbine', 0, 7);
    sim.setInput('a', input({ seq: 1, reload: true }));
    steps(sim, 60);
    expect(p.ammo).toBe(7);
    expect(p.reserve).toBe(0);
  });

  it('cannot fire while reloading', () => {
    const { sim, state } = quietSim();
    const [p] = state.players;
    p.guns.pistol!.ammo = 5;
    sim.setInput('a', input({ seq: 1, reload: true, shoot: true }));
    steps(sim, 10);
    expect(eventsOf(sim.snapshot(), 'shot').length).toBe(0);
  });

  it('ignores a reload with a full magazine or an empty reserve', () => {
    const { sim, state } = quietSim();
    const [p] = state.players;
    sim.setInput('a', input({ seq: 1, reload: true }));
    sim.step();
    expect(p.reload).toBe(0);
    arm(p, 'carbine', 3, 0);
    sim.setInput('a', input({ seq: 2, reload: true }));
    sim.step();
    expect(p.reload).toBe(0);
  });

  it('reloads automatically when firing on empty with reserve left', () => {
    const { sim, state } = quietSim();
    const [p] = state.players;
    p.guns.pistol!.ammo = 1;
    p.ammo = 1;
    sim.setInput('a', input({ seq: 1, shoot: true }));
    steps(sim, 12);
    expect(p.reload).toBeGreaterThan(0);
    steps(sim, 40);
    expect(p.ammo).toBeGreaterThan(0);
    expect(eventsOf(sim.snapshot(), 'reload_end').length).toBeGreaterThan(0);
  });

  it('dry fires, rate limited, when truly empty', () => {
    const { sim, state } = quietSim();
    arm(state.players[0], 'carbine', 0, 0);
    sim.setInput('a', input({ seq: 1, shoot: true }));
    steps(sim, TICK_RATE);
    const dry = eventsOf(sim.snapshot(), 'dry_fire').length;
    expect(dry).toBeGreaterThanOrEqual(2);
    expect(dry).toBeLessThanOrEqual(4);
  });

  it('switching weapons cancels the reload without loading anything', () => {
    const { sim, state } = quietSim();
    const [p] = state.players;
    arm(p, 'carbine', 2, 50);
    sim.setInput('a', input({ seq: 1, reload: true }));
    steps(sim, 5);
    expect(p.reload).toBeGreaterThan(0);
    sim.setInput('a', input({ seq: 2, weapon: 'pistol' }));
    sim.step();
    expect(p.weapon).toBe('pistol');
    expect(p.reload).toBe(0);
    expect(p.ammo).toBe(WEAPONS.pistol.magSize);
    steps(sim, 90);
    expect(p.guns.carbine).toEqual({ ammo: 2 });
    expect(p.ammoBag.carbine).toBe(50);
    const snapshot = sim.snapshot();
    expect(eventsOf(snapshot, 'weapon_switch').length).toBe(1);
    expect(eventsOf(snapshot, 'reload_end').length).toBe(0);
  });

  it('keeps ammo per gun across switches', () => {
    const { sim, state } = quietSim();
    const [p] = state.players;
    arm(p, 'carbine', 11, 44);
    sim.setInput('a', input({ seq: 1, weapon: 'pistol' }));
    sim.step();
    expect(p.reserve).toBe(START_SPARE_ROUNDS);
    sim.setInput('a', input({ seq: 2, weapon: 'carbine' }));
    sim.step();
    expect([p.ammo, p.reserve, p.magSize]).toEqual([11, 44, 30]);
  });

  it('ignores a weapon the player does not own', () => {
    const { sim, state } = quietSim();
    sim.setInput('a', input({ seq: 1, weapon: 'shotgun' }));
    sim.step();
    expect(state.players[0].weapon).toBe('pistol');
  });
});

describe('every gun is finite', () => {
  it('starts with one magazine and one reload of spare rounds', () => {
    const { state } = quietSim();
    const [p] = state.players;
    expect(p.ammo).toBe(12);
    expect(p.reserve).toBe(12);
    expect(p.ammoBag).toEqual({ pistol: 12, carbine: 0, shotgun: 0 });
    expect(p.medkits).toBe(0);
  });

  it('caps and limits are set for every gun, with none unlimited', () => {
    for (const id of WEAPON_ORDER) {
      expect(WEAPONS[id].reserveCap).toBeGreaterThan(0);
      expect(WEAPONS[id].foundAmmo).toBeGreaterThan(0);
      expect(WEAPONS[id].noiseRadius).toBeGreaterThan(0);
    }
    expect([WEAPONS.pistol.reserveCap, WEAPONS.carbine.reserveCap, WEAPONS.shotgun.reserveCap]).toEqual([60, 120, 30]);
  });

  it.each(WEAPON_ORDER)('holding the trigger on the %s ends in dry_fire with every round spent', (weapon) => {
    const { sim, state } = quietSim();
    const [p] = state.players;
    if (weapon !== 'pistol') arm(p, weapon, WEAPONS[weapon].foundAmmo, 12);
    const rounds = p.ammo + p.reserve;
    sim.setInput('a', input({ seq: 1, shoot: true }));
    let shots = 0;
    let dry = 0;
    for (let tick = 0; tick < TICK_RATE * 120 && dry === 0; tick++) {
      sim.step();
      const snapshot = sim.snapshot();
      shots += eventsOf(snapshot, 'shot').length;
      dry += eventsOf(snapshot, 'dry_fire').length;
    }
    expect(dry).toBeGreaterThan(0);
    expect(shots).toBe(rounds);
    expect(p.ammo).toBe(0);
    expect(p.reserve).toBe(0);
    expect(p.ammoBag[weapon]).toBe(0);
  });

  it('a reload moves rounds out of the reserve and creates none', () => {
    const { sim, state } = quietSim();
    const [p] = state.players;
    p.guns.pistol!.ammo = 2;
    p.ammo = 2;
    p.ammoBag.pistol = 5;
    p.reserve = 5;
    sim.setInput('a', input({ seq: 1, reload: true }));
    steps(sim, 60);
    expect(p.ammo).toBe(7);
    expect(p.reserve).toBe(0);
  });

  it('snapshots expose the bag for the HUD', () => {
    const { sim, state } = quietSim();
    const [p] = state.players;
    arm(p, 'shotgun', 2, 9);
    const [me] = sim.snapshot().players;
    expect(me.ammoBag).toEqual({ pistol: 12, carbine: 0, shotgun: 9 });
    expect(me.reserve).toBe(9);
    me.ammoBag.pistol = 0;
    expect(p.ammoBag.pistol).toBe(12);
  });
});

describe('shove', () => {
  it('works with an empty gun: weak, knocks back, no shot fired', () => {
    const { sim, state } = quietSim();
    const [p] = state.players;
    p.guns.pistol!.ammo = 0;
    p.ammo = 0;
    p.ammoBag.pistol = 0;
    p.reserve = 0;
    const zombie = addZombie(state, 'walker', p.x + 16, p.y);
    const startX = zombie.x;
    sim.setInput('a', input({ seq: 1, melee: true, angle: 0 }));
    sim.step();
    const snapshot = sim.snapshot();
    const [shove] = eventsOf(snapshot, 'melee');
    expect(shove).toMatchObject({ playerId: 'a', hit: true });
    expect(zombie.health).toBe(zombie.maxHealth - MELEE_DAMAGE);
    expect(MELEE_DAMAGE).toBeLessThan(WEAPONS.pistol.damage / 2);
    expect(eventsOf(snapshot, 'shot').length).toBe(0);
    steps(sim, 8);
    expect(zombie.x).toBeGreaterThan(startX + 10);
  });

  it('cancels a swing that was winding up', () => {
    const { sim, state } = quietSim();
    const [p] = state.players;
    const zombie = addZombie(state, 'walker', p.x + 14, p.y);
    sim.step();
    expect(zombie.attacking).toBe(true);
    sim.setInput('a', input({ seq: 1, melee: true, angle: 0 }));
    sim.step();
    expect(zombie.attacking).toBe(false);
    steps(sim, 20);
    expect(p.health).toBe(p.maxHealth);
  });

  it('has a cooldown, and a held key does not repeat', () => {
    const { sim } = quietSim();
    for (let seq = 1; seq <= TICK_RATE * 2; seq++) {
      sim.setInput('a', input({ seq, melee: true }));
      sim.step();
    }
    const shoves = eventsOf(sim.snapshot(), 'melee').length;
    const expected = 2 / MELEE_COOLDOWN_SEC;
    expect(shoves).toBeGreaterThanOrEqual(Math.floor(expected));
    expect(shoves).toBeLessThanOrEqual(Math.ceil(expected));
  });

  it('misses behind the player and past its reach', () => {
    const { sim, state } = quietSim();
    const [p] = state.players;
    const behind = addZombie(state, 'walker', p.x - 16, p.y);
    const far = addZombie(state, 'walker', p.x + MELEE_RANGE + 30, p.y);
    behind.speed = 0;
    far.speed = 0;
    sim.setInput('a', input({ seq: 1, melee: true, angle: 0 }));
    sim.step();
    expect(behind.health).toBe(behind.maxHealth);
    expect(far.health).toBe(far.maxHealth);
    expect(eventsOf(sim.snapshot(), 'melee')[0].hit).toBe(false);
  });

  it('makes no noise: a roamer round the corner stays unaware', () => {
    const { sim, state } = quietSim();
    const [p] = state.players;
    const victim = addZombie(state, 'walker', p.x + 16, p.y);
    const bystander = addRoamer(state, 'walker', p.x + 190, p.y);
    bystander.speed = 0;
    sim.setInput('a', input({ seq: 1, melee: true, angle: 0 }));
    steps(sim, 3);
    expect(victim.health).toBeLessThan(victim.maxHealth);
    expect(bystander.mode).toBe('wander');
    expect(eventsOf(sim.snapshot(), 'zombie_alert').length).toBe(0);
  });

  it('cannot reach through a wall', () => {
    const { sim, state } = quietSim();
    const [p] = state.players;
    const box = buildingBox(findBuilding(sim, 'house'));
    p.x = box.x1 - 24;
    p.y = box.y1 + 7;
    const zombie = addZombie(state, 'walker', p.x, box.y1 - 14);
    zombie.speed = 0;
    sim.setInput('a', input({ seq: 1, melee: true, angle: -Math.PI / 2 }));
    sim.step();
    expect(zombie.health).toBe(zombie.maxHealth);
  });
});

describe('latched requests', () => {
  it('keeps a reload request when a later packet in the tick clears it', () => {
    const { sim, state } = quietSim();
    const [p] = state.players;
    p.guns.pistol!.ammo = 4;
    sim.setInput('a', input({ seq: 1, reload: true }));
    sim.setInput('a', input({ seq: 2, reload: false }));
    sim.step();
    expect(p.reload).toBeGreaterThan(0);
  });

  it('keeps a weapon request when a later packet clears it', () => {
    const { sim, state } = quietSim();
    const [p] = state.players;
    arm(p, 'carbine', 30, 10);
    sim.setInput('a', input({ seq: 1, weapon: 'pistol' }));
    sim.setInput('a', input({ seq: 2, weapon: null }));
    sim.step();
    expect(p.weapon).toBe('pistol');
  });

  it('consumes a latch once', () => {
    const { sim, state } = quietSim();
    const [p] = state.players;
    p.guns.pistol!.ammo = 4;
    sim.setInput('a', input({ seq: 1, reload: true }));
    sim.setInput('a', input({ seq: 2 }));
    steps(sim, 50);
    expect(p.reload).toBe(0);
    p.guns.pistol!.ammo = 4;
    sim.step();
    expect(p.reload).toBe(0);
    expect(eventsOf(sim.snapshot(), 'reload_start').length).toBe(1);
  });
});
