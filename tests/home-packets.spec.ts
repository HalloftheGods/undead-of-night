import { describe, expect, it, vi } from 'vitest';
import { parseHome, parseJoinHome } from '../server/home-packets.ts';
import { parseClientPacket } from '../server/packets.ts';
import { BUNKER_SEED } from '../shared/home-protocol.ts';
import type { HomeView, OverrunReceipt, OverrunView, TripReceipt } from '../shared/home-protocol.ts';
import { FINAL_LEVEL, FIRST_LEVEL } from '../shared/levels.ts';
import { emptyLoadout } from '../shared/loadout.ts';
import type { PlayerEntity, SnapshotPacket } from '../shared/protocol.ts';
import { LocalSession } from '../src/network/local-session.ts';
import { isHomeView, isLoadout, isOverrunReceipt, isOverrunView, isRoomHomeView, isTripReceipt } from '../src/network/home-guards.ts';
import { isPlayerEntity, isSnapshotPacket, isWelcomePacket } from '../src/network/packet-guards.ts';

/** A stand-in for the lane's real check: this spec is about what the parser does with its answer. */
vi.mock('../shared/loadout.ts', async (original) => {
  const real = await original<typeof import('../shared/loadout.ts')>();
  const accepted = (value: unknown): boolean => typeof value === 'object' && value !== null && 'guns' in value;
  return { ...real, validateLoadout: (value: unknown) => (accepted(value) ? real.emptyLoadout() : null) };
});

const receipt: TripReceipt = {
  simId: 'abc-01', serial: 3, outcome: 'banked', level: 2, difficulty: 'stay_close', silver: 40, jewels: { small: 1, large: 0 },
  replay: false, score: 100, kills: 4, hordes: 2, seconds: 90, ending: false, gear: emptyLoadout(),
};

const overrun: OverrunReceipt = {
  simId: 'abc-01', serial: 4, outcome: 'held', share: 0, chest: emptyLoadout(), silver: 60, jewels: { small: 1, large: 0 },
  lost: null, kills: 12, seconds: 240,
};

const clock: OverrunView = { phase: 'breached', left: 0, slowed: false, hostiles: 18, total: 24 };

const view: HomeView = { silver: 5, jewels: { small: 0, large: 1 }, station: 'candy_shop', stationHold: 0.5, ready: false, receipt, overrun: null };

const player: PlayerEntity = {
  id: 'p1', name: 'ANA', skin: 0, x: 1, y: 2, angle: 0, moving: false, status: 'alive',
  health: 100, maxHealth: 100, weapon: 'pistol', ammo: 12, magSize: 12, reserve: 12,
  owned: ['pistol'], ammoBag: { pistol: 12, carbine: 0, shotgun: 0 }, mags: { pistol: 12, carbine: 0, shotgun: 0 },
  medkits: 0, indoors: null,
  reload: 0, bleedout: 0, revive: 0, score: 0, kills: 0, lastInputSeq: 3, knife: false, search: 0,
};

const snapshot: SnapshotPacket = {
  type: 'snapshot', tick: 9, phase: 'intermission', level: 0, mapSeed: BUNKER_SEED, wave: 0, intermission: 0, hostiles: 0,
  players: [player], zombies: [], bullets: [], pickups: [], exit: null, openedContainers: [], events: [], gameOver: null,
};

