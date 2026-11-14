import { describe, expect, it } from 'vitest';
import { CHARACTERS } from '../shared/characters.ts';
import type { PickupType } from '../shared/protocol.ts';
import { PLAYER_RADIUS } from '../shared/constants.ts';
import { isHomeFind, updateSearch } from '../shared/container-search.ts';
import { containerInReach, townContainers } from '../shared/containers.ts';
import type { Container, ContainerLoot } from '../shared/containers.ts';
import { SALVAGE_TYPES } from '../shared/events.ts';
import type { SalvageCounts } from '../shared/home-protocol.ts';
import { enterTown } from '../shared/level-change.ts';
import { FINAL_LEVEL, FIRST_LEVEL } from '../shared/levels.ts';
import { spawnPickup } from '../shared/pickups.ts';
import { placeTownSalvage, salvageRank } from '../shared/salvage.ts';
import { isSalvagePickup, noSalvage, salvageCounts } from '../shared/salvage-data.ts';
import type { SimState } from '../shared/sim-state.ts';
import { GameSimulation } from '../shared/simulation.ts';
import { dropCarried, isTreasurePickup } from '../shared/treasure.ts';
import { buildingAt, circleHitsSolid } from '../shared/world-query.ts';
import { homeSim } from './helpers/home-harness.ts';
import { SEED, stateOf, steps } from './helpers/sim-harness.ts';

