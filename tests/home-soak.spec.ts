import { describe, expect, it } from 'vitest';
import { BOTTLE_CARRY } from '../shared/bottles.ts';
import { MEDKIT_MAX, START_SPARE_ROUNDS, TICK_RATE, WEAPONS } from '../shared/constants.ts';
import { townContainers } from '../shared/containers.ts';
import { PART_CARRY_CAP } from '../shared/gun-upgrade-data.ts';
import type { TripReceipt } from '../shared/home-protocol.ts';
import { loadoutOf, validateLoadout } from '../shared/loadout.ts';
import { spawnPickup } from '../shared/pickups.ts';
import { hurtPlayer } from '../shared/player-health.ts';
import { WEAPON_ORDER } from '../shared/protocol.ts';
import type { PickupType } from '../shared/protocol.ts';
import type { PlayerState, SimState } from '../shared/sim-state.ts';
import type { GameSimulation } from '../shared/simulation.ts';
import { isTreasurePickup, jewelWorth } from '../shared/treasure.ts';
import { armedHands, settleHands } from '../src/game/home/gear-pool.ts';
import { emptySave } from '../src/game/home/home-store.ts';
import type { HomeSave } from '../src/game/home/home-store.ts';
import { applyReceipt } from '../src/game/home/trip-ledger.ts';
import { bankTrip, driveToTown, homeSim, playerNamed, quietTown } from './helpers/home-harness.ts';
import { input, openLevelExit, steps, VAN_WAIT_TICKS } from './helpers/sim-harness.ts';

const SOAK_TRIPS = 15;
const AMMO_TRIPS = 20;
const TOWN_TICKS = 40 * TICK_RATE;
const LEVELS_IN_TURN = 3;
const SHOP_SEED = 1;
const SOAK_TIMEOUT_MS = 240_000;
/** Far more than any cap, so only the caps can stop it. */
const ARMFUL = 999;
const AMMO_FOR_EACH_GUN: readonly PickupType[] = ['pistol_ammo', 'carbine_ammo', 'shells'];
const EVERY_GUN: readonly PickupType[] = ['carbine', 'shotgun'];

/** What goes wrong on each trip, in turn. Everything else that happens is up to the zombies. */
const MISHAPS = ['none', 'teammate_dies', 'walks_out', 'walks_out_downed', 'wipe'] as const;
type Mishap = (typeof MISHAPS)[number];

interface Haul {
  silver: number;
  small: number;
  large: number;
}

const NOTHING: Haul = { silver: 0, small: 0, large: 0 };
const plus = (a: Haul, b: Haul): Haul => ({ silver: a.silver + b.silver, small: a.small + b.small, large: a.large + b.large });
const total = (hauls: readonly Haul[]): Haul => hauls.reduce(plus, NOTHING);

/** Towns hold jewels only, so a treasure is one jewel. `silver` stays in the haul for the receipt's slot, which a trip leaves at 0. */
function worth(type: PickupType): Haul {
  return type === 'jewel_small' ? { ...NOTHING, small: 1 } : { ...NOTHING, large: 1 };
}

const everyBody = (state: SimState): PlayerState[] => [...state.players, ...state.departed.values()];

function lyingInTown(state: SimState): Haul {
  const shut = state.containers.flatMap(({ loot }) => (loot && isTreasurePickup(loot.type) ? [worth(loot.type)] : []));
  const dropped = state.pickups.flatMap((item) => (isTreasurePickup(item.type) ? [worth(item.type)] : []));
  return total([...shut, ...dropped]);
}

const GRACE_TICKS = 60 * TICK_RATE;

function carriedBy({ home }: PlayerState): Haul {
  return { silver: home?.silver ?? 0, ...(home?.jewels ?? NOTHING) };
}

function lostBy({ home }: PlayerState): Haul {
  return { silver: home?.lost.silver ?? 0, ...(home?.lost.jewels ?? NOTHING) };
}

const inTheWorld = (state: SimState): Haul => plus(lyingInTown(state), total(everyBody(state).map(carriedBy)));

const sameHaul = (a: Haul, b: Haul): boolean => a.silver === b.silver && a.small === b.small && a.large === b.large;