describe('parseHome', () => {
  it('passes every well-formed action', () => {
    expect(parseHome({ kind: 'pick_level', level: 3 })).toEqual({ kind: 'pick_level', level: 3 });
    expect(parseHome({ kind: 'ready', ready: true })).toEqual({ kind: 'ready', ready: true });
    expect(parseHome({ kind: 'leave_station' })).toEqual({ kind: 'leave_station' });
    expect(parseHome({ kind: 'highest', highest: FINAL_LEVEL })).toEqual({ kind: 'highest', highest: FINAL_LEVEL });
  });

  it('hands gear to the loadout check and keeps only what it returns', () => {
    expect(parseHome({ kind: 'equip', loadout: { guns: { laser: {} } } })).toEqual({ kind: 'equip', loadout: emptyLoadout() });
    expect(parseHome({ kind: 'equip', loadout: 'everything' })).toBeNull();
  });

  it.each([
    ['nothing', undefined],
    ['an array', []],
    ['an unknown kind', { kind: 'cheat' }],
    ['a kind off the prototype', { kind: 'toString' }],
    ['a level below the first', { kind: 'pick_level', level: FIRST_LEVEL - 1 }],
    ['a level past the last', { kind: 'pick_level', level: FINAL_LEVEL + 1 }],
    ['a fractional level', { kind: 'pick_level', level: 1.5 }],
    ['a ready that is not a flag', { kind: 'ready', ready: 'yes' }],
    ['a highest past the last', { kind: 'highest', highest: FINAL_LEVEL + 1 }],
  ])('refuses %s', (_name, value) => {
    expect(parseHome(value)).toBeNull();
  });
});

describe('parseJoinHome', () => {
  it('takes legal gear and a level', () => {
    expect(parseJoinHome({ loadout: { guns: {} }, highest: 4 })).toEqual({ loadout: emptyLoadout(), highest: 4 });
  });

  it('keeps having seen the ending, and leaves it off for no', () => {
    expect(parseJoinHome({ loadout: { guns: {} }, highest: 10, finished: true })).toMatchObject({ finished: true });
    expect(parseJoinHome({ loadout: { guns: {} }, highest: 10, finished: 'yes' })).not.toHaveProperty('finished');
  });

  it('turns no player away: bad gear becomes none, and a bad level the first', () => {
    expect(parseJoinHome({ loadout: 'all of it', highest: 99 })).toEqual({ loadout: emptyLoadout(), highest: FIRST_LEVEL });
  });

  it('is nothing for a client that sent nothing', () => {
    expect(parseJoinHome(undefined)).toBeUndefined();
    expect(parseJoinHome('home')).toBeUndefined();
  });
});

describe('client packets', () => {
  it('carries a home action, and drops a bad one', () => {
    expect(parseClientPacket('{"type":"home","action":{"kind":"leave_station"}}')).toEqual({ type: 'home', action: { kind: 'leave_station' } });
    expect(parseClientPacket('{"type":"home","action":{"kind":"cheat"}}')).toBeNull();
  });

  it('reads home on a join, and adds nothing to a join without it', () => {
    const join = { type: 'join', name: 'Ann', token: 't1' };
    expect(parseClientPacket(JSON.stringify({ ...join, home: { loadout: { guns: {} }, highest: 2 } }))).toMatchObject({ home: { highest: 2 } });
    expect(parseClientPacket(JSON.stringify(join))).toEqual(join);
  });
});

