import { describe, expect, it } from 'vitest';
import type { PickupType } from '../shared/protocol.ts';
import { containerInReach, townContainers, type Container } from '../shared/containers.ts';
import { isAmmoPickup } from '../shared/pickups.ts';
import { PLAYER_RADIUS } from '../shared/constants.ts';
import { buildingAt, circleHitsSolid } from '../shared/world-query.ts';
import type { SimState } from '../shared/sim-state.ts';
import { stateOf, input, steps } from './helpers/sim-harness.ts';
import { GameSimulation } from '../shared/simulation.ts';

function quietSimWithSeed(seed: number): { sim: GameSimulation; state: SimState } {
  const sim = new GameSimulation({ seed });
  sim.addPlayer('a', 'a');
  const state = stateOf(sim);
  state.intermissionLeft = 1e6;
  state.zombies = [];
  state.pickups = [];
  state.populationTarget = 0;
  sim.snapshot();
  return { sim, state };
}

function standingSpot(state: SimState, container: Container): { x: number; y: number } | null {
  const { map } = state;
  const { x0, y0, x1, y1 } = container.box;
  const room = 24;
  for (let y = y0 - room; y <= y1 + room; y += 2) {
    for (let x = x0 - room; x <= x1 + room; x += 2) {
      const open = !circleHitsSolid(map, x, y, PLAYER_RADIUS);
      const sameRoom = buildingAt(map, x, y)?.id === container.building;
      const usable = open && sameRoom && containerInReach(map, x, y, () => false)?.id === container.id;
      if (usable) return { x, y };
    }
  }
  return null;
}

describe('Ammo Loot Prioritization for Box Containers', () => {
  it('scrounges ammo at high rates when searching empty box containers', () => {
    let foundAmmoCount = 0;
    const trials = 20;

    for (let i = 0; i < trials; i++) {
      const { sim, state } = quietSimWithSeed(1000 + i * 37);
      const p = state.players[0];
      const box = townContainers(state.map).find((c) => c.kind === 'box' && standingSpot(state, c));
      expect(box).toBeDefined();
      if (!box) continue;

      const spot = standingSpot(state, box);
      if (!spot) continue;

      p.x = spot.x;
      p.y = spot.y;
      state.containers[box.id].opened = false;
      state.containers[box.id].loot = null;

      const beforeAmmo = p.ammoBag.pistol + p.ammoBag.shotgun + p.ammoBag.carbine;
      sim.setInput('a', input({ search: true }));
      steps(sim, 50);

      expect(state.containers[box.id].opened).toBe(true);
      const afterAmmo = p.ammoBag.pistol + p.ammoBag.shotgun + p.ammoBag.carbine;
      const ammoGained = afterAmmo > beforeAmmo || (state.containers[box.id].items ?? []).some((item) => isAmmoPickup(item.type as PickupType));
      if (ammoGained) foundAmmoCount += 1;
    }

    expect(foundAmmoCount / trials).toBeGreaterThanOrEqual(0.35);
    // Builds twenty whole towns, so it scales with machine load; the default cap is too tight.
  }, 120_000);
});
