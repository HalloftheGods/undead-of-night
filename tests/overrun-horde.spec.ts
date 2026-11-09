import { describe, expect, it } from 'vitest';
import { CHEST_STATION } from '../shared/bunker-map.ts';
import { damageZombie } from '../shared/combat.ts';
import { TICK_RATE, ZOMBIE_CAP } from '../shared/constants.ts';
import type { DifficultyId } from '../shared/difficulty.ts';
import type { Loadout } from '../shared/home-protocol.ts';
import { levelDef } from '../shared/levels.ts';
import { emptyLoadout, loadoutOf } from '../shared/loadout.ts';
import { OVERRUN_ARM_FRACTION, OVERRUN_CLOCK_SEC, OVERRUN_HORDE_MAX, OVERRUN_HORDE_SCALE } from '../shared/overrun.ts';
import { hurtPlayer } from '../shared/player-health.ts';
import { TILE_SIZE } from '../shared/protocol.ts';
import type { GameEvent } from '../shared/protocol.ts';
import type { PlayerState, SimState } from '../shared/sim-state.ts';
import { GameSimulation } from '../shared/simulation.ts';
import type { SimulationOptions } from '../shared/simulation.ts';
import { spawnZombie, waveRoster } from '../shared/waves.ts';
import { bankTrip, driveToTown, playerNamed, quietTown, standAtStation, standAtVan } from './helpers/home-harness.ts';
import { input, SEED, stateOf, stepUntil, steps, VAN_WAIT_TICKS } from './helpers/sim-harness.ts';

interface RoomOptions extends Partial<SimulationOptions> {
  readonly highest?: number;
  readonly players?: readonly string[];
}

/** A pistol with rounds and a medkit: something in hand for a death to take. */
const ARMED: Loadout = { ...emptyLoadout(), guns: { pistol: {} }, ammoBag: { pistol: 20, carbine: 0, shotgun: 0 }, medkits: 1 };

/** A home room with its clock running, everyone holding `ARMED`. */
function overrunRoom(options: RoomOptions = {}): { sim: GameSimulation; state: SimState } {
  const { highest = 2, players = ['a'], ...simOptions } = options;
  const sim = new GameSimulation({ seed: SEED, overrun: true, ...simOptions, home: true });
  for (const id of players) sim.addPlayer(id, id, null, undefined, { loadout: ARMED, highest });
  sim.snapshot();
  return { sim, state: stateOf(sim) };
}

const SECONDS = (n: number): number => n * TICK_RATE;
const homeOf = (p: PlayerState): NonNullable<PlayerState['home']> => p.home as NonNullable<PlayerState['home']>;
const overrunOf = (state: SimState): NonNullable<SimState['overrun']> => state.overrun as NonNullable<SimState['overrun']>;
const hordeOf = (state: SimState) => state.zombies.filter((z) => z.horde);

/** Runs the clock out on the next tick. */
function breachNow(sim: GameSimulation, state: SimState): GameEvent[] {
  overrunOf(state).left = 1e-6;
  sim.step();
  return [...state.events];
}

/** Nobody in the room can be hurt to death, so a test can watch the horde. */
function unkillable(state: SimState): void {
  for (const p of state.players) {
    p.maxHealth = 1e9;
    p.health = 1e9;
  }
}

/** Every zombie still to come is through the door. */
function letAllIn(sim: GameSimulation, state: SimState): void {
  expect(stepUntil(sim, () => overrunOf(state).queue.length === 0, SECONDS(OVERRUN_HORDE_MAX))).toBeGreaterThanOrEqual(0);
}

/** The rest of the room shoots the horde down. */
function clearHorde(sim: GameSimulation, state: SimState): void {
  letAllIn(sim, state);
  for (const z of hordeOf(state)) z.health = 0;
  sim.step();
}

/** Inclusive tile bounds, as the bunker map draws its rooms. */
interface TileArea {
  readonly col0: number;
  readonly row0: number;
  readonly col1: number;
  readonly row1: number;
}

const inTiles = (x: number, y: number, area: TileArea): boolean => {
  const col = Math.floor(x / TILE_SIZE);
  const row = Math.floor(y / TILE_SIZE);
  return col >= area.col0 && col <= area.col1 && row >= area.row0 && row <= area.row1;
};
const HALL: TileArea = { col0: 1, row0: 1, col1: 24, row1: 10 };
const QUARTERS: TileArea = { col0: 13, row0: 12, col1: 24, row1: 22 };

