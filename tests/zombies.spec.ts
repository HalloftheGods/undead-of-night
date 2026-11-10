import { describe, expect, it } from 'vitest';
import { characterOf } from '../shared/characters.ts';
import {
  BLOATER_BURST_PLAYER_DAMAGE,
  BLOATER_BURST_RADIUS,
  TICK_RATE,
  WEAPONS,
  ZOMBIES,
  ZOMBIE_INVESTIGATE_SEC,
  ZOMBIE_LOSE_INTEREST_SEC,
  ZOMBIE_SIGHT_RANGE,
  ZOMBIE_SLEEP_RANGE,
} from '../shared/constants.ts';
import { damageZombie } from '../shared/combat.ts';
import { DOOR_WIDTH } from '../shared/protocol.ts';
import type { ZombieType } from '../shared/protocol.ts';
import { GameSimulation } from '../shared/simulation.ts';
import { buildingBox, circleHitsSolid, doorBox } from '../shared/world-map.ts';
import { addRoamer, addZombie, clearWay, eventsOf, findBuilding, findProp, input, pointsAcross, quietSim, stateOf, stepUntil, steps } from './helpers/sim-harness.ts';

describe('pathing', () => {
  it.each<ZombieType>(['walker', 'runner', 'bloater', 'brute'])('a %s walks around a building with no back door to reach the player', (type) => {
    const { sim, state } = quietSim();
    const [p] = state.players;
    const diner = findBuilding(sim, 'diner');
    const { north, south } = pointsAcross(diner);
    p.x = south.x;
    p.y = south.y;
    const zombie = addZombie(state, type, north.x, north.y);
    zombie.health = zombie.maxHealth = 1e6;

    const box = buildingBox(diner);
    let insideBuilding = false;
    const ticks = stepUntil(
      sim,
      () => {
        const inX = zombie.x > box.x0 && zombie.x < box.x1;
        const inY = zombie.y > box.y0 && zombie.y < box.y1;
        insideBuilding ||= inX && inY;
        return Math.hypot(zombie.x - p.x, zombie.y - p.y) <= zombie.radius + 6 + zombie.reach;
      },
      3000,
    );
    expect(ticks).toBeGreaterThan(0);
    expect(insideBuilding).toBe(false);
  });

  it.each<ZombieType>(['walker', 'brute'])('a %s gets past a lamp post dead ahead', (type) => {
    const { sim, state } = quietSim();
    const [p] = state.players;
    // A lamp with open ground a body's width either side of the line past it.
    const lamp = sim.map.props.find((prop) => {
      if (prop.kind !== 'street_lamp') return false;
      const open = (x: number, y: number): boolean => Math.hypot(x - prop.x, y - prop.y) < 20 || !circleHitsSolid(sim.map, x, y, 12);
      for (let dx = -60; dx <= 100; dx += 10) for (let dy = -40; dy <= 36; dy += 12) if (!open(prop.x + dx, prop.y - 2 + dy)) return false;
      return true;
    }) ?? findProp(sim, 'street_lamp');
    p.x = lamp.x + 90;
    p.y = lamp.y - 2;
    const zombie = addZombie(state, type, lamp.x - 40, lamp.y - 2);
    zombie.health = zombie.maxHealth = 1e6;
    const ticks = stepUntil(sim, () => zombie.x > lamp.x + 12, 600);
    expect(ticks).toBeGreaterThan(0);
  });

  it('keeps following a player who moves to the other side', () => {
    const { sim, state } = quietSim();
    const [p] = state.players;
    const { north, south } = pointsAcross(findBuilding(sim, 'diner'));
    p.x = south.x;
    p.y = south.y;
    const zombie = addZombie(state, 'runner', north.x - 40, north.y);
    steps(sim, 45);
    p.x = north.x + 40;
    p.y = north.y;
    const ticks = stepUntil(sim, () => Math.hypot(zombie.x - p.x, zombie.y - p.y) < 22, 900);
    expect(ticks).toBeGreaterThan(-1);
  });

  it('spreads a crowd out instead of stacking it', () => {
    const { sim, state } = quietSim();
    const [p] = state.players;
    const { x, y } = p;
    const { dx, dy } = clearWay(state, 160);
    const crowd = Array.from({ length: 12 }, () => addZombie(state, 'walker', x + dx * 120, y + dy * 120));
    steps(sim, 90);
    let tooClose = 0;
    for (const a of crowd) {
      for (const b of crowd) {
        if (a !== b && Math.hypot(a.x - b.x, a.y - b.y) < 4) tooClose += 1;
      }
    }
    expect(tooClose).toBeLessThan(6);
    for (const z of crowd) expect(circleHitsSolid(state.map, z.x, z.y, z.radius)).toBe(false);
  });
});

