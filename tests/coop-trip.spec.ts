import { describe, expect, it } from 'vitest';
import { REVIVE_RANGE, TICK_RATE, WEAPONS } from '../shared/constants.ts';
import { BUNKER_LEVEL, isBunkerMap } from '../shared/home-protocol.ts';
import type { Jewels } from '../shared/home-protocol.ts';
import { FIRST_LEVEL } from '../shared/levels.ts';
import { emptyLoadout, loadoutOf } from '../shared/loadout.ts';
import { hurtPlayer } from '../shared/player-health.ts';
import type { PlayerHome, PlayerState, SimState } from '../shared/sim-state.ts';
import type { GameSimulation } from '../shared/simulation.ts';
import { viewFor } from '../shared/snapshot-view.ts';
import { bankTrip, driveToTown, homeSim, playerNamed, quietTown, standAtVan, tripSim } from './helpers/home-harness.ts';
import { steps, surviveHorde, VAN_WAIT_TICKS } from './helpers/sim-harness.ts';

const GRACE_TICKS = 60 * TICK_RATE;
const NO_JEWELS: Jewels = { small: 0, large: 0 };

const homeOf = (p: PlayerState): PlayerHome => p.home as PlayerHome;

interface CoopTrip {
  readonly sim: GameSimulation;
  readonly state: SimState;
  readonly a: PlayerState;
  readonly b: PlayerState;
}

/** Two players with reconnect tokens, out in a town held still, one of them carrying. */
function coopTrip(): CoopTrip {
  const { sim, state } = homeSim({ players: [] });
  sim.addPlayer('a', 'a', 'token-a');
  sim.addPlayer('b', 'b', 'token-b');
  driveToTown(sim, state);
  quietTown(state);
  sim.snapshot();
  const b = playerNamed(state, 'b');
  homeOf(b).jewels = { small: 1, large: 1 };
  return { sim, state, a: playerNamed(state, 'a'), b };
}

function down(state: SimState, p: PlayerState): void {
  hurtPlayer(state, p, p.maxHealth * 2);
  expect(p.status).toBe('downed');
}

/** Downed with nobody coming, through to the end. Teammates start out together at the van, close enough to revive, so the rest step out of reach first. */
function bleedOut(sim: GameSimulation, state: SimState, p: PlayerState): void {
  down(state, p);
  for (const other of state.players) {
    if (other !== p) other.x = p.x + REVIVE_RANGE * 4;
  }
  p.bleedout = 0;
  sim.step();
  expect(p.status).toBe('dead');
}

const pilesOf = (state: SimState): string[] => state.pickups.map((item) => item.type).sort();

describe('what a client can see', () => {
  it('a client sees only its own receipt', () => {
    const { sim, state } = tripSim({ players: ['a', 'b'] });
    bankTrip(sim, state);
    const frame = sim.snapshot();
    const seenByA = viewFor(frame, 'a').players;
    expect(seenByA.find((p) => p.id === 'a')?.home?.receipt).toMatchObject({ outcome: 'banked' });
    expect(seenByA.find((p) => p.id === 'b')?.home?.receipt).toBeNull();
    expect(viewFor(frame, 'nobody').players.every((p) => p.home?.receipt === null)).toBe(true);
    expect(frame.players.every((p) => p.home?.receipt)).toBe(true);
  });

  it('leaves the rest of a teammate as it was', () => {
    const { sim, state } = tripSim({ players: ['a', 'b'] });
    bankTrip(sim, state);
    const frame = sim.snapshot();
    const seen = viewFor(frame, 'a').players.find((p) => p.id === 'b');
    const [, b] = frame.players;
    expect(seen).toEqual({ ...b, home: { ...b.home, receipt: null } });
  });
});