/** What the town's containers hold of salvage. */
function salvageIn(state: SimState): SalvageCounts {
  const found = noSalvage();
  for (const { loot } of state.containers) if (loot && isSalvagePickup(loot.type)) found[loot.type] += 1;
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

describe('placing salvage', () => {
  it('home off places no salvage', () => {
    const state = stateOf(new GameSimulation({ seed: SEED }));
    expect(salvageIn(state)).toEqual(noSalvage());
    placeTownSalvage(state);
    expect(salvageIn(state)).toEqual(noSalvage());
  });

  it('places the same salvage for the same seed', () => {
    expect(townAt(3).state.containers).toEqual(townAt(3).state.containers);
  });

  it('takes only containers still empty after treasure, and leaves treasure and ordinary loot as they were', () => {
    const classic = stateOf(new GameSimulation({ seed: SEED }));
    const { state } = townAt(1);
    let placed = 0;
    state.containers.forEach(({ loot }, id) => {
      const wasFilled = classic.containers[id].loot !== null;
      if (wasFilled) expect(loot).toEqual(classic.containers[id].loot);
      if (loot && isSalvagePickup(loot.type)) {
        placed += 1;
        expect(classic.containers[id].loot).toBeNull();
        expect(loot.rounds).toBe(1);
      }
    });
    expect(placed).toBeGreaterThan(0);
  });

  it('leaves sim.rng, sim.nextEntity and the ground as they were', () => {
    const classic = stateOf(new GameSimulation({ seed: SEED }));
    const { state } = townAt(1);
    expect(state.pickups).toEqual(classic.pickups);
    expect(state.nextEntity).toBe(classic.nextEntity);
    expect(state.rng()).toBe(classic.rng());
  });

  it('places the table\'s counts at levels 1 and 10', () => {
    expect(salvageIn(townAt(FIRST_LEVEL).state)).toEqual(salvageCounts(FIRST_LEVEL, false));
    expect(salvageIn(townAt(FINAL_LEVEL).state)).toEqual(salvageCounts(FINAL_LEVEL, false));
    expect(salvageCounts(FIRST_LEVEL, false)).toEqual({ fuel_can: 3, car_battery: 2, scrap_steel: 3, sedatives: 2 });
    expect(salvageCounts(FINAL_LEVEL, false)).toEqual({ fuel_can: 5, car_battery: 4, scrap_steel: 5, sedatives: 3 });
  });

  it('a replay places half of each, rounded down', () => {
    const full = salvageIn(townAt(2).state);
    const half = salvageIn(townAt(2, 3).state);
    for (const type of SALVAGE_TYPES) expect(half[type]).toBe(Math.floor(full[type] / 2));
  });

  it('puts each kind in its sources, rank 0 before rank 1', () => {
    for (const level of [FIRST_LEVEL, FINAL_LEVEL]) {
      const { state } = townAt(level);
      const containers = townContainers(state.map);
      for (const type of SALVAGE_TYPES) {
        const placed = containers.filter((container) => state.containers[container.id].loot?.type === type);
        for (const container of placed) expect(salvageRank(type, container), `${type} in ${container.buildingKind} ${container.kind}`).not.toBeNull();
        const usesRankOne = placed.some((container) => salvageRank(type, container) === 1);
        if (!usesRankOne) continue;
        const rankZero = containers.filter((container) => container.kind !== 'bowl' && container.kind !== 'booth' && salvageRank(type, container) === 0);
        for (const container of rankZero) expect(state.containers[container.id].loot).not.toBeNull();
      }
    }
  });

  it('ranks containers by the source table', () => {
    const at = (buildingKind: Container['buildingKind'], kind: Container['kind']) => ({ buildingKind, kind }) as Container;
    expect(salvageRank('fuel_can', at('outdoors', 'car'))).toBe(0);
    expect(salvageRank('fuel_can', at('garage', 'shelf'))).toBe(0);
    expect(salvageRank('fuel_can', at('warehouse', 'box'))).toBe(1);
    expect(salvageRank('car_battery', at('garage', 'cabinet'))).toBe(1);
    expect(salvageRank('sedatives', at('pharmacy', 'shelf'))).toBe(0);
    expect(salvageRank('sedatives', at('house', 'drawer'))).toBe(1);
    expect(salvageRank('scrap_steel', at('house', 'drawer'))).toBeNull();
  });
});

describe('taking and dropping salvage', () => {
  it('walking over a bundle carries all of it, numbered on treasure\'s counter', () => {
    const { sim, state } = homeSim();
    const [p] = state.players;
    const before = state.nextEntity;
    spawnPickup(state, 'fuel_can', p.x, p.y, 1);
    spawnPickup(state, 'sedatives', p.x, p.y, 3);
    expect(state.pickups.map((item) => item.id)).toEqual(['t0', 't1']);
    expect(state.nextEntity).toBe(before);
    steps(sim, 2);
    expect(state.pickups).toEqual([]);
    expect(p.home?.salvage).toEqual({ ...noSalvage(), fuel_can: 1, sedatives: 3 });
  });

  it('a death drops one bundle per kind, at most four, p.home.lost records them, and a teammate can take them', () => {
    const { sim, state } = homeSim({ players: ['a', 'b'] });
    const [a, b] = state.players;
    if (!a.home || !b.home) throw new Error('no home');
    a.x = 100;
    a.y = 100;
    a.home.salvage = { fuel_can: 5, car_battery: 2, scrap_steel: 7, sedatives: 1 };
    a.status = 'dead';
    dropCarried(state, a);
    const bundles = state.pickups.filter((item) => isSalvagePickup(item.type));
    expect(bundles).toHaveLength(4);
    expect(a.home.salvage).toEqual(noSalvage());
    expect(a.home.lost.salvage).toEqual({ fuel_can: 5, car_battery: 2, scrap_steel: 7, sedatives: 1 });
    b.x = 100;
    b.y = 100;
    steps(sim, 2);
    expect(state.pickups.filter((item) => isSalvagePickup(item.type))).toEqual([]);
    expect(b.home.salvage).toEqual({ fuel_can: 5, car_battery: 2, scrap_steel: 7, sedatives: 1 });
  });

  it('drops no bundle for a kind not carried', () => {
    const { state } = homeSim();
    const [p] = state.players;
    if (!p.home) throw new Error('no home');
    p.home.salvage = { ...noSalvage(), car_battery: 2 };
    dropCarried(state, p);
    expect(state.pickups.map((item) => [item.type, item.rounds])).toEqual([['car_battery', 2]]);
  });

  it('a player with no home leaves salvage on the ground', () => {
    const sim = new GameSimulation({ seed: SEED });
    sim.addPlayer('a', 'a');
    const state = stateOf(sim);
    const [p] = state.players;
    spawnPickup(state, 'scrap_steel', p.x, p.y, 1);
    steps(sim, 2);
    expect(state.pickups.some((item) => item.type === 'scrap_steel')).toBe(true);
  });
});

describe('searching a salvage container', () => {
  const sol = CHARACTERS.findIndex((character) => character.id === 'sol');
  const TRIALS = 600;
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

  /** Searches one container many times as Sol, holding the given loot, and counts what was turned up besides home finds. */
  function searches(loot: ContainerLoot | null) {
    const { sim, state } = townAt(1);
    sim.addPlayer('a', 'a');
    const [p] = state.players;
    const container = townContainers(state.map).find((candidate) => candidate.building !== undefined);
    if (!container) throw new Error('no container');
    Object.assign(p, standingSpot(state, container), { skin: sol, moving: false });
    let finds = 0;
    let salvage = 0;
    let bottles = 0;
    for (let trial = 0; trial < TRIALS; trial++) {
      state.containers[container.id] = { opened: false, loot };
      state.pickups = [];
      p.searchHeld = false;
      updateSearch(state, p);
      p.searchHeld = true;
      for (let tick = 0; tick < MAX_TICKS && !state.containers[container.id].opened; tick++) updateSearch(state, p);
      // A search lays its finds in the container's grid, bottles included.
      const laid = state.containers[container.id].items ?? [];
      finds += laid.filter((item) => !isHomeFind(item.type as PickupType) && item.type !== 'bottle').length;
      salvage += laid.filter((item) => isSalvagePickup(item.type as PickupType)).length;
      bottles += laid.filter((item) => item.type === 'bottle').length;
    }
    return { finds, salvage, nextRoll: state.rng(), bottles, nextEntity: state.nextEntity };
  }

  it('still makes the luck and bottle rolls, as treasure does', () => {
    const empty = searches(null);
    const holding = searches({ type: 'scrap_steel', rounds: 1 });
    expect(empty.finds).toBeGreaterThan(0);
    expect(holding.salvage).toBe(TRIALS);
    // Laying the salvage in the grid draws from the same rng as the rolls after it, so the streams drift apart
    // and the counts are only alike, not identical.
    // Counts are random: allow four standard deviations of counting noise on either side.
    expect(Math.abs(holding.finds - empty.finds)).toBeLessThan(4 * Math.sqrt(empty.finds + holding.finds));
    expect(empty.bottles).toBeGreaterThan(0);
    expect(Math.abs(holding.bottles - empty.bottles)).toBeLessThan(4 * Math.sqrt(empty.bottles + holding.bottles));
    expect(holding.nextEntity).toBe(empty.nextEntity);
  });

  it('counts salvage and treasure as home finds, and nothing else', () => {
    for (const type of SALVAGE_TYPES) expect(isHomeFind(type)).toBe(true);
    expect(isHomeFind('jewel_small')).toBe(true);
    expect(isHomeFind('bandage')).toBe(false);
    expect(isTreasurePickup('fuel_can')).toBe(false);
  });
});
