import { describe, expect, it } from 'vitest';
import { CHARACTERS } from '../shared/characters.ts';
import { PLAYER_RADIUS } from '../shared/constants.ts';
import { isHomeFind, updateSearch } from '../shared/container-search.ts';
import { containerInReach, townContainers } from '../shared/containers.ts';
import type { Container, ContainerLoot } from '../shared/containers.ts';
import { TREASURE_TYPES } from '../shared/events.ts';
import type { Jewels } from '../shared/home-protocol.ts';
import { enterTown } from '../shared/level-change.ts';
import { FINAL_LEVEL, FIRST_LEVEL, LEVELS } from '../shared/levels.ts';
import { spawnPickup } from '../shared/pickups.ts';
import type { SimState } from '../shared/sim-state.ts';
import { GameSimulation } from '../shared/simulation.ts';
import {
  coinText,
  dropCarried,
  isTreasurePickup,
  jewelWorth,
  LARGE_JEWEL_SILVER,
  placeTownTreasure,
  silverToCoins,
  SMALL_JEWEL_SILVER,
  TOWN_JEWELS,
  townWorth,
  treasureCounts,
} from '../shared/treasure.ts';
import { buildingAt, circleHitsSolid } from '../shared/world-query.ts';
import { SMELT_SECONDS } from '../src/game/home/forge.ts';
import { homeSim } from './helpers/home-harness.ts';
import { SEED, stateOf, steps } from './helpers/sim-harness.ts';

/**
 * What each level's town was worth when towns also held silver stacks (30 to 45 of them, 12.5 silver on average),
 * from the old count tables. The jewels-only tables must stay within 5% of these.
 */
const OLD_TOWN_WORTH = [775, 800, 852.5, 1077.5, 1102.5, 1155, 1180, 1405, 1457.5, 1482.5];
const WORTH_TOLERANCE = 0.05;
/** The longest a full town's jewels may take on the forge, in seconds. */
const SMELT_LIMIT_SEC = 60;

/** What the town's containers hold of treasure. */
function treasureIn(state: SimState): Jewels {
  const found: Jewels = { small: 0, large: 0 };
  for (const { loot } of state.containers) {
    if (loot?.type === 'jewel_small') found.small += 1;
    if (loot?.type === 'jewel_large') found.large += 1;
  }
  return found;
}

/** A home room with nobody in it yet, put into a level's town the way a trip does. */
function townAt(level: number, roomHighest = level) {
  const sim = new GameSimulation({ seed: SEED, home: true });
  const state = stateOf(sim);
  if (state.homeRun) state.homeRun.roomHighest = roomHighest;
  enterTown(state, level);
  return { sim, state };
}

/** The same, with one survivor standing in it. */
function townWithSurvivor() {
  const { sim, state } = townAt(1);
  sim.addPlayer('a', 'a');
  return { sim, state, p: state.players[0] };
}

describe('silverToCoins', () => {
  it('shows 100 silver to the gold', () => {
    expect(silverToCoins(1234)).toEqual({ gold: 12, silver: 34 });
  });

  it('words money as gold and silver, leaving out a zero part', () => {
    expect([coinText(280), coinText(300), coinText(40), coinText(0)]).toEqual(['2 gold 80 silver', '3 gold', '40 silver', '0 silver']);
  });

  it('values jewels at what the forge makes of them', () => {
    expect(jewelWorth({ small: 2, large: 1 })).toBe(2 * SMALL_JEWEL_SILVER + LARGE_JEWEL_SILVER);
  });
});

describe('the jewel tables', () => {
  it('has one row for every level', () => {
    expect(TOWN_JEWELS).toHaveLength(LEVELS.length);
  });

  it('keeps each level within 5% of what it was worth with silver stacks', () => {
    for (let level = FIRST_LEVEL; level <= FINAL_LEVEL; level++) {
      const old = OLD_TOWN_WORTH[level - FIRST_LEVEL];
      const worth = townWorth(level, false);
      expect(Math.abs(worth / old - 1), `level ${level}: ${worth} against ${old}`).toBeLessThanOrEqual(WORTH_TOLERANCE);
    }
    expect(townWorth(FIRST_LEVEL, false)).toBe(760);
    expect(townWorth(FINAL_LEVEL, false)).toBe(1480);
  });

  it('holds more small jewels and at least as many large as the old tables, at every level', () => {
    const oldSmall = [5, 5, 6, 6, 6, 7, 7, 7, 8, 8];
    const oldLarge = [1, 1, 1, 2, 2, 2, 2, 3, 3, 3];
    TOWN_JEWELS.forEach(({ small, large }, index) => {
      expect(small).toBeGreaterThan(oldSmall[index]);
      expect(large).toBeGreaterThanOrEqual(oldLarge[index]);
    });
  });

  it('smelts a full town in under a minute at every level', () => {
    const seconds = TOWN_JEWELS.map(({ small, large }) => (small + large) * SMELT_SECONDS);
    for (const each of seconds) expect(each).toBeLessThanOrEqual(SMELT_LIMIT_SEC);
    expect(seconds.at(-1)).toBe(51);
  });

  it('halves each count on a replay, rounded down, at every level', () => {
    for (let level = FIRST_LEVEL; level <= FINAL_LEVEL; level++) {
      const full = treasureCounts(level, false);
      expect(treasureCounts(level, true)).toEqual({ small: Math.floor(full.small / 2), large: Math.floor(full.large / 2) });
    }
  });
});

