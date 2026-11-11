// The things a survivor carries to use on themselves: a bandage, and the four survival items. Each sits in the
// bag as one item per unit, and is counted on the player the way medkits are. What they do is in supplies.ts.

export const SUPPLY_TYPES = ['bandage', 'canned_food', 'water_bottle', 'disinfectant', 'antibiotics'] as const;
export type SupplyType = (typeof SUPPLY_TYPES)[number];

export type Supplies = Record<SupplyType, number>;

export function emptySupplies(): Supplies {
  return { bandage: 0, canned_food: 0, water_bottle: 0, disinfectant: 0, antibiotics: 0 };
}

export function isSupplyType(value: unknown): value is SupplyType {
  return typeof value === 'string' && (SUPPLY_TYPES as readonly string[]).includes(value);
}

/** True when at least one of anything is carried: a snapshot leaves the field off otherwise. */
export function hasSupplies(supplies: Supplies | undefined): supplies is Supplies {
  return supplies !== undefined && SUPPLY_TYPES.some((type) => supplies[type] > 0);
}
