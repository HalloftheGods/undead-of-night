import { describe, expect, it } from 'vitest';
import { BLOATER_BURST_PLAYER_DAMAGE, PLAYER_RADIUS, TICK_RATE, ZOMBIES } from '../shared/constants.ts';
import { damageZombie } from '../shared/combat.ts';
import { WALL_THICKNESS } from '../shared/protocol.ts';
import type { PropInstance, ZombieType } from '../shared/protocol.ts';
import type { SimState } from '../shared/sim-state.ts';
import { GameSimulation } from '../shared/simulation.ts';
import { buildingAt, buildingBox, circleHitsSolid, doorBox, isSolidProp, propBox } from '../shared/world-map.ts';
import { addZombie, eventsOf, findBuilding, quietSim, stateOf, stepUntil, steps } from './helpers/sim-harness.ts';

/** Inside the fence on every side, with room to walk in. */
const STREET_MARGIN = 48;

describe('blows and walls', () => {
  /** A player just inside a house's west wall and a body pressed against the far side of it. */
  function acrossTheWall(type: ZombieType) {
    const quiet = quietSim();
    const [p] = quiet.state.players;
    const box = buildingBox(findBuilding(quiet.sim, 'house'));
    // In the back corner above the bed, on open floor beside the stairs.
    const y = box.y0 + 28;
    p.x = box.x0 + WALL_THICKNESS + PLAYER_RADIUS + 0.5;
    p.y = y;
    const zombie = addZombie(quiet.state, type, box.x0 - ZOMBIES[type].radius - 0.5, y);
    zombie.health = zombie.maxHealth = 1e6;
    return { ...quiet, p, zombie };
  }

  it('a brute cannot start a swing through a wall', () => {
    const { sim, p, zombie } = acrossTheWall('brute');
    expect(Math.hypot(p.x - zombie.x, p.y - zombie.y) - zombie.radius - PLAYER_RADIUS).toBeLessThanOrEqual(ZOMBIES.brute.reach);
    steps(sim, 10);
    expect(eventsOf(sim.snapshot(), 'zombie_attack').length).toBe(0);
    expect(p.health).toBe(p.maxHealth);
  });

  it('a swing already wound up cannot land through a wall', () => {
    const { sim, p, zombie } = acrossTheWall('brute');
    zombie.attacking = true;
    zombie.windupLeft = 0.05;
    steps(sim, 5);
    expect(p.health).toBe(p.maxHealth);
  });

  it('a brute in the same room still lands', () => {
    const { sim, state, p } = acrossTheWall('brute');
    state.zombies = [];
    addZombie(state, 'brute', p.x + 24, p.y);
    stepUntil(sim, () => p.health < p.maxHealth, TICK_RATE * 3);
    expect(p.health).toBe(p.maxHealth - ZOMBIES.brute.damage);
  });

  it('a wall shelters players and zombies from a burst', () => {
    const { sim, state, p, zombie: bloater } = acrossTheWall('bloater');
    const neighbour = addZombie(state, 'walker', p.x + 20, p.y);
    bloater.health = 1;
    damageZombie(state, bloater, 10, 0, 'a');
    expect(eventsOf(sim.snapshot(), 'bloater_burst').length).toBe(1);
    expect(p.health).toBe(p.maxHealth);
    expect(neighbour.health).toBe(neighbour.maxHealth);
  });

  it('a burst still reaches through a doorway', () => {
    const { sim, state } = quietSim();
    const [p] = state.players;
    const door = doorBox(findBuilding(sim, 'house'));
    const middle = (door.x0 + door.x1) / 2;
    p.x = middle;
    p.y = door.y0 - 14;
    const bloater = addZombie(state, 'bloater', middle, door.y1 + 14);
    bloater.health = 1;
    damageZombie(state, bloater, 10, 0, null);
    expect(p.health).toBe(p.maxHealth - BLOATER_BURST_PLAYER_DAMAGE);
  });
});

describe('closing the last few pixels', () => {
  /** Stands a player against the south-east corner of a solid, and sends a hunter from up the street. */
  function reachesBeside(sim: GameSimulation, state: SimState, prop: PropInstance): boolean {
    const [p] = state.players;
    const { map } = sim;
    const box = propBox(prop);
    const x = box.x1 - 1.7;
    const y = box.y1 + 7.3;
    const fromX = x + 60;
    const fromY = y - 60;
    const onStreet = fromX > STREET_MARGIN && fromY > STREET_MARGIN && fromX < map.width - STREET_MARGIN && fromY < map.height - STREET_MARGIN;
    const startsOutdoors = onStreet && !buildingAt(map, fromX, fromY);
    const placeable = startsOutdoors && !circleHitsSolid(map, x, y, PLAYER_RADIUS + 0.5) && !circleHitsSolid(map, fromX, fromY, 7);
    if (!placeable) return true;

    state.zombies = [];
    state.flow.invalidate();
    addZombie(state, 'walker', fromX, fromY);
    for (let tick = 0; tick < TICK_RATE * 20; tick++) {
      p.x = x;
      p.y = y;
      p.health = p.maxHealth;
      sim.step();
      if (p.health < p.maxHealth) return true;
    }
    return false;
  }

  it.each([6, 11, 23])('seed %i: a hunter reaches a player tucked against a solid, and swings', (seed) => {
    const sim = new GameSimulation({ seed });
    sim.addPlayer('a', 'a');
    const state = stateOf(sim);
    state.intermissionLeft = 1e6;
    state.pickups = [];
    state.populationTarget = 0;
    const outdoors = sim.map.props.filter((prop) => isSolidProp(prop) && !prop.kind.startsWith('fence') && !buildingAt(sim.map, prop.x, prop.y - 1));
    const sample = outdoors.filter((_, index) => index % 5 === 0).slice(0, 120);
    expect(sample.filter((prop) => !reachesBeside(sim, state, prop))).toEqual([]);
  }, 60000);
});