describe('a teammate down in town', () => {
  it('a teammate who dies spectates, returns with the kit, and what they find after banks', () => {
    const { sim, state, a, b } = coopTrip();
    b.guns = { carbine: { ammo: 20 } };
    b.owned = ['carbine'];
    b.weapon = 'carbine';
    bleedOut(sim, state, b);
    expect(homeOf(b)).toMatchObject({ silver: 0, jewels: NO_JEWELS, lost: { silver: 0, jewels: { small: 1, large: 1 } } });
    expect(pilesOf(state)).toEqual(['jewel_large', 'jewel_small']);
    expect(sim.level).toBe(FIRST_LEVEL);

    surviveHorde(sim, state);
    quietTown(state);
    expect(b.status).toBe('alive');
    expect(b.owned).toEqual(['pistol']);
    homeOf(b).jewels = { small: 1, large: 0 };
    bankTrip(sim, state);
    expect(homeOf(a).receipt).toMatchObject({ outcome: 'banked', silver: 0, jewels: NO_JEWELS });
    const receipt = homeOf(b).receipt;
    expect(receipt).toMatchObject({ outcome: 'banked', silver: 0, jewels: { small: 1, large: 0 } });
    expect(Object.keys(receipt?.gear?.guns ?? {})).toEqual(['pistol']);
  });

  it('a teammate still dead when the van leaves comes home with nothing', () => {
    const { sim, state, a, b } = coopTrip();
    bleedOut(sim, state, b);
    bankTrip(sim, state);
    expect(homeOf(b).receipt).toMatchObject({ outcome: 'died', silver: 0, jewels: { small: 1, large: 1 }, gear: null });
    expect(homeOf(a).receipt).toMatchObject({ outcome: 'banked' });
    expect(b).toMatchObject({ status: 'alive', health: b.maxHealth });
  });

  it('a revived player has not died and keeps everything', () => {
    const { sim, state, b } = coopTrip();
    down(state, b);
    b.status = 'alive';
    b.health = b.maxHealth / 2;
    bankTrip(sim, state);
    expect(homeOf(b).receipt).toMatchObject({ outcome: 'banked', jewels: { small: 1, large: 1 } });
  });

  it('downed when the van leaves counts as dead', () => {
    const { sim, state, a, b } = coopTrip();
    down(state, b);
    bankTrip(sim, state);
    expect(isBunkerMap(sim.map)).toBe(true);
    expect(homeOf(b).receipt).toMatchObject({ outcome: 'died', silver: 0, jewels: { small: 1, large: 1 }, gear: null });
    expect(homeOf(a).receipt).toMatchObject({ outcome: 'banked' });
    expect(loadoutOf(b)).toEqual(emptyLoadout());
    expect(homeOf(b)).toMatchObject({ silver: 0, jewels: NO_JEWELS });
  });

  it('unlocks nothing for someone who did not reach the van', () => {
    const { sim, state, a, b } = coopTrip();
    down(state, b);
    bankTrip(sim, state);
    expect(homeOf(a).highest).toBe(2);
    expect(homeOf(b).highest).toBe(FIRST_LEVEL);
    expect(state.homeRun?.roomHighest).toBe(2);
  });
});

