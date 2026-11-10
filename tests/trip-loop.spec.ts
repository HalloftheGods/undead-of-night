import { describe, expect, it } from 'vitest';
import { EXIT_RADIUS, TICK_RATE, WEAPONS } from '../shared/constants.ts';
import { BUNKER_LEVEL, BUNKER_SEED, isBunkerMap } from '../shared/home-protocol.ts';
import type { TripReceipt } from '../shared/home-protocol.ts';
import { FINAL_LEVEL, FIRST_LEVEL, levelDef, levelSeed } from '../shared/levels.ts';
import { applyLoadout, emptyLoadout, loadoutOf } from '../shared/loadout.ts';
import { hurtPlayer } from '../shared/player-health.ts';
import type { PlayerState, SimState } from '../shared/sim-state.ts';
import { bankTrip, driveToTown, homeSim, quietTown, standAtStation, standAtVan, tripSim } from './helpers/home-harness.ts';
import { eventsOf, input, SEED, steps, surviveHorde, VAN_WAIT_TICKS } from './helpers/sim-harness.ts';

const IDLE_TICKS = 60 * TICK_RATE;

const receiptOf = (p: PlayerState): TripReceipt => {
  const receipt = p.home?.receipt;
  if (!receipt) throw new Error(`${p.id} has no receipt`);
  return receipt;
};

/** Everyone standing takes a mortal wound, with nobody left to save them. */
function wipeOut(state: SimState): void {
  for (const p of state.players) {
    hurtPlayer(state, p, p.maxHealth * 2);
    p.bleedout = 0;
  }
}

describe('the bunker', () => {
  it('starts in the bunker with no zombies, no waves, and sim.level 0', () => {
    const { sim, state } = homeSim();
    steps(sim, TICK_RATE * 200);
    expect(isBunkerMap(sim.map)).toBe(true);
    expect(sim.level).toBe(BUNKER_LEVEL);
    expect(state.zombies).toEqual([]);
    expect(state.wave).toBe(0);
    expect(sim.phase).toBe('intermission');
  });

  it('has the van parked and waiting from the start', () => {
    const { sim, state } = homeSim();
    expect(state.exit).toMatchObject({ x: sim.map.exit?.x, y: sim.map.exit?.y, hold: 0 });
    expect(sim.snapshot().exit).not.toBeNull();
  });

  it('arriving in the bunker heals to full', () => {
    const { sim, state } = tripSim();
    const [p] = state.players;
    p.health = 1;
    bankTrip(sim, state);
    expect(isBunkerMap(sim.map)).toBe(true);
    expect(p.health).toBe(p.maxHealth);
  });

  it('guns cannot fire in the bunker', () => {
    const { sim, state } = homeSim();
    const [p] = state.players;
    const loaded = p.ammo;
    sim.setInput('a', input({ seq: 1, shoot: true }));
    steps(sim, TICK_RATE);
    const frame = sim.snapshot();
    expect(state.bullets).toEqual([]);
    expect(p.ammo).toBe(loaded);
    expect(eventsOf(frame, 'shot')).toEqual([]);
    expect(eventsOf(frame, 'dry_fire')).toEqual([]);
  });

  it('keeps bottles and shoves for the towns', () => {
    const { sim, state } = homeSim();
    const [p] = state.players;
    const bottles = p.bottles;
    sim.setInput('a', input({ seq: 1, throw: true, melee: true }));
    steps(sim, 2);
    const frame = sim.snapshot();
    expect(p.bottles).toBe(bottles);
    expect(eventsOf(frame, 'melee')).toEqual([]);
  });

  it('gives the guns back in town', () => {
    const { sim, state } = tripSim();
    sim.setInput('a', input({ seq: 1, shoot: true }));
    steps(sim, 2);
    expect(state.players[0].ammo).toBeLessThan(WEAPONS.pistol.magSize);
  });
});

