// Salvage as data: what each kind is called, where a town keeps it, how much a town holds and
// what the press makes of it. Pure tables, so the sim, the save and the screens all read one copy.

import type { ContainerKind } from './containers.ts';
import { SALVAGE_TYPES } from './events.ts';
import type { SalvageCounts, SalvageId } from './home-protocol.ts';
import { FINAL_LEVEL, FIRST_LEVEL } from './levels.ts';
import type { BuildingKind, PickupType } from './protocol.ts';
import type { GunEffect } from './round-effect-data.ts';

/** Keeps the salvage rolls apart from the town's own use of its seed and from treasure's. */
export const SALVAGE_SALT = 0x53414c56;

export const isSalvagePickup = (type: PickupType): type is SalvageId => SALVAGE_TYPES.includes(type as SalvageId);

export const SALVAGE_LABEL: Record<SalvageId, string> = {
  fuel_can: 'Fuel can',
  car_battery: 'Car battery',
  scrap_steel: 'Scrap steel',
  sedatives: 'Sedatives',
};

/** Containers of these kinds, in a building of this kind; no `kinds` means any container there, and `anywhere` any building or outdoors. */
export interface SalvageSource {
  readonly where: BuildingKind | 'outdoors' | 'anywhere';
  readonly kinds?: readonly ContainerKind[];
}

/** Rank 0 first, rank 1 once rank 0 is used up. Mirrors `KIT_SOURCES`. */
export const SALVAGE_SOURCES: Record<SalvageId, readonly [readonly SalvageSource[], readonly SalvageSource[]]> = {
  fuel_can: [
    [{ where: 'anywhere', kinds: ['car'] }, { where: 'garage' }],
    [{ where: 'warehouse', kinds: ['box', 'shelf'] }],
  ],
  car_battery: [
    [{ where: 'outdoors', kinds: ['car'] }, { where: 'garage', kinds: ['car'] }],
    [{ where: 'garage', kinds: ['shelf', 'cabinet'] }],
  ],
  scrap_steel: [
    [{ where: 'warehouse', kinds: ['box', 'shelf', 'cabinet'] }],
    [{ where: 'outdoors', kinds: ['box'] }, { where: 'garage', kinds: ['cabinet'] }],
  ],
  sedatives: [
    [{ where: 'pharmacy' }, { where: 'clinic' }],
    [{ where: 'police', kinds: ['locker'] }, { where: 'house', kinds: ['drawer'] }],
  ],
};

/** What a town holds of each at the first and the last level; the levels between go in a straight line, rounded. */
const FIRST_COUNTS: SalvageCounts = { fuel_can: 3, car_battery: 2, scrap_steel: 3, sedatives: 2 };
const LAST_COUNTS: SalvageCounts = { fuel_can: 5, car_battery: 4, scrap_steel: 5, sedatives: 3 };

/** A replay holds half of each, rounded down, as `treasureCounts` does. */
export function salvageCounts(level: number, replay: boolean): SalvageCounts {
  const clamped = Math.min(FINAL_LEVEL, Math.max(FIRST_LEVEL, level));
  const along = (clamped - FIRST_LEVEL) / (FINAL_LEVEL - FIRST_LEVEL);
  const count = (id: SalvageId): number => {
    const full = Math.round(FIRST_COUNTS[id] + (LAST_COUNTS[id] - FIRST_COUNTS[id]) * along);
    return replay ? Math.floor(full / 2) : full;
  };
  return { fuel_can: count('fuel_can'), car_battery: count('car_battery'), scrap_steel: count('scrap_steel'), sedatives: count('sedatives') };
}

export interface SalvageRecipe {
  readonly salvage: SalvageId;
  readonly count: number;
}

/** One kind per kit (open question 16's default). */
export const SALVAGE_RECIPES: Record<GunEffect, SalvageRecipe> = {
  incendiary: { salvage: 'fuel_can', count: 4 },
  acid: { salvage: 'car_battery', count: 3 },
  piercing: { salvage: 'scrap_steel', count: 3 },
  tranq: { salvage: 'sedatives', count: 2 },
};

export const noSalvage = (): SalvageCounts => ({ fuel_can: 0, car_battery: 0, scrap_steel: 0, sedatives: 0 });