describe('doors', () => {
  it.each<ZombieType>(['walker', 'runner', 'bloater', 'brute'])('a %s comes in through the door after a player indoors', (type) => {
    const { sim, state } = quietSim();
    const [p] = state.players;
    const clinic = findBuilding(sim, 'clinic');
    const door = doorBox(clinic);
    p.x = (door.x0 + door.x1) / 2;
    p.y = door.y0 - 30;
    const zombie = addZombie(state, type, door.x0 - 80, door.y1 + 24);
    zombie.health = zombie.maxHealth = 1e6;
    const ticks = stepUntil(sim, () => Math.hypot(zombie.x - p.x, zombie.y - p.y) <= zombie.radius + 6 + zombie.reach + 2, 2400);
    expect(ticks).toBeGreaterThan(0);
    expect(circleHitsSolid(state.map, zombie.x, zombie.y, zombie.radius)).toBe(false);
  });

  it('a player pressed against a wall from inside still draws zombies to the door, not the wall', () => {
    const { sim, state } = quietSim();
    const [p] = state.players;
    const room = buildingBox(findBuilding(sim, 'clinic'));
    p.x = room.x0 + 6 + 6.5;
    p.y = (room.y0 + room.y1) / 2 + 4;
    const zombie = addZombie(state, 'walker', room.x0 - 40, p.y);
    zombie.health = zombie.maxHealth = 1e6;
    const ticks = stepUntil(sim, () => Math.hypot(zombie.x - p.x, zombie.y - p.y) <= zombie.radius + 6 + zombie.reach + 2, 2400);
    expect(ticks).toBeGreaterThan(0);
  });

  it('a body wedged in a wall tile walks out on its own side', () => {
    const { sim, state } = quietSim();
    const [p] = state.players;
    const room = buildingBox(findBuilding(sim, 'clinic'));
    p.x = room.x1 + 12;
    p.y = (room.y0 + room.y1) / 2;
    const zombie = addZombie(state, 'walker', room.x1 - 6 - 6.5, p.y);
    zombie.health = zombie.maxHealth = 1e6;
    const ticks = stepUntil(sim, () => Math.hypot(zombie.x - p.x, zombie.y - p.y) <= zombie.radius + 6 + zombie.reach + 2 && zombie.x > room.x1, 2400);
    expect(ticks).toBeGreaterThan(0);
  });

  it('a brute fits through a door', () => {
    expect(ZOMBIES.brute.radius * 2).toBeLessThan(DOOR_WIDTH);
  });
});