describe('home guards', () => {
  it('accepts a whole view, and a frame carrying one', () => {
    expect(isHomeView(view)).toBe(true);
    expect(isPlayerEntity({ ...player, home: view })).toBe(true);
    expect(isSnapshotPacket({ ...snapshot, home: { pickedLevel: null, roomHighest: 1 } })).toBe(true);
    expect(isSnapshotPacket(snapshot)).toBe(true);
  });

  it('refuses a player or a frame whose home is malformed', () => {
    expect(isPlayerEntity({ ...player, home: { ...view, station: 'moon' } })).toBe(false);
    expect(isPlayerEntity({ ...player, home: { ...view, jewels: { small: 1 } } })).toBe(false);
    expect(isPlayerEntity({ ...player, home: { ...view, receipt: { ...receipt, serial: 'one' } } })).toBe(false);
    expect(isSnapshotPacket({ ...snapshot, home: { pickedLevel: 'two', roomHighest: 1 } })).toBe(false);
  });

  it('reads a receipt with no gear, and refuses an unknown outcome', () => {
    expect(isTripReceipt({ ...receipt, gear: null })).toBe(true);
    expect(isTripReceipt({ ...receipt, outcome: 'fled' })).toBe(false);
    expect(isTripReceipt({ ...receipt, difficulty: 'nightmare fuel' })).toBe(false);
  });

  it('reads a view and a receipt with or without salvage, and refuses a short count', () => {
    const salvage = { fuel_can: 1, car_battery: 0, scrap_steel: 2, sedatives: 0 };
    expect(isHomeView({ ...view, salvage })).toBe(true);
    expect(isTripReceipt({ ...receipt, salvage })).toBe(true);
    expect(isHomeView(view)).toBe(true);
    expect(isTripReceipt(receipt)).toBe(true);
    expect(isHomeView({ ...view, salvage: { fuel_can: 1 } })).toBe(false);
    expect(isTripReceipt({ ...receipt, salvage: { ...salvage, sedatives: 'two' } })).toBe(false);
  });

  it('checks a loadout gun by gun', () => {
    expect(isLoadout(emptyLoadout())).toBe(true);
    expect(isLoadout({ ...emptyLoadout(), guns: { pistol: {} } })).toBe(true);
    expect(isLoadout({ ...emptyLoadout(), guns: { laser: {} } })).toBe(false);
    expect(isLoadout({ ...emptyLoadout(), knife: 'yes' })).toBe(false);
  });

  it('reads a room view with or without a pick', () => {
    expect(isRoomHomeView({ pickedLevel: 3, roomHighest: 3 })).toBe(true);
    expect(isRoomHomeView({ pickedLevel: null, roomHighest: 1 })).toBe(true);
  });

  it('reads an overrun receipt of each outcome, on a view or alone', () => {
    expect(isHomeView({ ...view, overrun })).toBe(true);
    expect(isOverrunReceipt({ ...overrun, outcome: 'fled', share: 0.5, chest: null, silver: 0 })).toBe(true);
    expect(isOverrunReceipt({ ...overrun, outcome: 'died', chest: null, lost: emptyLoadout() })).toBe(true);
    expect(isPlayerEntity({ ...player, home: { ...view, overrun } })).toBe(true);
  });

  it.each([
    ['an unknown outcome', { ...overrun, outcome: 'banked' }],
    ['a share that is not a number', { ...overrun, share: 'half' }],
    ['a chest that is not gear', { ...overrun, chest: { guns: 'all' } }],
    ['lost gear that is not gear', { ...overrun, lost: 'everything' }],
    ['missing jewels', { ...overrun, jewels: undefined }],
    ['no sim id', { ...overrun, simId: 7 }],
  ])('refuses an overrun receipt with %s', (_name, value) => {
    expect(isOverrunReceipt(value)).toBe(false);
    expect(isHomeView({ ...view, overrun: value })).toBe(false);
  });

  it('reads a view that leaves the overrun receipt off, as a server from before the overrun sends it', () => {
    const { overrun: _left, ...withoutOverrun } = view;
    expect(isHomeView(withoutOverrun)).toBe(true);
    expect(isPlayerEntity({ ...player, home: withoutOverrun })).toBe(true);
  });

  it('reads a chest waiting, and refuses one that is not a plain yes', () => {
    expect(isHomeView({ ...view, chest: true })).toBe(true);
    expect(isHomeView({ ...view, chest: false })).toBe(false);
    expect(isHomeView({ ...view, chest: 'yes' })).toBe(false);
  });

  it('reads a held receipt carrying the death before it, one level deep and only a death', () => {
    const died = { ...overrun, outcome: 'died', chest: null, lost: emptyLoadout() };
    const held = { ...overrun, outcome: 'held' };
    expect(isOverrunReceipt({ ...held, died })).toBe(true);
    expect(isOverrunReceipt({ ...held, died: { ...died, outcome: 'fled' } })).toBe(false);
    expect(isOverrunReceipt({ ...held, died: { ...died, died } })).toBe(false);
    expect(isOverrunReceipt({ ...died, died })).toBe(false);
    expect(isOverrunReceipt({ ...held, died: { ...died, serial: 'one' } })).toBe(false);
  });

  it('reads the room\'s clock, and a room view without one', () => {
    expect(isOverrunView(clock)).toBe(true);
    expect(isRoomHomeView({ pickedLevel: null, roomHighest: 3, overrun: clock })).toBe(true);
    expect(isSnapshotPacket({ ...snapshot, home: { pickedLevel: null, roomHighest: 3, overrun: { ...clock, phase: 'counting', left: 212.4, slowed: true } } })).toBe(true);
    expect(isRoomHomeView({ pickedLevel: null, roomHighest: 3 })).toBe(true);
  });

  it('reads a clock with its length, and a clock from a build that sends none', () => {
    expect(isOverrunView({ ...clock, spanSec: 120 })).toBe(true);
    expect(isRoomHomeView({ pickedLevel: null, roomHighest: 3, overrun: { ...clock, spanSec: 240 } })).toBe(true);
    expect('spanSec' in clock).toBe(false);
    expect(isOverrunView(clock)).toBe(true);
  });

  it.each([
    ['an unknown phase', { ...clock, phase: 'burning' }],
    ['a length that is not a number', { ...clock, spanSec: '120' }],
    ['a clock that is not a number', { ...clock, left: '4:12' }],
    ['slowed that is not a flag', { ...clock, slowed: 1 }],
    ['no total', { ...clock, total: undefined }],
    ['nothing', null],
  ])('refuses a room clock with %s', (_name, value) => {
    expect(isOverrunView(value)).toBe(false);
    expect(isSnapshotPacket({ ...snapshot, home: { pickedLevel: null, roomHighest: 3, overrun: value } })).toBe(false);
  });

  it('accepts a welcome with resumed, and refuses one that is not a flag', () => {
    const welcome = { type: 'welcome', yourId: 'a', tickRate: 30, mapSeed: 1 };
    expect(isWelcomePacket({ ...welcome, resumed: true })).toBe(true);
    expect(isWelcomePacket(welcome)).toBe(true);
    expect(isWelcomePacket({ ...welcome, resumed: 'yes' })).toBe(false);
  });
});