describe('someone leaving mid-trip', () => {
  it('a disconnect drops carried treasure after 60 seconds, at once if downed, and gets no banked receipt', () => {
    const { sim, state, b } = coopTrip();
    sim.removePlayer('b');
    steps(sim, GRACE_TICKS - 1);
    expect(homeOf(b)).toMatchObject({ silver: 0, jewels: { small: 1, large: 1 } });
    expect(state.pickups).toEqual([]);
    sim.step();
    expect(homeOf(b)).toMatchObject({ silver: 0, jewels: NO_JEWELS, lost: { silver: 0, jewels: { small: 1, large: 1 } } });
    expect(pilesOf(state)).toEqual(['jewel_large', 'jewel_small']);
    bankTrip(sim, state);
    expect(homeOf(b).receipt).toMatchObject({ outcome: 'died', silver: 0, jewels: { small: 1, large: 1 }, gear: null });
  });

  it('a body that was downed lets go at once', () => {
    const { sim, state, b } = coopTrip();
    down(state, b);
    sim.removePlayer('b');
    expect(homeOf(b)).toMatchObject({ jewels: NO_JEWELS, lost: { jewels: { small: 1, large: 1 } } });
    expect(pilesOf(state)).toEqual(['jewel_large', 'jewel_small']);
    bankTrip(sim, state);
    expect(homeOf(b).receipt).toMatchObject({ outcome: 'died', jewels: { small: 1, large: 1 }, gear: null });
  });

  it('a body nobody can come back for lets go at once', () => {
    const { sim, state } = tripSim({ players: ['a', 'b'] });
    homeOf(playerNamed(state, 'b')).jewels = { small: 1, large: 0 };
    sim.removePlayer('b');
    expect(pilesOf(state)).toEqual(['jewel_small']);
  });

  it('counts anyone not back when the van leaves as left behind, with what they carried gone', () => {
    const { sim, state, b } = coopTrip();
    sim.removePlayer('b');
    bankTrip(sim, state);
    expect(homeOf(b).receipt).toMatchObject({ outcome: 'died', jewels: { small: 1, large: 1 }, gear: null });
    expect(sim.hasBodyFor('token-b')).toBe(true);
    sim.addPlayer('b2', 'b', 'token-b');
    const back = playerNamed(state, 'b2');
    expect(homeOf(back).receipt).toMatchObject({ outcome: 'died', silver: 0 });
    expect(loadoutOf(back)).toEqual(emptyLoadout());
    expect(back.status).toBe('alive');
    expect(sim.level).toBe(BUNKER_LEVEL);
  });

  it('a refresh inside the grace period keeps everything', () => {
    const { sim, state, b } = coopTrip();
    const gear = loadoutOf(b);
    sim.removePlayer('b');
    steps(sim, GRACE_TICKS - TICK_RATE);
    sim.addPlayer('b2', 'b', 'token-b');
    steps(sim, TICK_RATE * 2);
    const back = playerNamed(state, 'b2');
    expect(homeOf(back)).toMatchObject({ silver: 0, jewels: { small: 1, large: 1 }, lost: { silver: 0 }, leftTick: null });
    expect(loadoutOf(back)).toEqual(gear);
    expect(state.pickups).toEqual([]);
    bankTrip(sim, state);
    expect(homeOf(back).receipt).toMatchObject({ outcome: 'banked', jewels: { small: 1, large: 1 } });
  });

  it('a refresh after the grace period gets the body back without the treasure', () => {
    const { sim, state, b } = coopTrip();
    const gear = loadoutOf(b);
    sim.removePlayer('b');
    steps(sim, GRACE_TICKS + 1);
    sim.addPlayer('b2', 'b', 'token-b');
    const back = playerNamed(state, 'b2');
    expect(homeOf(back)).toMatchObject({ jewels: NO_JEWELS, lost: { jewels: { small: 1, large: 1 } } });
    expect(loadoutOf(back)).toEqual(gear);
  });

  it('a wipe takes the bodies left behind with it', () => {
    const { sim, state, a, b } = coopTrip();
    sim.removePlayer('b');
    a.status = 'dead';
    steps(sim, GRACE_TICKS + 1);
    expect(sim.level).toBe(BUNKER_LEVEL);
    expect(homeOf(b).receipt).toMatchObject({ outcome: 'died' });
    expect(homeOf(a).receipt).toMatchObject({ outcome: 'died' });
    expect(state.gameOver).toBeNull();
  });

  it('the last one standing refreshing in a room of the dead keeps the trip through the grace period', () => {
    const { sim, state, a, b } = coopTrip();
    homeOf(a).jewels = { small: 0, large: 2 };
    bleedOut(sim, state, b);
    sim.removePlayer('a');
    expect(sim.level).toBe(FIRST_LEVEL);
    expect(homeOf(a).receipt).toBeNull();
    steps(sim, GRACE_TICKS - 2);
    expect(sim.level).toBe(FIRST_LEVEL);
  });

  it('a refresh that gets the body back inside the grace period banks', () => {
    const { sim, state, a, b } = coopTrip();
    homeOf(a).jewels = { small: 0, large: 2 };
    bleedOut(sim, state, b);
    sim.removePlayer('a');
    steps(sim, 5 * TICK_RATE);
    sim.addPlayer('a2', 'a', 'token-a');
    const back = playerNamed(state, 'a2');
    expect(homeOf(back).jewels).toEqual({ small: 0, large: 2 });
    bankTrip(sim, state);
    expect(homeOf(back).receipt).toMatchObject({ outcome: 'banked', jewels: { small: 0, large: 2 } });
  });

  it('the last one standing leaving a room of the dead wipes it once the grace period ends', () => {
    const { sim, state, b } = coopTrip();
    bleedOut(sim, state, b);
    sim.removePlayer('a');
    steps(sim, GRACE_TICKS + 1);
    expect(sim.level).toBe(BUNKER_LEVEL);
    expect(homeOf(b).receipt).toMatchObject({ outcome: 'died' });
  });
});

