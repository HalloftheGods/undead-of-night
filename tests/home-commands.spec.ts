import { describe, expect, it } from 'vitest';
import { BUNKER_LEVEL, isBunkerMap } from '../shared/home-protocol.ts';
import type { TripReceipt } from '../shared/home-protocol.ts';
import { FINAL_LEVEL, FIRST_LEVEL } from '../shared/levels.ts';
import { emptyLoadout, loadoutOf } from '../shared/loadout.ts';
import type { PlayerState, SimState } from '../shared/sim-state.ts';
import { bankTrip, driveToTown, homeSim, tripSim } from './helpers/home-harness.ts';

describe('home commands', () => {
  it('pick_level is capped at the room\'s highest', () => {
    const { sim, state } = homeSim({ players: [] });
    sim.addPlayer('a', 'a', null, undefined, { loadout: emptyLoadout(), highest: 3 });
    sim.addPlayer('b', 'b', null, undefined, { loadout: emptyLoadout(), highest: 5 });
    const run = state.homeRun as NonNullable<SimState['homeRun']>;
    expect(run.roomHighest).toBe(5);
    sim.homeCommand('a', { kind: 'pick_level', level: 5 });
    expect(run.pickedLevel).toBe(5);
    sim.homeCommand('a', { kind: 'pick_level', level: 9 });
    expect(run.pickedLevel).toBe(5);
    sim.homeCommand('a', { kind: 'pick_level', level: -2 });
    expect(run.pickedLevel).toBe(FIRST_LEVEL);
  });

  it('lets a room\'s reach go with the player who brought it', () => {
    const { sim, state } = homeSim({ players: [] });
    sim.addPlayer('a', 'a', null, undefined, { loadout: emptyLoadout(), highest: 2 });
    sim.addPlayer('b', 'b', null, undefined, { loadout: emptyLoadout(), highest: 6 });
    sim.homeCommand('a', { kind: 'pick_level', level: 6 });
    sim.removePlayer('b');
    expect(state.homeRun).toMatchObject({ roomHighest: 2, pickedLevel: null });
  });

  it('boarding with no gun in hand is issued the free pistol', () => {
    const { sim, state } = homeSim({ players: [] });
    sim.addPlayer('a', 'a', null, undefined, { loadout: emptyLoadout(), highest: FIRST_LEVEL });
    driveToTown(sim, state);
    expect(state.players[0].owned).toEqual(['pistol']);
  });

  it('picks no level on a trip', () => {
    const { sim, state } = tripSim();
    sim.homeCommand('a', { kind: 'pick_level', level: FIRST_LEVEL });
    expect(state.homeRun?.pickedLevel).toBeNull();
  });

  it('raises a player\'s highest and never lowers it', () => {
    const { sim, state } = homeSim();
    const [p] = state.players;
    sim.homeCommand('a', { kind: 'highest', highest: 4 });
    expect(p.home?.highest).toBe(4);
    expect(state.homeRun?.roomHighest).toBe(4);
    sim.homeCommand('a', { kind: 'highest', highest: 2 });
    expect(p.home?.highest).toBe(4);
    sim.homeCommand('a', { kind: 'highest', highest: FINAL_LEVEL + 50 });
    expect(p.home?.highest).toBe(FINAL_LEVEL);
  });

  it('holds a highest from a join to the real levels', () => {
    const { sim, state } = homeSim({ players: [] });
    sim.addPlayer('a', 'a', null, undefined, { loadout: emptyLoadout(), highest: 400 });
    expect(state.players[0].home?.highest).toBe(FINAL_LEVEL);
  });

  it('takes legal gear in the bunker and shows it on the entity', () => {
    const { sim, state } = homeSim();
    const gear = { ...emptyLoadout(), guns: { shotgun: {} }, ammoBag: { pistol: 0, carbine: 0, shotgun: 12 } };
    sim.homeCommand('a', { kind: 'equip', loadout: gear });
    expect(loadoutOf(state.players[0])).toEqual(gear);
    expect(sim.snapshot().players[0].owned).toEqual(['shotgun']);
  });

  it('leaves a refused loadout out of the player\'s hands', () => {
    const { sim, state } = homeSim();
    const before = loadoutOf(state.players[0]);
    const tooMany = { ...emptyLoadout(), medkits: 99 };
    sim.homeCommand('a', { kind: 'equip', loadout: tooMany });
    expect(loadoutOf(state.players[0])).toEqual(before);
  });

  it('changes no gear once ready, or on a trip', () => {
    const { sim, state } = homeSim();
    const [p] = state.players;
    const before = loadoutOf(p);
    sim.homeCommand('a', { kind: 'ready', ready: true });
    sim.homeCommand('a', { kind: 'equip', loadout: emptyLoadout() });
    expect(loadoutOf(p)).toEqual(before);
    sim.homeCommand('a', { kind: 'ready', ready: false });
    driveToTown(sim, state);
    sim.homeCommand('a', { kind: 'equip', loadout: emptyLoadout() });
    expect(p.owned).toEqual(before.guns.pistol ? ['pistol'] : []);
  });

  it('closes a station on leave_station', () => {
    const { sim, state } = homeSim();
    const home = state.players[0].home as NonNullable<PlayerState['home']>;
    home.station = 'candy_shop';
    home.stationHold = 0.6;
    sim.homeCommand('a', { kind: 'leave_station' });
    expect(home).toMatchObject({ station: null, stationHold: 0 });
  });

  it('a bad join brings no gear, and the pistol comes at the van', () => {
    const { sim, state } = homeSim({ players: [] });
    sim.addPlayer('a', 'a', null, undefined, { loadout: { ...emptyLoadout(), bottles: 99 }, highest: 1 });
    const [p] = state.players;
    expect(loadoutOf(p)).toEqual(emptyLoadout());
    driveToTown(sim, state);
    expect(p.owned).toEqual(['pistol']);
  });
});