describe('the van in the bunker', () => {
  it('the van leaves only when every counted player is ready for 2 seconds, and needs a picked level', () => {
    const { sim, state } = homeSim({ players: ['a', 'b'] });
    const [a, b] = state.players;
    const stillHome = (): void => expect(sim.level).toBe(BUNKER_LEVEL);
    standAtVan(state, a);
    standAtVan(state, b);
    sim.homeCommand('a', { kind: 'ready', ready: true });
    sim.homeCommand('b', { kind: 'ready', ready: true });
    steps(sim, VAN_WAIT_TICKS * 2);
    stillHome();

    sim.homeCommand('a', { kind: 'pick_level', level: FIRST_LEVEL });
    sim.homeCommand('b', { kind: 'ready', ready: false });
    steps(sim, VAN_WAIT_TICKS * 2);
    stillHome();

    sim.homeCommand('b', { kind: 'ready', ready: true });
    steps(sim, VAN_WAIT_TICKS - 1);
    stillHome();
    sim.step();
    expect(sim.level).toBe(FIRST_LEVEL);
  });

  it('starts the wait over for anyone who steps away', () => {
    const { sim, state } = homeSim();
    const [p] = state.players;
    sim.homeCommand('a', { kind: 'pick_level', level: FIRST_LEVEL });
    sim.homeCommand('a', { kind: 'ready', ready: true });
    standAtVan(state, p);
    steps(sim, VAN_WAIT_TICKS - 2);
    p.x -= EXIT_RADIUS * 2;
    sim.step();
    expect(state.exit?.hold).toBe(0);
    standAtVan(state, p);
    steps(sim, VAN_WAIT_TICKS - 1);
    expect(sim.level).toBe(BUNKER_LEVEL);
  });

  it('a player with no keys and no station for 60 seconds stops counting and rides along', () => {
    const { sim, state } = homeSim({ players: ['a', 'b'] });
    const [a, b] = state.players;
    sim.homeCommand('a', { kind: 'pick_level', level: FIRST_LEVEL });
    sim.homeCommand('a', { kind: 'ready', ready: true });
    standAtVan(state, a);
    steps(sim, IDLE_TICKS - 1);
    expect(sim.level).toBe(BUNKER_LEVEL);
    steps(sim, VAN_WAIT_TICKS + 1);
    expect(sim.level).toBe(FIRST_LEVEL);
    expect(state.players).toContain(b);
  });

  it('a key press keeps a player counted', () => {
    const { sim, state } = homeSim({ players: ['a', 'b'] });
    sim.homeCommand('a', { kind: 'pick_level', level: FIRST_LEVEL });
    sim.homeCommand('a', { kind: 'ready', ready: true });
    standAtVan(state, state.players[0]);
    steps(sim, IDLE_TICKS - TICK_RATE);
    sim.setInput('b', input({ seq: 1, left: true }));
    sim.step();
    sim.setInput('b', input({ seq: 2 }));
    steps(sim, TICK_RATE * 5);
    expect(sim.level).toBe(BUNKER_LEVEL);
  });

  it('an open station keeps a player counted', () => {
    const { sim, state } = homeSim({ players: ['a', 'b'] });
    const [a, b] = state.players;
    sim.homeCommand('a', { kind: 'pick_level', level: FIRST_LEVEL });
    sim.homeCommand('a', { kind: 'ready', ready: true });
    standAtVan(state, a);
    standAtStation(state, b, 'locker');
    (b.home as NonNullable<PlayerState['home']>).station = 'locker';
    steps(sim, IDLE_TICKS + VAN_WAIT_TICKS * 2);
    expect(sim.level).toBe(BUNKER_LEVEL);
  });

  it('never leaves on nobody when the whole room has gone quiet', () => {
    const { sim } = homeSim({ players: ['a', 'b'] });
    sim.homeCommand('a', { kind: 'pick_level', level: FIRST_LEVEL });
    steps(sim, IDLE_TICKS + VAN_WAIT_TICKS * 2);
    expect(sim.level).toBe(BUNKER_LEVEL);
  });

  it('ignores ready in a town', () => {
    const { sim, state } = tripSim();
    sim.homeCommand('a', { kind: 'ready', ready: true });
    expect(state.players[0].home?.ready).toBe(false);
  });
});