describe('placing treasure', () => {
  it('home off places no treasure', () => {
    const state = stateOf(new GameSimulation({ seed: SEED }));
    expect(treasureIn(state)).toEqual({ small: 0, large: 0 });
    expect(state.pickups.some((item) => isTreasurePickup(item.type))).toBe(false);
    placeTownTreasure(state);
    expect(treasureIn(state)).toEqual({ small: 0, large: 0 });
  });

  it('treasure leaves ammo in town and every roll on sim.rng as they were', () => {
    const classic = stateOf(new GameSimulation({ seed: SEED }));
    const { state } = townAt(1);
    expect(treasureIn(state).small).toBeGreaterThan(0);
    // Salvage goes in after treasure and is held to the same rule, so both come out.
    const stripped = state.containers.map(({ loot }) => (loot && isHomeFind(loot.type) ? null : loot));
    expect(stripped).toEqual(classic.containers.map(({ loot }) => loot));
    expect(state.pickups).toEqual(classic.pickups);
    expect(state.nextEntity).toBe(classic.nextEntity);
    expect(state.rng()).toBe(classic.rng());
  });

  it('only takes a container that was empty', () => {
    const classic = stateOf(new GameSimulation({ seed: SEED }));
    const { state } = townAt(1);
    state.containers.forEach(({ loot }, id) => {
      const wasFilled = classic.containers[id].loot !== null;
      if (wasFilled) expect(loot).toEqual(classic.containers[id].loot);
    });
  });

  it('places the table\'s jewels at levels 1 and 10', () => {
    expect(treasureIn(townAt(1).state)).toEqual(TOWN_JEWELS[0]);
    expect(treasureIn(townAt(FINAL_LEVEL).state)).toEqual(TOWN_JEWELS[FINAL_LEVEL - FIRST_LEVEL]);
  });

  it('places only jewels, each at its full value, and nothing on the ground', () => {
    for (const level of [FIRST_LEVEL, FINAL_LEVEL]) {
      const { state } = townAt(level);
      const treasure = state.containers.flatMap(({ loot }) => (loot && isTreasurePickup(loot.type) ? [loot] : []));
      expect(treasure.length).toBeGreaterThan(0);
      for (const { type, rounds } of treasure) expect(rounds).toBe(type === 'jewel_large' ? LARGE_JEWEL_SILVER : SMALL_JEWEL_SILVER);
      expect(state.pickups.some((item) => isTreasurePickup(item.type))).toBe(false);
    }
  });

  it('a replay places half as many treasures, rounded down, at full value', () => {
    const full = treasureIn(townAt(2).state);
    const replay = townAt(2, 3).state;
    const half = treasureIn(replay);
    expect(half).toEqual({ small: Math.floor(full.small / 2), large: Math.floor(full.large / 2) });
    for (const { loot } of replay.containers) {
      if (loot?.type === 'jewel_small') expect(loot.rounds).toBe(40);
      if (loot?.type === 'jewel_large') expect(loot.rounds).toBe(200);
    }
  });

  it('places the same town the same way twice', () => {
    expect(townAt(3).state.containers).toEqual(townAt(3).state.containers);
  });
});

describe('taking treasure', () => {
  it('a jewel vanishes when taken, and is carried as a jewel, not as silver', () => {
    const { sim, state } = homeSim();
    const [p] = state.players;
    spawnPickup(state, 'jewel_small', p.x, p.y, 40);
    spawnPickup(state, 'jewel_large', p.x, p.y, 200);
    steps(sim, 2);
    expect(state.pickups).toEqual([]);
    expect(p.home?.silver).toBe(0);
    expect(p.home?.jewels).toEqual({ small: 1, large: 1 });
  });

  it('numbers treasure on its own counter, off entityId', () => {
    const { state } = homeSim();
    const before = state.nextEntity;
    spawnPickup(state, 'jewel_large', 0, 0, 200);
    spawnPickup(state, 'jewel_small', 0, 0, 40);
    spawnPickup(state, 'bandage', 0, 0);
    expect(state.pickups.map((item) => item.id).slice(0, 2)).toEqual(['t0', 't1']);
    expect(state.homeRun?.nextTreasure).toBe(2);
    expect(state.nextEntity).toBe(before + 1);
  });
});