const receiptHaul = ({ silver, jewels }: TripReceipt): Haul => ({ silver, ...jewels });

/** The world one tick before the trip ended, while the town still stood. */
interface LastLook {
  readonly town: Haul;
  readonly carried: ReadonlyMap<string, Haul>;
  readonly lost: ReadonlyMap<string, Haul>;
}

function lookAt(state: SimState): LastLook {
  const bodies = everyBody(state);
  return { town: lyingInTown(state), carried: new Map(bodies.map((p) => [p.id, carriedBy(p)])), lost: new Map(bodies.map((p) => [p.id, lostBy(p)])) };
}

const tripOver = (state: SimState): boolean => state.homeRun?.tripLevel === null;

/** A container with treasure still shut in it, and nobody else on the way. */
function nextHoard(state: SimState, claimed: ReadonlySet<number>): number | null {
  const hoard = state.containers.findIndex(({ loot, opened }, id) => !opened && !claimed.has(id) && loot !== null && isTreasurePickup(loot.type));
  return hoard < 0 ? null : hoard;
}

/** Goes straight to the next hoard and searches it, while the town's zombies do as they please. */
class TreasureBot {
  private readonly id: string;
  private hoard: number | null = null;

  constructor(id: string) {
    this.id = id;
  }

  get claim(): number | null {
    return this.hoard;
  }

  private stillShut(state: SimState): boolean {
    return this.hoard !== null && !state.containers[this.hoard].opened;
  }

  private standAtNextHoard(state: SimState, p: PlayerState, claimed: ReadonlySet<number>): void {
    this.hoard = nextHoard(state, claimed);
    if (this.hoard === null) return;
    const { x, y } = townContainers(state.map)[this.hoard];
    p.x = x;
    p.y = y;
  }

  think(sim: GameSimulation, state: SimState, claimed: ReadonlySet<number>): void {
    const p = state.players.find(({ id }) => id === this.id);
    const onTheirFeet = p?.status === 'alive';
    if (!onTheirFeet) return;
    if (!this.stillShut(state)) this.standAtNextHoard(state, p, claimed);
    sim.setInput(p.id, input({ seq: state.tick, search: !p.searchSpent }));
  }
}

class Room {
  private readonly sim: GameSimulation;
  private readonly state: SimState;
  private bots: TreasureBot[] = [];
  private placed: Haul = NOTHING;
  private last: LastLook = { town: NOTHING, carried: new Map(), lost: new Map() };

  constructor(sim: GameSimulation, state: SimState) {
    this.sim = sim;
    this.state = state;
  }

  setOut(level: number): Haul {
    driveToTown(this.sim, this.state, level);
    this.placed = inTheWorld(this.state);
    this.bots = this.state.players.map((p) => new TreasureBot(p.id));
    return this.placed;
  }

  /** One tick, with nothing gone but what a rule took. Thrown, not expected: a whole trip of expects would be most of the run. */
  private tick(): void {
    this.last = lookAt(this.state);
    this.sim.step();
    const leak = !tripOver(this.state) && !sameHaul(inTheWorld(this.state), this.placed);
    if (leak) throw new Error(`treasure moved at tick ${this.state.tick}: ${JSON.stringify(inTheWorld(this.state))} of ${JSON.stringify(this.placed)}`);
  }

  private play(ticks: number): void {
    for (let left = ticks; left > 0 && !tripOver(this.state); left--) {
      this.sim.snapshot();
      for (const bot of this.bots) {
        const claimed = new Set(this.bots.flatMap(({ claim }) => (claim === null ? [] : [claim])));
        bot.think(this.sim, this.state, claimed);
      }
      this.tick();
    }
  }

  private mortalWound(p: PlayerState): void {
    hurtPlayer(this.state, p, p.maxHealth * 2);
  }

  private bleedOut(p: PlayerState): void {
    this.mortalWound(p);
    p.bleedout = 0;
  }

  /** Everyone still on their feet walks over the pile a fallen teammate left. */
  private collectThePile(fallen: PlayerState): void {
    for (const p of this.state.players) {
      if (p.status === 'alive') Object.assign(p, { x: fallen.x, y: fallen.y });
    }
    this.play(2);
  }

  private walkOut(p: PlayerState): void {
    this.sim.removePlayer(p.id);
  }