describe('the breach', () => {
  const difficulties: readonly DifficultyId[] = ['lights_out', 'undead_tired'];
  for (const difficulty of difficulties) {
    for (const highest of [1, 5, 10]) {
      it(`sends the hardest horde of level ${highest} on ${difficulty}, cut to the bunker's floor`, () => {
        const { sim, state } = overrunRoom({ difficulty });
        (state.homeRun as NonNullable<SimState['homeRun']>).roomHighest = highest;
        unkillable(state);
        state.merchants = [];
        const level = levelDef(highest);
        const size = Math.min(OVERRUN_HORDE_MAX, ZOMBIE_CAP, waveRoster(level.hordes, () => 0.5, level, difficulty, OVERRUN_HORDE_SCALE).length);
        const events = breachNow(sim, state);
        expect(events).toContainEqual({ type: 'overrun_breach', hostiles: size });
        expect(overrunOf(state)).toMatchObject({ phase: 'breached', total: size });
        expect(state.wave).toBe(level.hordes);
        letAllIn(sim, state);
        const horde = hordeOf(state);
        expect(horde).toHaveLength(size);
        expect(horde.every((z) => z.mode === 'hunt')).toBe(true);
      });
    }
  }

  it('brings every zombie in through the hall, and the flow field leads them all to the quarters', () => {
    const { sim, state } = overrunRoom();
    const me = playerNamed(state, 'a');
    expect(inTiles(state.map.spawn.x, state.map.spawn.y, QUARTERS)).toBe(true);
    me.x = state.map.spawn.x;
    me.y = state.map.spawn.y;
    unkillable(state);
    // The merchants would hold the hall: this is about the way through it.
    state.merchants = [];
    breachNow(sim, state);
    expect(overrunOf(state).total).toBeGreaterThan(0);
    const cameIn = new Map<string, boolean>();
    const reached = new Set<string>();
    for (let t = 0; t < SECONDS(90) && (cameIn.size < overrunOf(state).total || reached.size < cameIn.size); t++) {
      for (const z of hordeOf(state)) {
        const justIn = !cameIn.has(z.id);
        if (justIn) cameIn.set(z.id, inTiles(z.x, z.y, HALL));
        const inQuarters = inTiles(z.x, z.y, QUARTERS);
        if (inQuarters) reached.add(z.id);
      }
      sim.step();
    }
    expect(cameIn.size).toBe(overrunOf(state).total);
    expect([...cameIn.values()].every(Boolean)).toBe(true);
    expect(reached.size).toBe(cameIn.size);
  });

  it('closes every open station once, and keeps the merchants shuttered while the horde is in', () => {
    const { sim, state } = overrunRoom();
    const me = playerNamed(state, 'a');
    unkillable(state);
    standAtStation(state, me, 'locker');
    homeOf(me).station = 'locker';
    breachNow(sim, state);
    expect(homeOf(me).station).toBeNull();
    standAtStation(state, me, 'gunsmith');
    sim.setInput('a', input({ seq: 1, search: true }));
    steps(sim, SECONDS(1));
    expect(homeOf(me).station).toBeNull();
    sim.setInput('a', input({ seq: 2 }));
    sim.step();
    standAtStation(state, me, 'locker');
    sim.setInput('a', input({ seq: 3, search: true }));
    expect(stepUntil(sim, () => homeOf(me).station === 'locker', SECONDS(1))).toBeGreaterThanOrEqual(0);
  });
});

describe('the gun rule', () => {
  /** Fires for a second and says whether a round left the gun. */
  function fires(sim: GameSimulation, me: PlayerState, seq: number): boolean {
    const before = me.ammo;
    sim.setInput('a', input({ seq, shoot: true }));
    steps(sim, SECONDS(1));
    sim.setInput('a', input({ seq: seq + 1 }));
    return me.ammo < before;
  }

  it('holds fire while counting, frees it from armed, and holds it again once the room holds', () => {
    const { sim, state } = overrunRoom();
    const me = playerNamed(state, 'a');
    unkillable(state);
    expect(fires(sim, me, 1)).toBe(false);
    overrunOf(state).left = OVERRUN_CLOCK_SEC * OVERRUN_ARM_FRACTION + 0.5;
    steps(sim, SECONDS(1));
    expect(overrunOf(state).phase).toBe('armed');
    expect(fires(sim, me, 3)).toBe(true);
    breachNow(sim, state);
    clearHorde(sim, state);
    expect(overrunOf(state).phase).toBe('held');
    me.ammo = me.magSize;
    expect(fires(sim, me, 5)).toBe(false);
  });

  it('holds fire as always with the switch off', () => {
    const { sim, state } = overrunRoom({ overrun: false });
    expect(state.overrun).toBeNull();
    expect(fires(sim, playerNamed(state, 'a'), 1)).toBe(false);
  });
});

