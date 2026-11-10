// Salvage in the sim: placed, taken and dropped.
// Like treasure, it keeps its own generator and shares treasure's id counter, off `entityId()`, `sim.rng` and the ammo budget.

import { townContainers } from './containers.ts';
import type { Container } from './containers.ts';
import { SALVAGE_TYPES } from './events.ts';
import type { SalvageId } from './home-protocol.ts';
import { createRng, shuffle } from './rng.ts';
import { noSalvage, SALVAGE_SALT, SALVAGE_SOURCES, salvageCounts } from './salvage-data.ts';
import type { SalvageSource } from './salvage-data.ts';
import type { PickupState, PlayerState, SimState } from './sim-state.ts';

function fromSource(container: Container, source: SalvageSource): boolean {
  const isRightPlace = source.where === 'anywhere' || source.where === container.buildingKind;
  if (!isRightPlace) return false;
  return source.kinds === undefined || source.kinds.includes(container.kind);
}

/** 0 or 1 for a container in one of the kind's sources, or null for none. */
export function salvageRank(type: SalvageId, container: Container): number | null {
  const rank = SALVAGE_SOURCES[type].findIndex((sources) => sources.some((source) => fromSource(container, source)));
  return rank < 0 ? null : rank;
}

/** Leaves salvage in town containers still empty after treasure, picked from the town's seed alone. Does nothing outside a home room. */
export function placeTownSalvage(sim: SimState): void {
  const run = sim.homeRun;
  if (!run) return;
  const rng = createRng(sim.map.seed ^ SALVAGE_SALT);
  const counts = salvageCounts(sim.level, sim.level < run.roomHighest);
  const empty = townContainers(sim.map).filter((container) => container.kind !== 'bowl' && container.kind !== 'booth' && sim.containers[container.id].loot === null);
  const shuffled = shuffle(rng, [...empty]);
  for (const type of SALVAGE_TYPES) {
    const ranked = shuffled
      .filter((container) => sim.containers[container.id].loot === null && salvageRank(type, container) !== null)
      .sort((a, b) => salvageRank(type, a)! - salvageRank(type, b)!);
    for (const container of ranked.slice(0, counts[type])) sim.containers[container.id].loot = { type, rounds: 1 };
  }
}

/** Salvage is numbered on treasure's counter, so it never moves `sim.nextEntity`. `rounds` is how many the bundle holds. */
export function spawnSalvage(sim: SimState, type: SalvageId, x: number, y: number, rounds: number): void {
  const serial = sim.homeRun?.nextTreasure ?? 0;
  if (sim.homeRun) sim.homeRun.nextTreasure = serial + 1;
  sim.pickups.push({ id: `t${serial}`, type, x, y, ttl: null, rounds });
}

/** Whoever touches it carries the whole bundle, uncapped. False leaves the item on the ground. */
export function takeSalvage(p: PlayerState, item: PickupState, type: SalvageId): boolean {
  const { home } = p;
  if (!home) return false;
  home.salvage = { ...home.salvage, [type]: home.salvage[type] + item.rounds };
  // Zero rounds is how the pickup loop knows it is spent.
  item.rounds = 0;
  return true;
}

/** One bundle per kind carried falls where they stood, so a death adds at most four pickups, and all of it is written down in `p.home.lost`. */
export function dropSalvage(sim: SimState, p: PlayerState): void {
  const { home } = p;
  if (!home) return;
  const lost = { ...home.lost.salvage };
  for (const type of SALVAGE_TYPES) {
    const carried = home.salvage[type];
    if (carried <= 0) continue;
    spawnSalvage(sim, type, p.x, p.y, carried);
    lost[type] += carried;
  }
  home.lost = { ...home.lost, salvage: lost };
  home.salvage = noSalvage();
}