  private mishap(kind: Mishap): void {
    const [first, second] = this.state.players;
    const noSecondPlayer = !second || tripOver(this.state);
    if (noSecondPlayer) return;
    if (kind === 'teammate_dies') {
      this.bleedOut(second);
      this.play(2);
      this.collectThePile(second);
    }
    if (kind === 'walks_out') this.walkOut(second);
    if (kind === 'walks_out_downed') {
      this.mortalWound(second);
      this.walkOut(second);
    }
    if (kind === 'wipe') {
      this.bleedOut(first);
      this.bleedOut(second);
    }
  }

  private rideHome(): void {
    if (tripOver(this.state)) return;
    const exit = openLevelExit(this.state);
    for (const p of this.state.players) {
      if (p.status === 'alive') Object.assign(p, { x: exit.x, y: exit.y });
    }
    // With nobody on their feet, a walked-out body's grace period is what the room waits out before the wipe.
    for (let left = VAN_WAIT_TICKS + GRACE_TICKS + 1; left > 0 && !tripOver(this.state); left--) this.tick();
  }

  /** Plays the trip through, with one thing going wrong half way, and says how the town stood at the end. */
  run(kind: Mishap): LastLook {
    this.play(TOWN_TICKS / 2);
    this.mishap(kind);
    this.play(TOWN_TICKS / 2);
    this.rideHome();
    return this.last;
  }

  /** Anyone who walked out comes back under their token, to whatever the van left them. */
  backTogether(ids: readonly string[]): void {
    const present = new Set(this.state.players.map((p) => p.id));
    for (const id of ids) {
      if (!present.has(id)) this.sim.addPlayer(id, id, `token-${id}`);
    }
  }
}

/** Everything in the locker goes in hand, and the room's answer goes in the save, as closing the locker does. */
function takeOutEverything(sim: GameSimulation, state: SimState, id: string, save: HomeSave): HomeSave {
  sim.homeCommand(id, { kind: 'equip', loadout: save.locker });
  return settleHands(save, loadoutOf(playerNamed(state, id)));
}

function receiptFor(state: SimState, id: string): TripReceipt {
  const receipt = playerNamed(state, id).home?.receipt;
  if (!receipt) throw new Error(`${id} came home with no receipt`);
  return receipt;
}

function expectWithinCaps(save: HomeSave): void {
  expect(validateLoadout(save.locker)).not.toBeNull();
  for (const weapon of WEAPON_ORDER) expect(save.locker.ammoBag[weapon]).toBeLessThanOrEqual(WEAPONS[weapon].reserveCap);
}