describe('dropping what was carried', () => {
  it('a dead player\'s carried jewels drop where they fell, p.home.lost records them, and a teammate can take them', () => {
    const { sim, state } = homeSim({ players: ['a', 'b'] });
    const [a, b] = state.players;
    if (!a.home || !b.home) throw new Error('no home');
    a.x = 100;
    a.y = 100;
    a.home.jewels = { small: 2, large: 1 };
    a.status = 'dead';
    dropCarried(state, a);
    expect(a.home.jewels).toEqual({ small: 0, large: 0 });
    expect(a.home.lost).toEqual({ silver: 0, jewels: { small: 2, large: 1 }, salvage: { fuel_can: 0, car_battery: 0, scrap_steel: 0, sedatives: 0 } });
    expect(state.pickups.map((item) => item.type).sort()).toEqual(['jewel_large', 'jewel_small', 'jewel_small']);
    for (const item of state.pickups) expect([item.x, item.y]).toEqual([100, 100]);
    b.x = 100;
    b.y = 100;
    steps(sim, 2);
    expect(state.pickups).toEqual([]);
    expect(b.home?.jewels).toEqual({ small: 2, large: 1 });
  });

  it('writes silver left in the body\'s slot down as lost, and drops no coin', () => {
    const { state } = homeSim();
    const [p] = state.players;
    if (!p.home) throw new Error('no home');
    p.home.silver = 140;
    dropCarried(state, p);
    expect(p.home.silver).toBe(0);
    expect(p.home.lost.silver).toBe(140);
    expect(state.pickups.some((item) => isTreasurePickup(item.type))).toBe(false);
  });

  it('drops nothing when home is off', () => {
    const state = stateOf(new GameSimulation({ seed: SEED }));
    dropCarried(state, state.players[0] ?? ({} as never));
    expect(state.pickups.some((item) => isTreasurePickup(item.type))).toBe(false);
  });
});

describe('searching a treasure container', () => {
  const sol = CHARACTERS.findIndex((character) => character.id === 'sol');
  const TRIALS = 2000;
  const MAX_TICKS = 400;

  function standingSpot(state: SimState, container: Container): { x: number; y: number } {
    const { x0, y0, x1, y1 } = container.box;
    for (let y = y0 - 24; y <= y1 + 24; y += 2) {
      for (let x = x0 - 24; x <= x1 + 24; x += 2) {
        const open = !circleHitsSolid(state.map, x, y, PLAYER_RADIUS);
        const sameRoom = buildingAt(state.map, x, y)?.id === container.building;
        if (open && sameRoom && containerInReach(state.map, x, y, () => false)?.id === container.id) return { x, y };
      }
    }
    throw new Error('nowhere to stand');
  }

  /** Searches one container 2000 times as Kai, holding the given loot, and counts what was turned up besides treasure. */
  function searches(loot: ContainerLoot | null) {
    const { state, p } = townWithSurvivor();
    const container = townContainers(state.map).find((candidate) => candidate.building !== undefined);
    if (!container) throw new Error('no container');
    Object.assign(p, standingSpot(state, container), { skin: sol, moving: false });
    let finds = 0;
    let treasure = 0;
    for (let trial = 0; trial < TRIALS; trial++) {
      state.containers[container.id] = { opened: false, loot };
      state.pickups = [];
      p.searchHeld = false;
      updateSearch(state, p);
      p.searchHeld = true;
      for (let tick = 0; tick < MAX_TICKS && !state.containers[container.id].opened; tick++) updateSearch(state, p);
      finds += state.pickups.filter((item) => !isTreasurePickup(item.type)).length;
      treasure += state.pickups.filter((item) => isTreasurePickup(item.type)).length;
    }
    return { finds, treasure, nextRoll: state.rng(), bottles: p.bottles, nextEntity: state.nextEntity };
  }

  it('a treasure container still makes the luck and bottle rolls', () => {
    const empty = searches(null);
    const holding = searches({ type: 'jewel_small', rounds: SMALL_JEWEL_SILVER });
    expect(empty.finds).toBeGreaterThan(0);
    expect(holding.treasure).toBe(TRIALS);
    expect(holding.finds).toBe(empty.finds);
    expect(holding.bottles).toBe(empty.bottles);
    expect(holding.nextRoll).toBe(empty.nextRoll);
    expect(holding.nextEntity).toBe(empty.nextEntity);
  });

  it('hands out treasure ids from its own counter when a search drops it', () => {
    const { state, p } = townWithSurvivor();
    const container = townContainers(state.map).find((candidate) => candidate.building !== undefined);
    if (!container) throw new Error('no container');
    Object.assign(p, standingSpot(state, container), { moving: false, searchHeld: true });
    state.containers[container.id] = { opened: false, loot: { type: 'jewel_large', rounds: 200 } };
    for (let tick = 0; tick < MAX_TICKS && !state.containers[container.id].opened; tick++) updateSearch(state, p);
    const jewel = state.pickups.find((item) => item.type === 'jewel_large');
    expect(jewel?.id).toBe('t0');
    expect(jewel?.rounds).toBe(200);
  });

  it('knows which pickups are treasure', () => {
    for (const type of TREASURE_TYPES) expect(isTreasurePickup(type)).toBe(true);
    expect(isTreasurePickup('bandage')).toBe(false);
  });
});