describe('a banked receipt nobody has applied yet', () => {
  /** b banks, then a takes the van again while b is dropped or idle in the bunker. */
  function bankedThenTripAgain(bStaysConnected: boolean) {
    const { sim, state, b } = coopTrip();
    bankTrip(sim, state);
    const receipt = homeOf(b).receipt;
    expect(receipt).toMatchObject({ outcome: 'banked', jewels: { small: 1, large: 1 } });
    if (!bStaysConnected) sim.removePlayer('b');
    const a = playerNamed(state, 'a');
    sim.homeCommand('a', { kind: 'pick_level', level: FIRST_LEVEL });
    sim.homeCommand('a', { kind: 'ready', ready: true });
    standAtVan(state, a);
    if (bStaysConnected) {
      sim.homeCommand('b', { kind: 'ready', ready: true });
      standAtVan(state, playerNamed(state, 'b'));
    }
    steps(sim, VAN_WAIT_TICKS);
    expect(sim.level).toBe(FIRST_LEVEL);
    return { sim, state, receipt };
  }

  it('survives a body dropped in the bunker being forgotten when the van leaves', () => {
    const { sim, state, receipt } = bankedThenTripAgain(false);
    expect(sim.hasBodyFor('token-b')).toBe(false);
    sim.addPlayer('b2', 'b', 'token-b');
    expect(homeOf(playerNamed(state, 'b2')).receipt).toEqual(receipt);
  });

  it('survives a connected body whose receipt the next trip clears', () => {
    const { sim, state, receipt } = bankedThenTripAgain(true);
    expect(homeOf(playerNamed(state, 'b')).receipt).toBeNull();
    sim.removePlayer('b');
    sim.addPlayer('b2', 'b', 'token-b');
    expect(homeOf(playerNamed(state, 'b2')).receipt).toEqual(receipt);
  });
});