describe('going down in the bunker', () => {
  it('solo: the bunker falls, the gear in hand is gone, and the horde goes back out', () => {
    const { sim, state } = overrunRoom();
    const me = playerNamed(state, 'a');
    const hands = loadoutOf(me);
    breachNow(sim, state);
    steps(sim, SECONDS(3));
    hurtPlayer(state, me, me.maxHealth);
    expect(me.status).toBe('dead');
    state.events.length = 0;
    sim.step();
    expect(state.events).toContainEqual({ type: 'overrun_end', outcome: 'lost' });
    expect(overrunOf(state).phase).toBe('lost');
    const receipt = homeOf(me).overrun;
    expect(receipt).toMatchObject({ outcome: 'died', chest: null, silver: 0, share: 0 });
    expect(receipt?.lost).toEqual(hands);
    expect(receipt?.simId).toBe(state.homeRun?.simId);
    expect(loadoutOf(me)).toEqual(emptyLoadout());
    expect(me).toMatchObject({ status: 'alive', health: me.maxHealth });
    expect(hordeOf(state)).toHaveLength(0);
    expect(overrunOf(state).queue).toHaveLength(0);
    steps(sim, SECONDS(2));
    expect(overrunOf(state).phase).toBe('lost');
    expect(homeOf(me).overrun).toBe(receipt);
  });

  it('co-op: one dies and is written off at once, the other clears the horde, and both stand at the end', () => {
    const { sim, state } = overrunRoom({ players: ['a', 'b'] });
    const a = playerNamed(state, 'a');
    const b = playerNamed(state, 'b');
    const handsOfA = loadoutOf(a);
    const handsOfB = loadoutOf(b);
    breachNow(sim, state);
    a.maxHealth = 1e9;
    a.health = 1e9;
    a.x = state.map.spawn.x;
    a.y = state.map.spawn.y;
    b.x = state.map.width - 2 * TILE_SIZE;
    b.y = state.map.height - 2 * TILE_SIZE;
    hurtPlayer(state, b, b.maxHealth);
    expect(b.status).toBe('downed');
    b.bleedout = 1e-6;
    sim.step();
    expect(b.status).toBe('dead');
    expect(homeOf(b).overrun).toMatchObject({ outcome: 'died', chest: null });
    expect(homeOf(b).overrun?.lost).toEqual(handsOfB);
    expect(loadoutOf(b)).toEqual(emptyLoadout());
    const serial = homeOf(b).overrun?.serial;
    steps(sim, SECONDS(2));
    expect(b.status).toBe('dead');
    expect(homeOf(b).overrun?.serial).toBe(serial);
    state.events.length = 0;
    clearHorde(sim, state);
    expect(state.events).toContainEqual({ type: 'overrun_end', outcome: 'held' });
    expect(overrunOf(state)).toMatchObject({ phase: 'held', kills: overrunOf(state).total });
    expect(a.status).toBe('alive');
    expect(b).toMatchObject({ status: 'alive', health: b.maxHealth });
    expect(Math.hypot(b.x - state.map.spawn.x, b.y - state.map.spawn.y)).toBeLessThan(4 * TILE_SIZE);
    expect(homeOf(a).overrun).toBeNull();
    expect(loadoutOf(a)).toEqual(handsOfA);
  });

  it('keeps the died receipt through the next trip, and clears it when the room comes home', () => {
    const { sim, state } = overrunRoom();
    const me = playerNamed(state, 'a');
    breachNow(sim, state);
    hurtPlayer(state, me, me.maxHealth);
    sim.step();
    const receipt = homeOf(me).overrun;
    expect(receipt?.outcome).toBe('died');
    driveToTown(sim, state);
    expect(state.homeRun?.tripLevel).toBe(1);
    expect(homeOf(me).overrun).toBe(receipt);
    quietTown(state);
    bankTrip(sim, state);
    expect(state.homeRun?.tripLevel).toBeNull();
    expect(homeOf(me).overrun).toBeNull();
    expect(overrunOf(state)).toMatchObject({ phase: 'counting', left: OVERRUN_CLOCK_SEC });
  });
});