describe('solo', () => {
  it('welcome sends sim.map.seed', () => {
    const session = new LocalSession();
    const seeds: number[] = [];
    session.onWelcome = (packet) => seeds.push(packet.mapSeed);
    session.connect({ name: 'a', startLevel: 3 });
    expect(seeds).toEqual([session.sim?.map.seed]);
    session.disconnect();
    session.connect({ name: 'a', style: 'campaign' });
    expect(seeds[1]).toBe(BUNKER_SEED);
    session.disconnect();
  });

  it('solo keeps one sim across trips', () => {
    const session = new LocalSession();
    const welcomes: number[] = [];
    session.onWelcome = (packet) => welcomes.push(packet.mapSeed);
    session.connect({ name: 'a', style: 'campaign' });
    const sim = session.sim;
    session.requestRestart();
    expect(session.sim).toBe(sim);
    expect(welcomes).toHaveLength(1);
    session.disconnect();
  });

  it('says what difficulty it plays, as a server does', () => {
    const session = new LocalSession();
    const welcomes: unknown[] = [];
    session.onWelcome = (packet) => welcomes.push(packet.difficulty);
    session.connect({ name: 'a', difficulty: 'lights_out' });
    expect(welcomes).toEqual(['lights_out']);
    session.disconnect();
  });

  it('still starts a fresh city on a restart with home off', () => {
    const session = new LocalSession();
    session.connect({ name: 'a' });
    const sim = session.sim;
    session.requestRestart();
    expect(session.sim).not.toBe(sim);
    session.disconnect();
  });
});