describe('awareness', () => {
  function roamerBeside(distance: number) {
    const quiet = quietSim();
    const [p] = quiet.state.players;
    const zombie = addRoamer(quiet.state, 'walker', p.x + distance, p.y);
    zombie.speed = 0;
    return { ...quiet, p, zombie };
  }

  it('starts unaware, and stays so at a distance', () => {
    const { sim, zombie } = roamerBeside(ZOMBIE_SIGHT_RANGE + 40);
    expect(zombie.mode).toBe('wander');
    steps(sim, 3 * TICK_RATE);
    expect(zombie.mode).toBe('wander');
    expect(eventsOf(sim.snapshot(), 'zombie_alert').length).toBe(0);
  });

  it('notices a player in plain sight, once', () => {
    const { sim, zombie } = roamerBeside(ZOMBIE_SIGHT_RANGE * characterOf(0).sightRange - 30);
    steps(sim, 10);
    expect(zombie.mode).toBe('hunt');
    const alerts = eventsOf(sim.snapshot(), 'zombie_alert');
    expect(alerts.length).toBe(1);
    expect(alerts[0]).toMatchObject({ zombieId: zombie.id, zombieType: 'walker' });
    steps(sim, 30);
    expect(eventsOf(sim.snapshot(), 'zombie_alert').length).toBe(0);
  });

  it('does not see through a wall', () => {
    const { sim, state } = quietSim();
    const [p] = state.players;
    const room = buildingBox(findBuilding(sim, 'house'));
    p.x = room.x1 - 24;
    p.y = room.y1 + 8;
    const zombie = addRoamer(state, 'walker', room.x1 - 24, room.y1 - 24);
    zombie.speed = 0;
    steps(sim, 2 * TICK_RATE);
    expect(zombie.mode).toBe('wander');
  });

  it('sees in through the open door', () => {
    const { sim, state } = quietSim();
    const [p] = state.players;
    const door = doorBox(findBuilding(sim, 'house'));
    p.x = (door.x0 + door.x1) / 2;
    p.y = door.y1 + 40;
    const zombie = addRoamer(state, 'walker', p.x, door.y0 - 20);
    zombie.speed = 0;
    steps(sim, 10);
    expect(zombie.mode).toBe('hunt');
  });

  it.each(['pistol', 'carbine', 'shotgun'] as const)('hears the %s inside its radius, through walls, and not beyond', (weapon) => {
    const { sim, state } = quietSim();
    const [p] = state.players;
    p.skin = 1; // Bear: a normal noise radius, unlike the default survivor, Night
    const { noiseRadius, magSize } = WEAPONS[weapon];
    p.guns[weapon] = { ammo: magSize };
    p.owned = ['pistol', weapon];
    p.weapon = weapon;
    // A warehouse with the whole listening range on the map, shooting from whichever side has room,
    // level with it on a row where nothing in town stands on the shooter's spot or the far zombie's.
    const span = 2 * noiseRadius + 60;
    const spots = sim.map.buildings
      .filter((building) => building.kind === 'warehouse')
      .map(buildingBox)
      .flatMap((room) => ([1, -1] as const).map((side) => ({ room, side, face: side === 1 ? room.x1 : room.x0 })))
      .filter(({ face, side }) => face + side * span > 0 && face + side * span < sim.map.width)
      .flatMap(({ room, side, face }) => {
        const shooterX = face + side * (noiseRadius - 40);
        const rows = Array.from({ length: 9 }, (_, i) => room.y0 + 12 + ((room.y1 - room.y0 - 24) * i) / 8);
        rows.sort((a, c) => Math.abs(a - (room.y0 + room.y1) / 2) - Math.abs(c - (room.y0 + room.y1) / 2));
        const row = rows.find((y) => !circleHitsSolid(state.map, shooterX, y, 24) && !circleHitsSolid(state.map, shooterX, y + 30, 8));
        return row === undefined ? [] : [{ side, face, shooterX, row }];
      });
    const { side, face, shooterX, row } = spots[0];
    p.x = shooterX;
    p.y = row;
    const near = addRoamer(state, 'walker', face - side * 12, p.y);
    const far = addRoamer(state, 'walker', p.x + side * (noiseRadius + 30), p.y);
    near.speed = 0;
    far.speed = 0;
    sim.setInput('a', input({ seq: 1, shoot: true, angle: Math.PI / 2 }));
    sim.step();
    sim.setInput('a', input({ seq: 2 }));
    expect(near.mode).toBe('alert');
    expect(far.mode).toBe('wander');
    expect(eventsOf(sim.snapshot(), 'zombie_alert').map((event) => event.zombieId)).toEqual([near.id]);
  });

  it('a shot draws a zombie to where it was fired, not to the shooter', () => {
    const { sim, state } = quietSim();
    const [p] = state.players;
    const { x, y } = p;
    const zombie = addRoamer(state, 'runner', x + 180, y);
    sim.setInput('a', input({ seq: 1, shoot: true, angle: Math.PI }));
    sim.step();
    sim.setInput('a', input({ seq: 2 }));
    expect(zombie.mode).toBe('alert');
    p.x -= 400;
    steps(sim, 2 * TICK_RATE);
    const closed = Math.hypot(zombie.x - x, zombie.y - y);
    expect(closed).toBeLessThan(120);
    expect(zombie.mode).not.toBe('hunt');
  });

  it('gives up on a noise that leads nowhere', () => {
    const { sim, state } = quietSim();
    const [p] = state.players;
    const zombie = addRoamer(state, 'walker', p.x + 180, p.y);
    sim.setInput('a', input({ seq: 1, shoot: true, angle: Math.PI }));
    sim.step();
    sim.setInput('a', input({ seq: 2 }));
    p.x -= 400;
    const ticks = stepUntil(sim, () => zombie.mode === 'wander', (ZOMBIE_INVESTIGATE_SEC + 1) * TICK_RATE);
    expect(ticks).toBeGreaterThan(0);
  });

  it('loses interest once the player is out of sight, and goes back to roaming', () => {
    const { sim, zombie, p } = roamerBeside(100);
    steps(sim, 10);
    expect(zombie.mode).toBe('hunt');
    p.x += ZOMBIE_SIGHT_RANGE + 140;
    const ticks = stepUntil(sim, () => zombie.mode === 'wander', (ZOMBIE_LOSE_INTEREST_SEC + 1) * TICK_RATE);
    expect(ticks).toBeGreaterThanOrEqual((ZOMBIE_LOSE_INTEREST_SEC - 1) * TICK_RATE);
  });

  it('keeps hunting while it can see the player', () => {
    const { sim, zombie } = roamerBeside(100);
    steps(sim, (ZOMBIE_LOSE_INTEREST_SEC + 4) * TICK_RATE);
    expect(zombie.mode).toBe('hunt');
  });

  it('turns on whoever shoots it, seen or not', () => {
    const { sim, state } = quietSim();
    const [p] = state.players;
    const zombie = addRoamer(state, 'walker', p.x + ZOMBIE_SIGHT_RANGE + 60, p.y);
    damageZombie(state, zombie, 1, 0, 'a');
    expect(zombie.mode).toBe('hunt');
    expect(eventsOf(sim.snapshot(), 'zombie_alert').length).toBe(1);
  });

  it('there is no global homing: a live town leaves a quiet player alone', () => {
    // Level 2 on purpose: level 1 places three slow shamblers by the spawn so the first fight comes early.
    const sim = new GameSimulation({ seed: 6, startLevel: 2 });
    sim.addPlayer('a', 'a');
    const state = stateOf(sim);
    const before = state.players[0].health;
    steps(sim, 30 * TICK_RATE);
    expect(state.players[0].health).toBe(before);
    expect(state.zombies.filter((z) => z.mode !== 'wander').length).toBe(0);
  });
});