describe('a trip out', () => {
  it('each trip gets a new town, and attempt 0 keeps today\'s seed', () => {
    const { sim, state } = homeSim();
    driveToTown(sim, state, 2);
    expect(sim.map.seed).toBe(levelSeed(SEED, 2));
    bankTrip(sim, state);
    driveToTown(sim, state, 2);
    expect(sim.map.seed).toBe(levelSeed(SEED, 2, 1));
    expect(sim.map.seed).not.toBe(levelSeed(SEED, 2));
    expect(sim.level).toBe(2);
  });

  it('announces the trip and the town\'s lead-in', () => {
    const { sim, state } = homeSim();
    driveToTown(sim, state);
    const frame = sim.snapshot();
    expect(eventsOf(frame, 'trip_start')).toEqual([{ type: 'trip_start', level: FIRST_LEVEL, attempt: 0 }]);
    expect(eventsOf(frame, 'level_start')).toEqual([{ type: 'level_start', level: FIRST_LEVEL }]);
    expect(eventsOf(frame, 'wave_intermission')).toHaveLength(1);
  });

  it('sets the room out with gear in hand and a clean slate', () => {
    const { sim, state } = homeSim();
    const [p] = state.players;
    applyLoadout(p, { ...emptyLoadout(), guns: { carbine: {} }, ammoBag: { pistol: 0, carbine: 40, shotgun: 0 }, medkits: 2 });
    p.score = 500;
    p.kills = 9;
    driveToTown(sim, state);
    expect(p).toMatchObject({ weapon: 'carbine', medkits: 2, score: 0, kills: 0 });
    expect(p.home).toMatchObject({ ready: false, station: null, stationHold: 0 });
    expect(state.homeRun).toMatchObject({ tripLevel: FIRST_LEVEL, pickedLevel: null, attempt: 1 });
    expect(sim.snapshot().home?.pickedLevel).toBeNull();
  });

  it('issues a pistol to anyone boarding with no gun', () => {
    const { sim, state } = homeSim();
    const [p] = state.players;
    applyLoadout(p, { ...emptyLoadout(), medkits: 1 });
    driveToTown(sim, state);
    expect(p.owned).toEqual(['pistol']);
    expect(p.medkits).toBe(1);
    expect(p.bottles).toBe(0);
  });

  it('counts score, kills and hordes for one trip', () => {
    const { sim, state } = tripSim({ level: 2 });
    const [p] = state.players;
    surviveHorde(sim, state);
    p.score = 120;
    p.kills = 4;
    quietTown(state);
    bankTrip(sim, state);
    const first = receiptOf(p);
    expect(first).toMatchObject({ score: 120, kills: 4, hordes: levelDef(2).hordes });
    expect(first.seconds).toBeGreaterThan(0);
    driveToTown(sim, state);
    quietTown(state);
    bankTrip(sim, state);
    expect(receiptOf(p)).toMatchObject({ score: 0, kills: 0, hordes: levelDef(FIRST_LEVEL).hordes });
    expect(receiptOf(p).seconds).toBeLessThan(first.seconds);
  });
});