describe('leaving the bunker', () => {
  it('does not keep a body that left the bunker unready, so it comes back as a newcomer', () => {
    const { sim, state } = homeSim({ players: [] });
    sim.addPlayer('a', 'a', 'token-a');
    sim.addPlayer('b', 'b', 'token-b');
    sim.removePlayer('b');
    expect(sim.hasBodyFor('token-b')).toBe(false);
    driveToTown(sim, state);
    expect(sim.level).toBe(FIRST_LEVEL);
    expect(sim.hasBodyFor('token-b')).toBe(false);
  });

  it('takes a body that was ready when it dropped, and it can be picked up in town', () => {
    const { sim, state } = homeSim({ players: [] });
    sim.addPlayer('a', 'a', 'token-a');
    sim.addPlayer('b', 'b', 'token-b');
    const b = playerNamed(state, 'b');
    sim.homeCommand('b', { kind: 'ready', ready: true });
    sim.removePlayer('b');
    driveToTown(sim, state);
    expect(sim.hasBodyFor('token-b')).toBe(true);
    sim.addPlayer('b2', 'b', 'token-b');
    const back = playerNamed(state, 'b2');
    expect(back.x).toBe(b.x);
    expect(homeOf(back).ready).toBe(false);
    expect(back.owned).toEqual(['pistol']);
  });

  it('does not wait for someone who has left', () => {
    const { sim, state } = homeSim({ players: [] });
    sim.addPlayer('a', 'a', 'token-a');
    sim.addPlayer('b', 'b', 'token-b');
    sim.homeCommand('a', { kind: 'pick_level', level: FIRST_LEVEL });
    sim.homeCommand('a', { kind: 'ready', ready: true });
    standAtVan(state, playerNamed(state, 'a'));
    sim.removePlayer('b');
    steps(sim, VAN_WAIT_TICKS);
    expect(sim.level).toBe(FIRST_LEVEL);
  });
});

describe('someone joining mid-trip', () => {
  const gear = { ...emptyLoadout(), guns: { carbine: {} }, ammoBag: { pistol: 0, carbine: 30, shotgun: 0 }, medkits: 1 };

  it('lands in town at full health with what they have in hand', () => {
    const { sim, state } = coopTrip();
    sim.addPlayer('c', 'c', 'token-c', undefined, { loadout: gear, highest: FIRST_LEVEL });
    const c = playerNamed(state, 'c');
    expect(loadoutOf(c)).toEqual(gear);
    expect(c.health).toBe(c.maxHealth);
    expect(homeOf(c).receipt).toBeNull();
  });

  it('gets the free pistol if they brought no gun', () => {
    const { sim, state } = coopTrip();
    sim.addPlayer('c', 'c', 'token-c', undefined, { loadout: { ...emptyLoadout(), knife: true }, highest: FIRST_LEVEL });
    const c = playerNamed(state, 'c');
    expect(c.owned).toEqual(['pistol']);
    expect(c.guns.pistol?.ammo).toBe(WEAPONS.pistol.magSize);
    expect(c.knife).toBe(true);
  });

  it('banks what they took out like anyone aboard', () => {
    const { sim, state } = coopTrip();
    sim.addPlayer('c', 'c', 'token-c', undefined, { loadout: gear, highest: FIRST_LEVEL });
    bankTrip(sim, state);
    expect(homeOf(playerNamed(state, 'c')).receipt?.gear).toEqual(gear);
  });
});

describe('an emptied room', () => {
  it('goes back to the bunker with every body counted as dead', () => {
    const { sim, state } = coopTrip();
    sim.removePlayer('a');
    sim.removePlayer('b');
    sim.restart();
    expect(sim.level).toBe(BUNKER_LEVEL);
    expect(isBunkerMap(sim.map)).toBe(true);
    expect(sim.hasBodyFor('token-a')).toBe(false);
    expect(sim.hasBodyFor('token-b')).toBe(false);
    expect(state.homeRun).toMatchObject({ tripLevel: null, pickedLevel: null, roomHighest: FIRST_LEVEL });
    sim.addPlayer('c', 'c', 'token-c');
    steps(sim, TICK_RATE);
    expect(sim.level).toBe(BUNKER_LEVEL);
  });

  it('takes a new town for the next trip, whoever starts it', () => {
    const { sim, state } = coopTrip();
    const firstTown = sim.map.seed;
    sim.removePlayer('a');
    sim.removePlayer('b');
    sim.restart();
    sim.addPlayer('c', 'c', 'token-c');
    driveToTown(sim, state);
    expect(sim.map.seed).not.toBe(firstTown);
  });
});