describe('roaming', () => {
  it('wanders around and rests', () => {
    const { sim, state } = quietSim();
    const [p] = state.players;
    const way = clearWay(state, 220, 12);
    const zombie = addRoamer(state, 'walker', p.x + way.dx * 220, p.y + way.dy * 220);
    const { x, y } = zombie;
    let moving = 0;
    let lastX = x;
    for (let tick = 0; tick < 20 * TICK_RATE; tick++) {
      sim.step();
      if (zombie.x !== lastX) moving += 1;
      lastX = zombie.x;
    }
    expect(moving).toBeGreaterThan(20);
    expect(moving).toBeLessThan(20 * TICK_RATE);
    expect(Math.hypot(zombie.x - x, zombie.y - y)).toBeGreaterThan(0);
    expect(zombie.mode).toBe('wander');
  });

  it('a zombie that starts indoors stays indoors until something draws it out', () => {
    const { sim, state } = quietSim();
    const [p] = state.players;
    const room = findBuilding(sim, 'grocery');
    const box = buildingBox(room);
    p.x = box.x0 - 400;
    p.y = box.y0 - 400;
    const zombie = addRoamer(state, 'walker', box.x0 + 40, box.y0 + 60);
    expect(zombie.home).toBe(room.id);
    for (let tick = 0; tick < 60 * TICK_RATE; tick++) {
      sim.step();
      expect(zombie.x).toBeGreaterThan(box.x0);
      expect(zombie.x).toBeLessThan(box.x1);
      expect(zombie.y).toBeGreaterThan(box.y0);
      expect(zombie.y).toBeLessThan(box.y1);
    }
  });

  it('sleeps far from everyone and wakes when someone comes near', () => {
    const { sim, state } = quietSim();
    const [p] = state.players;
    const zombie = addRoamer(state, 'walker', p.x + ZOMBIE_SLEEP_RANGE + 200, p.y);
    const { x, y } = zombie;
    steps(sim, 10 * TICK_RATE);
    expect([zombie.x, zombie.y]).toEqual([x, y]);
    p.x += 400;
    steps(sim, 10 * TICK_RATE);
    expect(Math.hypot(zombie.x - x, zombie.y - y)).toBeGreaterThan(0);
  });

  it('a hunter left far behind drops the chase', () => {
    const { sim, state } = quietSim();
    const [p] = state.players;
    const zombie = addRoamer(state, 'walker', p.x + 100, p.y);
    steps(sim, 10);
    expect(zombie.mode).toBe('hunt');
    p.x -= ZOMBIE_SLEEP_RANGE + 100;
    sim.step();
    expect(zombie.mode).toBe('wander');
  });
});

