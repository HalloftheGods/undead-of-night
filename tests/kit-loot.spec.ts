import { describe, expect, it, vi } from 'vitest';
import { townContainers } from '../shared/containers.ts';
import { kitsInTown } from '../shared/kit-loot.ts';
import { FINAL_LEVEL, FIRST_LEVEL } from '../shared/levels.ts';
import { createRng } from '../shared/rng.ts';
import { KIT_CARRY_CAP, KIT_ORDER, KIT_SOURCES } from '../shared/round-effect-data.ts';
import type { RoundKitId } from '../shared/round-effect-data.ts';
import { isKitPickup } from '../shared/round-effects.ts';
import type { SimState } from '../shared/sim-state.ts';
import { GameSimulation } from '../shared/simulation.ts';
import { PLAYER_RADIUS } from '../shared/constants.ts';
import { buildingAt, circleHitsSolid } from '../shared/world-query.ts';
import { eventsOf, input, quietSim, stateOf, steps } from './helpers/sim-harness.ts';

// Every test here builds whole towns across many seeds, so cost scales with machine load.
vi.setConfig({ testTimeout: 120_000 });

const SEEDS = Array.from({ length: 24 }, (_, i) => 100 + i);

function town(seed: number, level: number): SimState {
  const sim = new GameSimulation({ seed, startLevel: level });
  return stateOf(sim);
}

const onFloors = (state: SimState) => state.pickups.filter((item) => isKitPickup(item.type));
const inContainers = (state: SimState) => state.containers.filter(({ loot }) => loot !== null && isKitPickup(loot.type));
const kitsIn = (state: SimState): number => onFloors(state).length + inContainers(state).length;

describe('round kits in town', () => {
  it.each(SEEDS.slice(0, 8))('seed %i: comes to three or four a town at every level', (seed) => {
    for (let level = FIRST_LEVEL; level <= FINAL_LEVEL; level += 3) {
      const count = kitsIn(town(seed, level));
      expect(count).toBeGreaterThanOrEqual(3);
      expect(count).toBeLessThanOrEqual(4);
    }
  });

  it('turns up on floors and in containers', () => {
    const towns = SEEDS.map((seed) => town(seed, FIRST_LEVEL));
    expect(towns.some((state) => onFloors(state).length > 0)).toBe(true);
    expect(towns.some((state) => inContainers(state).length > 0)).toBe(true);
  });

  it('gets only gently more common later on', () => {
    const average = (level: number): number => {
      const rng = createRng(level);
      let total = 0;
      for (let i = 0; i < 4000; i++) total += kitsInTown(rng, level);
      return total / 4000;
    };
    expect(average(FINAL_LEVEL)).toBeGreaterThan(average(FIRST_LEVEL));
    expect(average(FINAL_LEVEL)).toBeLessThan(average(FIRST_LEVEL) * 1.35);
  });

  it('lies only where such things are kept, whichever is rolled', () => {
    const seen = new Set<string>();
    for (const seed of SEEDS) {
      const state = town(seed, 5);
      for (const item of onFloors(state)) {
        const building = buildingAt(state.map, item.x, item.y);
        expect(building && KIT_SOURCES[building.kind]).toBeTruthy();
        seen.add(item.type);
      }
      const containers = townContainers(state.map);
      inContainers(state).forEach((held) => {
        const { buildingKind } = containers[state.containers.indexOf(held)];
        expect(KIT_SOURCES[buildingKind as keyof typeof KIT_SOURCES]).toBeTruthy();
        seen.add(held.loot?.type as string);
      });
    }
    expect([...seen].sort()).toEqual([...KIT_ORDER].sort());
    // Sweeps every seed's town, so it scales with machine load; the global 20s cap is too tight.
  }, 120_000);

  it('is the same for the same town', () => {
    const lay = (state: SimState): string => JSON.stringify([onFloors(state).map(({ type, x, y }) => [type, x, y]), inContainers(state).map(({ loot }) => loot)]);
    expect(lay(town(7, 4))).toBe(lay(town(7, 4)));
  });

  it('never counts towards the ammo in town', () => {
    const state = town(7, 1);
    for (const item of onFloors(state)) expect(item.rounds).toBe(0);
    for (const { loot } of inContainers(state)) expect(loot?.rounds).toBe(0);
  });
});

describe('picking up a round kit', () => {
  const drop = (state: SimState, type: RoundKitId, id: string): void => {
    const [p] = state.players;
    state.pickups.push({ id, type, x: p.x, y: p.y, ttl: null, rounds: 0 });
  };

  it('goes in the bag and tells the room', () => {
    const { sim, state } = quietSim();
    drop(state, 'incendiary_kit', 'kit');
    sim.step();
    expect(state.players[0].kits.incendiary).toBe(1);
    expect(state.pickups.length).toBe(0);
    expect(eventsOf(sim.snapshot(), 'pickup')[0].pickup).toBe('incendiary_kit');
  });

  it('stays on the floor past the cap', () => {
    const { sim, state } = quietSim();
    state.players[0].kits.acid = KIT_CARRY_CAP;
    drop(state, 'acid_kit', 'kit');
    sim.step();
    expect(state.pickups.length).toBe(1);
  });

  it('falls out of a searched container like anything else', () => {
    const { sim, state } = quietSim();
    const [p] = state.players;
    // One with room to stand on its left: a piece against a side wall has none.
    const standable = (box: { x0: number; y0: number; y1: number }) => !circleHitsSolid(state.map, box.x0 - 8, (box.y0 + box.y1) / 2, PLAYER_RADIUS - 0.1) && buildingAt(state.map, box.x0 - 8, box.y0) !== null;
    const container = townContainers(state.map).find(({ box }) => standable(box)) ?? townContainers(state.map)[0];
    state.containers.forEach((each) => {
      each.loot = null;
    });
    state.containers[container.id].loot = { type: 'tranq_kit', rounds: 0 };
    p.x = container.box.x0 - 8;
    p.y = (container.box.y0 + container.box.y1) / 2;
    sim.setInput('a', input({ seq: 1, search: true }));
    steps(sim, 80);
    expect(state.containers[container.id].opened).toBe(true);
    expect(p.kits.tranq).toBe(1);
  });
});