describe('banking at the van', () => {
  it('banking returns treasure and gear on a receipt, with magazines emptied into rounds and clamped to the reserve cap', () => {
    const { sim, state } = tripSim({ level: 2 });
    const [p] = state.players;
    const home = p.home as NonNullable<PlayerState['home']>;
    home.silver = 75;
    home.jewels = { small: 2, large: 1 };
    p.guns = { pistol: { ammo: 9 }, carbine: { ammo: 11 } };
    p.owned = ['pistol', 'carbine'];
    p.ammoBag = { pistol: WEAPONS.pistol.reserveCap - 3, carbine: 4, shotgun: 2 };
    p.medkits = 2;
    bankTrip(sim, state);
    const receipt = receiptOf(p);
    expect(receipt).toMatchObject({ outcome: 'banked', level: 2, difficulty: state.difficulty, silver: 75, jewels: { small: 2, large: 1 }, ending: false });
    expect(receipt.simId).toBe(state.homeRun?.simId);
    expect(receipt.gear).toMatchObject({ medkits: 2 });
    expect(Object.keys(receipt.gear?.guns ?? {}).sort()).toEqual(['carbine', 'pistol']);
    expect(receipt.gear?.ammoBag).toEqual({ pistol: WEAPONS.pistol.reserveCap, carbine: 15, shotgun: 2 });
  });

  it('leaves the bunker holding nothing but the receipt', () => {
    const { sim, state } = tripSim();
    const [p] = state.players;
    (p.home as NonNullable<PlayerState['home']>).silver = 40;
    bankTrip(sim, state);
    expect(p.home).toMatchObject({ silver: 0, jewels: { small: 0, large: 0 }, ready: false, station: null });
    expect(loadoutOf(p)).toEqual(emptyLoadout());
    expect(sim.level).toBe(BUNKER_LEVEL);
    expect(sim.map.seed).toBe(BUNKER_SEED);
    expect(state.homeRun).toMatchObject({ tripLevel: null, pickedLevel: null });
    expect(state.exit).toMatchObject({ hold: 0 });
    expect(state.containers).toEqual([]);
    expect(sim.phase).toBe('intermission');
  });

  it('never ends the run', () => {
    const { sim, state } = tripSim({ level: FINAL_LEVEL });
    bankTrip(sim, state);
    expect(sim.phase).not.toBe('gameover');
    expect(state.gameOver).toBeNull();
  });

  it('flags a level below the room\'s highest as a replay', () => {
    const { sim, state } = homeSim({ players: [] });
    sim.addPlayer('a', 'a', null, undefined, { loadout: emptyLoadout(), highest: 4 });
    driveToTown(sim, state, 4);
    quietTown(state);
    bankTrip(sim, state);
    expect(receiptOf(state.players[0]).replay).toBe(false);
    driveToTown(sim, state, 2);
    quietTown(state);
    bankTrip(sim, state);
    expect(receiptOf(state.players[0]).replay).toBe(true);
  });

  it('unlocks the next level for everyone aboard', () => {
    const { sim, state } = tripSim({ players: ['a', 'b'] });
    bankTrip(sim, state);
    expect(state.players.map((p) => p.home?.highest)).toEqual([2, 2]);
    expect(state.homeRun?.roomHighest).toBe(2);
  });

  it('the level 10 van flags the receipt as the ending and carries on in the bunker', () => {
    const { sim, state } = homeSim({ players: [] });
    sim.addPlayer('a', 'a', null, undefined, { loadout: emptyLoadout(), highest: FINAL_LEVEL });
    driveToTown(sim, state, FINAL_LEVEL);
    quietTown(state);
    bankTrip(sim, state);
    expect(receiptOf(state.players[0]).ending).toBe(true);
    expect(sim.level).toBe(BUNKER_LEVEL);
    expect(sim.phase).toBe('intermission');
    expect(state.homeRun?.roomHighest).toBe(FINAL_LEVEL);
    steps(sim, TICK_RATE);
    expect(sim.level).toBe(BUNKER_LEVEL);
  });

  it('a later clear of level 10 is a normal trip', () => {
    const { sim, state } = homeSim({ players: [] });
    sim.addPlayer('a', 'a', null, undefined, { loadout: emptyLoadout(), highest: FINAL_LEVEL });
    for (const ending of [true, false]) {
      driveToTown(sim, state, FINAL_LEVEL);
      quietTown(state);
      bankTrip(sim, state);
      expect(receiptOf(state.players[0]).ending).toBe(ending);
    }
  });

  it('takes a player\'s word that they finished the game before', () => {
    const { sim, state } = homeSim({ players: [] });
    sim.addPlayer('a', 'a', null, undefined, { loadout: emptyLoadout(), highest: FINAL_LEVEL, finished: true });
    driveToTown(sim, state, FINAL_LEVEL);
    quietTown(state);
    bankTrip(sim, state);
    expect(receiptOf(state.players[0]).ending).toBe(false);
  });
});