describe('attacks', () => {
  it('winds up, flags attacking, then lands', () => {
    const { sim, state } = quietSim();
    const [p] = state.players;
    const zombie = addZombie(state, 'walker', p.x + 14, p.y);
    sim.step();
    expect(zombie.attacking).toBe(true);
    expect(eventsOf(sim.snapshot(), 'zombie_attack').length).toBe(1);
    expect(p.health).toBe(p.maxHealth);

    steps(sim, Math.ceil(ZOMBIES.walker.windupSec * 30));
    expect(p.health).toBe(p.maxHealth - ZOMBIES.walker.damage);
    const hurt = eventsOf(sim.snapshot(), 'player_hurt');
    expect(hurt.length).toBe(1);
    expect(hurt[0].damage).toBe(ZOMBIES.walker.damage);

    steps(sim, 12);
    expect(zombie.attacking).toBe(false);
  });

  it('misses when the player steps out during the wind-up', () => {
    const { sim, state } = quietSim();
    const [p] = state.players;
    addZombie(state, 'walker', p.x + 14, p.y);
    sim.step();
    p.x -= 40;
    steps(sim, Math.ceil(ZOMBIES.walker.windupSec * 30));
    expect(p.health).toBe(p.maxHealth);
    expect(eventsOf(sim.snapshot(), 'player_hurt').length).toBe(0);
  });

  it('has a cooldown between swings', () => {
    const { sim, state } = quietSim();
    const [p] = state.players;
    addZombie(state, 'walker', p.x + 14, p.y);
    steps(sim, 60);
    const swings = eventsOf(sim.snapshot(), 'zombie_attack').length;
    expect(swings).toBeGreaterThanOrEqual(2);
    expect(swings).toBeLessThanOrEqual(2);
  });

  it('leaves downed players alone while someone else lives', () => {
    const { sim, state } = quietSim(['a', 'b']);
    const [a, b] = state.players;
    b.x = a.x + 120;
    a.status = 'downed';
    a.bleedout = 100;
    const zombie = addZombie(state, 'walker', a.x + 14, a.y);
    steps(sim, 10);
    expect(zombie.x).toBeGreaterThan(a.x + 14);
  });
});

describe('zombie types', () => {
  it('runners are faster and frailer than walkers, brutes are the toughest', () => {
    expect(ZOMBIES.runner.speed).toBeGreaterThan(ZOMBIES.walker.speed * 1.5);
    expect(ZOMBIES.runner.health).toBeLessThan(ZOMBIES.walker.health);
    expect(ZOMBIES.bloater.speed).toBeLessThan(ZOMBIES.walker.speed);
    expect(ZOMBIES.brute.health).toBeGreaterThan(ZOMBIES.bloater.health);
    expect(ZOMBIES.brute.radius).toBeGreaterThan(ZOMBIES.walker.radius);
  });

  it('a bloater bursts on death, hurting players and zombies nearby', () => {
    const { sim, state } = quietSim();
    const [p] = state.players;
    const bloater = addZombie(state, 'bloater', p.x + 30, p.y);
    const bystander = addZombie(state, 'walker', p.x + 50, p.y);
    const distant = addZombie(state, 'walker', p.x + 30 + BLOATER_BURST_RADIUS + 40, p.y);
    damageZombie(state, bloater, 1e6, 0, 'a');

    expect(p.health).toBe(p.maxHealth - BLOATER_BURST_PLAYER_DAMAGE);
    expect(bystander.health).toBeLessThan(bystander.maxHealth);
    expect(distant.health).toBe(distant.maxHealth);
    const snapshot = sim.snapshot();
    const [event] = eventsOf(snapshot, 'bloater_burst');
    expect(event.radius).toBe(BLOATER_BURST_RADIUS);
    expect(event.x).toBeCloseTo(bloater.x, 1);
    expect(eventsOf(snapshot, 'player_hurt').length).toBe(1);
  });

  it('chained bursts settle and credit the killer once per body', () => {
    const { sim, state } = quietSim();
    const [p] = state.players;
    const { dx, dy } = clearWay(state, 150);
    const chain = [0, 1, 2, 3].map((i) => addZombie(state, 'bloater', p.x + dx * (90 + i * 20), p.y + dy * (90 + i * 20)));
    for (const z of chain) z.health = 1;
    damageZombie(state, chain[0], 10, 0, 'a');
    expect(chain.every((z) => z.health === 0)).toBe(true);
    expect(p.kills).toBe(4);
    expect(eventsOf(sim.snapshot(), 'zombie_die').length).toBe(4);
  });

  it('scores the killer and removes the body', () => {
    const { sim, state } = quietSim();
    const [p] = state.players;
    const zombie = addZombie(state, 'runner', p.x + 200, p.y);
    damageZombie(state, zombie, 1e6, 0, 'a');
    sim.step();
    expect(state.zombies.length).toBe(0);
    expect(p.score).toBe(ZOMBIES.runner.points);
    expect(p.kills).toBe(1);
    const [death] = eventsOf(sim.snapshot(), 'zombie_die');
    expect(death.killerId).toBe('a');
    expect(death.points).toBe(ZOMBIES.runner.points);
  });
});
