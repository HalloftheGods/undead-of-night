import { describe, expect, it } from 'vitest';
import { containerInReach, SEARCH_SEC, townContainers } from '../shared/containers.ts';
import { PLAYER_RADIUS, TICK_RATE } from '../shared/constants.ts';
import { radioContainerId } from '../shared/radio.ts';
import type { SimState } from '../shared/sim-state.ts';
import { GameSimulation } from '../shared/simulation.ts';
import { viewFor } from '../shared/snapshot-view.ts';
import { buildingAt, circleHitsSolid } from '../shared/world-query.ts';
import { input, quietSim, stateOf, steps } from './helpers/sim-harness.ts';

const SEEDS = Array.from({ length: 24 }, (_, index) => index + 1);

describe('the Radio', () => {
  const towns = SEEDS.map((seed) => stateOf(new GameSimulation({ seed })));

  const radioSpots = (state: SimState) => townContainers(state.map).filter(({ id }) => state.containers[id].loot?.type === 'radio');
  const inCars = (state: SimState) => radioSpots(state).filter(({ kind }) => kind === 'car');
  const inBuildings = (state: SimState) => radioSpots(state).filter(({ kind }) => kind !== 'car');

  it('is never loose on the floor', () => {
    for (const state of towns) expect(state.pickups.some((item) => item.type === 'radio')).toBe(false);
  });

  it('sits in about one car in ten', () => {
    const cars = towns.flatMap((state) => townContainers(state.map).filter(({ kind }) => kind === 'car')).length;
    const share = towns.flatMap(inCars).length / cars;
    expect(share).toBeGreaterThan(0.05);
    expect(share).toBeLessThan(0.15);
    expect(towns.filter((state) => inCars(state).length > 0).length).toBeGreaterThan(SEEDS.length * 0.75);
  });

  it('is in at most one building a town, and only some towns', () => {
    for (const state of towns) expect(inBuildings(state).length).toBeLessThanOrEqual(1);
    const withRadio = towns.filter((state) => inBuildings(state).length > 0).length;
    expect(withRadio).toBeGreaterThan(SEEDS.length * 0.25);
    expect(withRadio).toBeLessThan(SEEDS.length * 0.75);
  });

  it('is left in a home, diner or garage when it is not in a car', () => {
    const left = towns.flatMap(inBuildings);
    expect(left.length).toBeGreaterThan(0);
    for (const { buildingKind } of left) expect(['house', 'apartment', 'diner', 'garage']).toContain(buildingKind);
  });

  it('falls out of the town\'s seed alone, whatever else the run rolled', () => {
    for (const seed of SEEDS.slice(0, 8)) {
      const a = stateOf(new GameSimulation({ seed }));
      const again = stateOf(new GameSimulation({ seed }));
      expect(radioContainerId(again)).toBe(radioContainerId(a));
      const harder = stateOf(new GameSimulation({ seed, difficulty: 'undead_tired' }));
      expect(radioContainerId(harder) === null).toBe(radioContainerId(a) === null);
    }
  });

  it('turns up within the first few levels of most runs', () => {
    const runs = SEEDS.slice(0, 16);
    const found = runs.filter((seed) =>
      [1, 2, 3, 4].some((startLevel) => radioContainerId(stateOf(new GameSimulation({ seed, startLevel }))) !== null),
    );
    expect(found.length / runs.length).toBeGreaterThan(0.8);
  });

  it('is picked up when its container is searched, and tells everyone', () => {
    const quiet = quietSim(['a', 'b']);
    const [p] = quiet.state.players;
    const container = townContainers(quiet.state.map).find((each) => each.buildingKind === 'house' && spotFor(quiet.state, each));
    if (!container) throw new Error('no house container');
    const spot = spotFor(quiet.state, container) as { x: number; y: number };
    p.x = spot.x;
    p.y = spot.y;
    quiet.state.containers[container.id].loot = { type: 'radio', rounds: 0 };
    quiet.sim.setInput('a', input({ seq: 1, search: true }));
    steps(quiet.sim, Math.ceil(SEARCH_SEC[container.kind] * TICK_RATE) + 3);
    const frame = quiet.sim.snapshot();
    const found = (events: typeof frame.events) => events.filter((event) => event.type === 'pickup' && event.pickup === 'radio');
    expect(found(frame.events)).toHaveLength(1);
    expect(found(viewFor(frame, 'b').events)).toHaveLength(1);
    expect(quiet.state.pickups.some((item) => item.type === 'radio')).toBe(false);
  });
});

function spotFor(state: SimState, container: ReturnType<typeof townContainers>[number]): { x: number; y: number } | null {
  const { x0, y0, x1, y1 } = container.box;
  for (let y = y0 - 24; y <= y1 + 24; y += 2) {
    for (let x = x0 - 24; x <= x1 + 24; x += 2) {
      const open = !circleHitsSolid(state.map, x, y, PLAYER_RADIUS);
      const sameRoom = buildingAt(state.map, x, y)?.id === container.building;
      if (open && sameRoom && containerInReach(state.map, x, y, () => false)?.id === container.id) return { x, y };
    }
  }
  return null;
}