describe('receipts', () => {
  it('receipts in a room never repeat a serial, across players, restarts and an emptied room', () => {
    const { sim, state } = tripSim({ players: ['a', 'b'] });
    const seen: number[] = [];
    const collect = (): void => {
      for (const p of state.players) seen.push(receiptOf(p).serial);
    };
    bankTrip(sim, state);
    collect();
    driveToTown(sim, state);
    quietTown(state);
    sim.restart();
    collect();
    sim.removePlayer('a');
    sim.removePlayer('b');
    sim.restart();
    sim.addPlayer('c', 'c');
    driveToTown(sim, state);
    quietTown(state);
    bankTrip(sim, state);
    collect();
    expect(seen).toHaveLength(5);
    expect(new Set(seen).size).toBe(seen.length);
    expect(Math.min(...seen)).toBe(1);
  });

  it('a new trip clears the last receipt and what was lost', () => {
    const { sim, state } = tripSim();
    const [p] = state.players;
    const home = p.home as NonNullable<PlayerState['home']>;
    home.silver = 30;
    wipeOut(state);
    sim.step();
    expect(home.receipt?.outcome).toBe('died');
    expect(home.lost.silver).toBe(30);
    driveToTown(sim, state);
    expect(home.receipt).toBeNull();
    expect(home.lost).toEqual({ silver: 0, jewels: { small: 0, large: 0 }, salvage: { fuel_can: 0, car_battery: 0, scrap_steel: 0, sedatives: 0 } });
  });
});

describe('a wipe', () => {
  it('a wipe leaves the sim running and returns everyone to the bunker with a died receipt', () => {
    const { sim, state } = tripSim({ players: ['a', 'b'], level: 2 });
    const [a, b] = state.players;
    (a.home as NonNullable<PlayerState['home']>).silver = 55;
    (b.home as NonNullable<PlayerState['home']>).jewels.small = 3;
    wipeOut(state);
    sim.step();
    expect(sim.phase).toBe('intermission');
    expect(state.gameOver).toBeNull();
    expect(sim.level).toBe(BUNKER_LEVEL);
    expect(receiptOf(a)).toMatchObject({ outcome: 'died', level: 2, silver: 55, gear: null, ending: false });
    expect(receiptOf(b)).toMatchObject({ outcome: 'died', jewels: { small: 3, large: 0 }, gear: null });
    for (const p of [a, b]) {
      expect(p).toMatchObject({ status: 'alive', health: p.maxHealth });
      expect(loadoutOf(p)).toEqual(emptyLoadout());
      expect(p.home).toMatchObject({ silver: 0, jewels: { small: 0, large: 0 } });
    }
  });

  it('keeps level progress', () => {
    const { sim, state } = tripSim();
    wipeOut(state);
    sim.step();
    expect(state.players[0].home?.highest).toBe(FIRST_LEVEL);
    expect(state.homeRun?.roomHighest).toBe(FIRST_LEVEL);
  });

  it('is a trip like any other for the next town', () => {
    const { sim, state } = tripSim();
    wipeOut(state);
    sim.step();
    driveToTown(sim, state);
    expect(sim.map.seed).toBe(levelSeed(SEED, FIRST_LEVEL, 1));
    expect(state.players[0].owned).toEqual(['pistol']);
  });
});