describe('the van leaving mid-horde with bodies down', () => {
  it('stands the downed and the dead up in town with the free pistol, and they do not die there', () => {
    const { sim, state } = overrunRoom({ players: ['a', 'b', 'c'] });
    const [a, b, c] = ['a', 'b', 'c'].map((id) => playerNamed(state, id));
    breachNow(sim, state);
    a.maxHealth = 1e9;
    a.health = 1e9;
    const farCorner = (p: PlayerState, rows: number): void => {
      p.x = state.map.width - 2 * TILE_SIZE;
      p.y = state.map.height - rows * TILE_SIZE;
    };
    farCorner(c, 2);
    hurtPlayer(state, c, c.maxHealth);
    c.bleedout = 1e-6;
    sim.step();
    expect(c.status).toBe('dead');
    farCorner(b, 6);
    hurtPlayer(state, b, b.maxHealth);
    b.bleedout = 1e6;
    expect(b.status).toBe('downed');

    const level = 1;
    sim.homeCommand(a.id, { kind: 'pick_level', level });
    standAtVan(state, a);
    sim.homeCommand(a.id, { kind: 'ready', ready: true });
    steps(sim, VAN_WAIT_TICKS);
    expect(state.homeRun?.tripLevel).toBe(level);

    expect(homeOf(a).overrun?.outcome).toBe('fled');
    for (const body of [b, c]) {
      expect(homeOf(body).overrun?.outcome, body.id).toBe('died');
      expect(body, body.id).toMatchObject({ status: 'alive', health: body.maxHealth });
      expect(body.guns.pistol, body.id).toBeDefined();
    }
    quietTown(state);
    steps(sim, SECONDS(5));
    for (const body of [b, c]) expect(body.status, body.id).toBe('alive');
  });
});

describe('kill drops', () => {
  /** Every roll lands, so any kill that rolls for a drop drops one. */
  const everyRollDrops = (state: SimState): void => {
    (state as { rng: () => number }).rng = () => 0;
  };

  it('the bunker horde drops nothing when it dies: the chest is the reward', () => {
    const { sim, state } = overrunRoom();
    unkillable(state);
    breachNow(sim, state);
    letAllIn(sim, state);
    everyRollDrops(state);
    const me = playerNamed(state, 'a');
    const before = state.pickups.length;
    for (const z of hordeOf(state)) damageZombie(state, z, 1e9, 0, me.id);
    expect(state.pickups).toHaveLength(before);
  });

  it('a town horde still drops as it always has', () => {
    const { sim, state } = overrunRoom();
    driveToTown(sim, state);
    quietTown(state);
    everyRollDrops(state);
    const me = playerNamed(state, 'a');
    spawnZombie(state, 'walker', me.x + 2 * TILE_SIZE, me.y);
    const z = state.zombies[state.zombies.length - 1];
    z.horde = true;
    damageZombie(state, z, 1e9, 0, me.id);
    expect(state.overrun).toBeNull();
    expect(state.pickups).toHaveLength(1);
  });
});

describe('the chest', () => {
  function holdAtChest(sim: GameSimulation, me: PlayerState, seq: number): boolean {
    me.x = CHEST_STATION.x;
    me.y = CHEST_STATION.y;
    sim.setInput('a', input({ seq, search: true }));
    steps(sim, SECONDS(1));
    const opened = homeOf(me).overrun?.outcome === 'held';
    sim.setInput('a', input({ seq: seq + 1 }));
    sim.step();
    return opened;
  }

  it('opens only after the room holds', () => {
    const { sim, state } = overrunRoom();
    const me = playerNamed(state, 'a');
    unkillable(state);
    expect(holdAtChest(sim, me, 1)).toBe(false);
    breachNow(sim, state);
    expect(holdAtChest(sim, me, 3)).toBe(false);
    clearHorde(sim, state);
    expect(overrunOf(state).phase).toBe('held');
    expect(holdAtChest(sim, me, 5)).toBe(true);
  });
});