describe('the loop, over and over', () => {
  it('treasure is conserved except where a rule forfeits it', () => {
    const ids = ['a', 'b'];
    const { sim, state } = homeSim({ players: [] });
    for (const id of ids) sim.addPlayer(id, id, `token-${id}`);
    const room = new Room(sim, state);
    const saves = new Map(ids.map((id) => [id, emptySave(SHOP_SEED)]));
    let placed = NOTHING;
    let banked = NOTHING;
    let forfeited = NOTHING;

    for (let trip = 0; trip < SOAK_TRIPS; trip++) {
      for (const id of ids) saves.set(id, takeOutEverything(sim, state, id, saves.get(id) as HomeSave));
      const inTown = room.setOut((trip % LEVELS_IN_TURN) + 1);
      const last = room.run(MISHAPS[trip % MISHAPS.length]);
      room.backTogether(ids);

      let brought = NOTHING;
      let stayed = last.town;
      for (const id of ids) {
        const receipt = receiptFor(state, id);
        const before = saves.get(id) as HomeSave;
        const after = applyReceipt(before, receipt);
        const carried = last.carried.get(id) ?? NOTHING;
        const credited = { silver: after.silver - before.silver, small: after.rawJewels.small - before.rawJewels.small, large: after.rawJewels.large - before.rawJewels.large };
        if (receipt.outcome === 'banked') {
          expect(receiptHaul(receipt)).toEqual(carried);
          expect(credited).toEqual(carried);
          brought = plus(brought, carried);
        } else {
          expect(receiptHaul(receipt)).toEqual(plus(carried, last.lost.get(id) ?? NOTHING));
          expect(credited).toEqual(NOTHING);
          stayed = plus(stayed, carried);
        }
        expectWithinCaps(after);
        saves.set(id, after);
      }
      expect(plus(brought, stayed)).toEqual(inTown);
      placed = plus(placed, inTown);
      banked = plus(banked, brought);
      forfeited = plus(forfeited, stayed);
    }

    const everySave = [...saves.values()];
    expect(total(everySave.map((save) => ({ silver: save.silver, ...save.rawJewels })))).toEqual(banked);
    expect(plus(banked, forfeited)).toEqual(placed);
    const rows = everySave.flatMap((save) => save.ledger);
    expect(rows).toHaveLength(SOAK_TRIPS * ids.length);
    expect(rows.some((row) => row.outcome === 'died')).toBe(true);
    expect(rows.some((row) => row.outcome === 'banked')).toBe(true);
    // Towns hold jewels only: no coin is placed, banked or forfeited, and jewels are both brought home and lost.
    expect([placed.silver, banked.silver, forfeited.silver]).toEqual([0, 0, 0]);
    expect(banked.small + banked.large).toBeGreaterThan(0);
    expect(forfeited.small + forfeited.large).toBeGreaterThan(0);
    const perTrip = (value: number): string => (value / SOAK_TRIPS).toFixed(1);
    console.info(`home soak: ${SOAK_TRIPS} trips, per trip placed ${perTrip(placed.small + placed.large)} jewels worth ${perTrip(jewelWorth(placed))} silver, banked ${perTrip(banked.small + banked.large)} jewels worth ${perTrip(jewelWorth(banked))} silver`);
  }, SOAK_TIMEOUT_MS);

  /** The most a player can find on one trip, on top of what they took out. */
  function loadUp(state: SimState, p: PlayerState): void {
    for (const type of [...EVERY_GUN, ...AMMO_FOR_EACH_GUN]) spawnPickup(state, type, p.x, p.y, ARMFUL);
    p.parts.barrel = PART_CARRY_CAP;
    p.medkits = MEDKIT_MAX;
    p.bottles = BOTTLE_CARRY;
  }

  /** The van puts a gun from the locker in empty hands, as HomeSync does at the ring. */
  function handOver(sim: GameSimulation, id: string, save: HomeSave): HomeSave {
    const gear = armedHands(save);
    if (!gear) return save;
    sim.homeCommand(id, { kind: 'equip', loadout: gear });
    return settleHands(save, gear);
  }

  /** The save at the end. */
  function loopTrips(takeGearOut: boolean): HomeSave {
    const { sim, state } = homeSim();
    let save = emptySave(SHOP_SEED);
    for (let trip = 0; trip < AMMO_TRIPS; trip++) {
      save = takeGearOut ? takeOutEverything(sim, state, 'a', save) : handOver(sim, 'a', save);
      driveToTown(sim, state);
      quietTown(state);
      if (takeGearOut) loadUp(state, playerNamed(state, 'a'));
      steps(sim, 2);
      bankTrip(sim, state);
      save = applyReceipt(save, receiptFor(state, 'a'));
      expectWithinCaps(save);
    }
    return save;
  }

  it('repeated trips cannot grow ammo past the caps', () => {
    const { locker } = loopTrips(true);
    for (const weapon of WEAPON_ORDER) expect(locker.ammoBag[weapon]).toBe(WEAPONS[weapon].reserveCap);
    expect(locker.parts.barrel).toBe(PART_CARRY_CAP);
    expect(locker.medkits).toBe(MEDKIT_MAX);
    expect(locker.bottles).toBe(BOTTLE_CARRY);
  }, SOAK_TIMEOUT_MS);

  it('the free pistol is issued only until a gun is owned, so empty trips cannot farm its rounds', () => {
    const save = loopTrips(false);
    expect(Object.keys(save.locker.guns)).toEqual(['pistol']);
    expect(save.locker.ammoBag.pistol).toBeLessThanOrEqual(WEAPONS.pistol.magSize + START_SPARE_ROUNDS);
    expect(save.locker.ammoBag.pistol).toBeGreaterThan(0);
  }, SOAK_TIMEOUT_MS);
});