describe('the bench', () => {
  it('workbench actions work per player at the bench with sim.bench null', () => {
    const { sim, state } = homeSim({ players: ['a', 'b'] });
    const [a, b] = state.players;
    a.parts.barrel = 2;
    b.parts.barrel = 2;
    const home = a.home as NonNullable<PlayerState['home']>;
    home.station = 'bench';
    sim.benchCommand('a', { kind: 'fit', weapon: 'pistol', upgrade: 'damage' });
    sim.benchCommand('b', { kind: 'fit', weapon: 'pistol', upgrade: 'damage' });
    expect(state.bench).toBeNull();
    expect(a.guns.pistol?.fit?.ranks.damage).toBe(1);
    expect(a.parts.barrel).toBe(1);
    expect(b.guns.pistol?.fit).toBeUndefined();
    home.station = null;
    sim.benchCommand('a', { kind: 'fit', weapon: 'pistol', upgrade: 'damage' });
    expect(a.parts.barrel).toBe(1);
  });

  it('never stops a trip at the bench', () => {
    const { sim, state } = tripSim({ workbench: 'hold' });
    bankTrip(sim, state);
    expect(state.bench).toBeNull();
    expect(sim.level).toBe(BUNKER_LEVEL);
  });
});

describe('a restart in a home room', () => {
  it('goes back to the bunker, not level 1', () => {
    const { sim } = homeSim();
    sim.restart();
    expect(sim.level).toBe(BUNKER_LEVEL);
    expect(isBunkerMap(sim.map)).toBe(true);
  });

  it('counts a trip under way as lost', () => {
    const { sim, state } = tripSim();
    (state.players[0].home as NonNullable<PlayerState['home']>).silver = 10;
    sim.restart();
    expect(sim.level).toBe(BUNKER_LEVEL);
    expect(state.players[0].home?.receipt).toMatchObject({ outcome: 'died', silver: 10 } satisfies Partial<TripReceipt>);
  });

  it('leaves a home room in the bunker when the difficulty changes', () => {
    const { sim, state } = homeSim({ players: [] });
    sim.setDifficulty('undead_tired');
    expect(sim.level).toBe(BUNKER_LEVEL);
    expect(state.exit).not.toBeNull();
  });

  it('updates the bunker jukebox track across the room', () => {
    const { sim, state } = homeSim({ players: [] });
    sim.addPlayer('a', 'a', null, undefined, { loadout: emptyLoadout(), highest: 1 });
    sim.homeCommand('a', { kind: 'jukebox', track: 'test-track.mp3' });
    expect(state.homeRun?.jukeboxTrack).toBe('test-track.mp3');
    sim.homeCommand('a', { kind: 'jukebox', track: null });
    expect(state.homeRun?.jukeboxTrack).toBeNull();
  });
});
