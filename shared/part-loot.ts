import type { Point } from './flow-field.ts';
import { GUN_QUIRK_ODDS, PARTS_PER_TOWN, QUIRK_ORDER } from './gun-upgrade-data.ts';
import type { PartId } from './gun-upgrade-data.ts';
import { spawnPickup } from './pickups.ts';
import type { BuildingInstance, BuildingKind, PickupType } from './protocol.ts';
import { createRng, pick, shuffle } from './rng.ts';
import type { Rng } from './rng.ts';
import type { SimState } from './sim-state.ts';

/** Off the town's seed, so parts leave the run's RNG, and all the loot rolled from it, as it was. */
const PART_SEED_SALT = 0x9a47;
/** Two items closer than this would read as one on the floor. */
const SPOT_GAP = 10;

/** Who keeps what, with relative odds. Toolkits only turn up where people fix things. */
const PART_SOURCES: Partial<Record<BuildingKind, Partial<Record<PartId, number>>>> = {
  gun_shop: { barrel: 3, grip: 3, magazine: 3, suppressor: 2 },
  police: { magazine: 3, grip: 2, barrel: 1, suppressor: 1 },
  garage: { barrel: 2, grip: 2, toolkit: 1 },
  warehouse: { barrel: 1, grip: 1, magazine: 2, toolkit: 1 },
};

const GUN_PICKUPS: ReadonlySet<PickupType> = new Set<PickupType>(['carbine', 'shotgun']);

function rollPart(rng: Rng, odds: Partial<Record<PartId, number>>): PartId {
  const entries = Object.entries(odds) as [PartId, number][];
  let roll = rng() * entries.reduce((sum, [, weight]) => sum + weight, 0);
  for (const [part, weight] of entries) {
    roll -= weight;
    const isRollSpent = roll <= 0;
    if (isRollSpent) return part;
  }
  return entries[0][0];
}

export function freeSpot(sim: SimState, spots: readonly Point[]): Point | null {
  const clear = (spot: Point): boolean => sim.pickups.every((item) => Math.hypot(item.x - spot.x, item.y - spot.y) >= SPOT_GAP);
  return spots.find(clear) ?? null;
}

/** A found gun is sometimes not the gun it left the factory as. */
function rollQuirks(sim: SimState, rng: Rng): void {
  const guns = sim.pickups.filter((item) => GUN_PICKUPS.has(item.type));
  for (const gun of guns) {
    const quirked = rng() < GUN_QUIRK_ODDS;
    if (quirked) gun.quirk = pick(rng, QUIRK_ORDER);
  }
}

/** Runs after the town's own loot. Spots come from the caller, which knows the rooms. */
export function placeTownParts(sim: SimState, spotsIn: (building: BuildingInstance) => readonly Point[]): void {
  const rng = createRng(sim.map.seed ^ PART_SEED_SALT);
  rollQuirks(sim, rng);
  const sources = shuffle(rng, sim.map.buildings.filter((building) => PART_SOURCES[building.kind]));
  for (const building of sources.slice(0, PARTS_PER_TOWN)) {
    const spot = freeSpot(sim, shuffle(rng, [...spotsIn(building)]));
    const odds = PART_SOURCES[building.kind];
    const canPlace = spot !== null && odds !== undefined;
    if (canPlace) spawnPickup(sim, rollPart(rng, odds), spot.x, spot.y);
  }
}
