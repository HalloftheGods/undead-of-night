import type { BuildingKind } from './protocol.ts';

export type SurvivalItemType = 'canned_food' | 'water_bottle' | 'disinfectant' | 'antibiotics';

export type WoundType = 'none' | 'scratch' | 'laceration' | 'bite';

export interface SurvivalItemDef {
  readonly type: SurvivalItemType;
  readonly name: string;
  readonly label: string;
  readonly description: string;
  readonly hungerDelta: number;
  readonly thirstDelta: number;
  readonly fatigueDelta: number;
  readonly healthRestore: number;
  readonly cleansWound: boolean;
  readonly slowsInfection: boolean;
}

export const SURVIVAL_ITEMS: Record<SurvivalItemType, SurvivalItemDef> = {
  canned_food: {
    type: 'canned_food',
    name: 'Canned Food',
    label: 'CANNED FOOD',
    description: 'Preserved rations. Restores substantial hunger and minor vitality.',
    hungerDelta: -45,
    thirstDelta: -5,
    fatigueDelta: -5,
    healthRestore: 8,
    cleansWound: false,
    slowsInfection: false,
  },
  water_bottle: {
    type: 'water_bottle',
    name: 'Bottled Water',
    label: 'BOTTLED WATER',
    description: 'Clean drinking water. Quenches thirst and recharges stamina.',
    hungerDelta: 0,
    thirstDelta: -55,
    fatigueDelta: -10,
    healthRestore: 0,
    cleansWound: false,
    slowsInfection: false,
  },
  disinfectant: {
    type: 'disinfectant',
    name: 'Disinfectant Alcohol',
    label: 'DISINFECTANT',
    description: 'Medical antiseptic. Sterilizes wounds and cures scratch/cut sepsis.',
    hungerDelta: 0,
    thirstDelta: 0,
    fatigueDelta: 0,
    healthRestore: 0,
    cleansWound: true,
    slowsInfection: false,
  },
  antibiotics: {
    type: 'antibiotics',
    name: 'Broad-Spectrum Antibiotics',
    label: 'ANTIBIOTICS',
    description: 'Potent antibacterial pills. Stalls the zombie infection cycle.',
    hungerDelta: 0,
    thirstDelta: 0,
    fatigueDelta: 0,
    healthRestore: 0,
    cleansWound: false,
    slowsInfection: true,
  },
};

export interface SurvivalNeeds {
  hunger: number;
  thirst: number;
  fatigue: number;
  wound: WoundType;
  bleeding: boolean;
  bleedTimer: number;
  infection: number;
  isInfected: boolean;
}

export const HUNGER_DECAY_RATE = 0.12;
export const THIRST_DECAY_RATE = 0.20;
export const FATIGUE_SPRINT_RATE = 1.8;
export const FATIGUE_RECOVERY_RATE = 0.6;

export const BLEED_TICK_SEC = 3.0;
export const BLEED_DAMAGE = 4.0;
export const INFECTION_GROWTH_RATE = 0.45;

export const SCRATCH_BLEED_CHANCE = 0.35;
export const SCRATCH_INFECTION_CHANCE = 0.05;
export const LACERATION_BLEED_CHANCE = 1.0;
export const LACERATION_INFECTION_CHANCE = 0.25;
export const BITE_BLEED_CHANCE = 1.0;
export const BITE_INFECTION_CHANCE = 1.0;

export function createDefaultSurvivalNeeds(): SurvivalNeeds {
  return {
    hunger: 0,
    thirst: 0,
    fatigue: 0,
    wound: 'none',
    bleeding: false,
    bleedTimer: 0,
    infection: 0,
    isInfected: false,
  };
}

export interface SurvivalLootRule {
  readonly odds: number;
  readonly table: Partial<Record<SurvivalItemType, number>>;
}

export const SURVIVAL_LOOT_TABLES: Record<BuildingKind | 'outdoors', SurvivalLootRule> = {
  grocery: { odds: 0.42, table: { canned_food: 5, water_bottle: 4 } },
  diner: { odds: 0.38, table: { canned_food: 4, water_bottle: 3 } },
  pharmacy: { odds: 0.45, table: { disinfectant: 4, antibiotics: 3, water_bottle: 2 } },
  clinic: { odds: 0.50, table: { disinfectant: 4, antibiotics: 4, water_bottle: 1 } },
  hospital: { odds: 0.50, table: { disinfectant: 5, antibiotics: 5 } },
  hospital_upstairs: { odds: 0.45, table: { disinfectant: 4, antibiotics: 4 } },
  house: { odds: 0.28, table: { canned_food: 2, water_bottle: 2, disinfectant: 1 } },
  apartment: { odds: 0.28, table: { canned_food: 2, water_bottle: 2, disinfectant: 1 } },
  upstairs: { odds: 0.24, table: { canned_food: 1, water_bottle: 1 } },
  apartment_upstairs: { odds: 0.24, table: { canned_food: 1, water_bottle: 1 } },
  school: { odds: 0.20, table: { water_bottle: 3, canned_food: 1 } },
  school_upstairs: { odds: 0.20, table: { water_bottle: 2, canned_food: 1 } },
  discount: { odds: 0.30, table: { canned_food: 3, water_bottle: 3, disinfectant: 1 } },
  warehouse: { odds: 0.22, table: { water_bottle: 2, canned_food: 2 } },
  garage: { odds: 0.18, table: { water_bottle: 1, disinfectant: 1 } },
  police: { odds: 0.22, table: { water_bottle: 2, antibiotics: 1 } },
  gun_shop: { odds: 0.15, table: { water_bottle: 1 } },
  cellar: { odds: 0.25, table: { canned_food: 2, water_bottle: 1 } },
  sewer_junction: { odds: 0, table: {} },
  sewer_tunnel_h: { odds: 0, table: {} },
  sewer_tunnel_v: { odds: 0, table: {} },
  sewer_pump_station: { odds: 0, table: {} },
  outdoors: { odds: 0.08, table: { water_bottle: 1 } },
};

export function scroungeSurvivalLoot(rng: () => number, kind: BuildingKind | 'outdoors'): SurvivalItemType | null {
  const rule = SURVIVAL_LOOT_TABLES[kind];
  const isRolledEmpty = rng() >= rule.odds;
  if (isRolledEmpty) return null;

  const entries = Object.entries(rule.table) as [SurvivalItemType, number][];
  const totalWeight = entries.reduce((sum, [, weight]) => sum + weight, 0);
  const hasNoItems = totalWeight <= 0;
  if (hasNoItems) return null;

  let roll = rng() * totalWeight;
  for (const [item, weight] of entries) {
    roll -= weight;
    const isSelected = roll <= 0;
    if (isSelected) return item;
  }
  return entries[0][0];
}

export function consumeSurvivalItem(needs: SurvivalNeeds, playerHealth: { health: number; maxHealth: number }, type: SurvivalItemType): boolean {
  const def = SURVIVAL_ITEMS[type];
  const isCannedFood = type === 'canned_food';
  if (isCannedFood) {
    const isFullHunger = needs.hunger <= 0;
    const isFullVitality = playerHealth.health >= playerHealth.maxHealth;
    const isRedundant = isFullHunger && isFullVitality;
    if (isRedundant) return false;

    needs.hunger = Math.max(0, needs.hunger + def.hungerDelta);
    needs.thirst = Math.max(0, needs.thirst + def.thirstDelta);
    needs.fatigue = Math.max(0, needs.fatigue + def.fatigueDelta);
    playerHealth.health = Math.min(playerHealth.maxHealth, playerHealth.health + def.healthRestore);
    return true;
  }

  const isWater = type === 'water_bottle';
  if (isWater) {
    const isHydrated = needs.thirst <= 0;
    if (isHydrated) return false;

    needs.thirst = Math.max(0, needs.thirst + def.thirstDelta);
    needs.fatigue = Math.max(0, needs.fatigue + def.fatigueDelta);
    return true;
  }

  const isDisinfectant = type === 'disinfectant';
  if (isDisinfectant) {
    const isClean = needs.wound === 'none' && !needs.bleeding;
    if (isClean) return false;

    const isNonFatalWound = needs.wound === 'scratch' || needs.wound === 'laceration';
    const canCureInfection = isNonFatalWound && needs.isInfected;
    if (canCureInfection) {
      needs.isInfected = false;
      needs.infection = 0;
    }
    return true;
  }

  const isAntibiotic = type === 'antibiotics';
  if (isAntibiotic) {
    const isHealthy = !needs.isInfected && needs.infection <= 0;
    if (isHealthy) return false;

    needs.infection = Math.max(0, needs.infection - 35);
    return true;
  }

  return false;
}

export function inflictWound(needs: SurvivalNeeds, type: WoundType, rng: () => number = Math.random): void {
  const isNoWound = type === 'none';
  if (isNoWound) return;

  needs.wound = type;

  const isScratch = type === 'scratch';
  if (isScratch) {
    const suffersBleed = rng() < SCRATCH_BLEED_CHANCE;
    if (suffersBleed) needs.bleeding = true;
    const suffersInfection = rng() < SCRATCH_INFECTION_CHANCE;
    if (suffersInfection) needs.isInfected = true;
    return;
  }

  const isLaceration = type === 'laceration';
  if (isLaceration) {
    const suffersBleed = rng() < LACERATION_BLEED_CHANCE;
    if (suffersBleed) needs.bleeding = true;
    const suffersInfection = rng() < LACERATION_INFECTION_CHANCE;
    if (suffersInfection) needs.isInfected = true;
    return;
  }

  const isBite = type === 'bite';
  if (isBite) {
    needs.bleeding = true;
    needs.isInfected = true;
  }
}

export function bandageWound(needs: SurvivalNeeds): boolean {
  const isNotBleeding = !needs.bleeding;
  if (isNotBleeding) return false;

  needs.bleeding = false;
  needs.bleedTimer = 0;
  return true;
}

export function staminaRecoveryMultiplier(needs: SurvivalNeeds): number {
  let multiplier = 1.0;
  const isSeverelyStarving = needs.hunger >= 80;
  const isHungry = needs.hunger >= 50 && !isSeverelyStarving;
  if (isSeverelyStarving) multiplier *= 0.65;
  else if (isHungry) multiplier *= 0.85;

  const isDehydrated = needs.thirst >= 80;
  const isThirsty = needs.thirst >= 50 && !isDehydrated;
  if (isDehydrated) multiplier *= 0.50;
  else if (isThirsty) multiplier *= 0.75;

  const isExhausted = needs.fatigue >= 80;
  if (isExhausted) multiplier *= 0.50;

  return multiplier;
}

export function moveSpeedMultiplier(needs: SurvivalNeeds): number {
  let multiplier = 1.0;
  const isStarving = needs.hunger >= 80;
  if (isStarving) multiplier *= 0.90;

  const isDehydrated = needs.thirst >= 80;
  if (isDehydrated) multiplier *= 0.85;

  const isHeavilyBleeding = needs.bleeding && (needs.wound === 'laceration' || needs.wound === 'bite');
  if (isHeavilyBleeding) multiplier *= 0.85;

  return multiplier;
}

export function updateSurvivalNeeds(
  needs: SurvivalNeeds,
  dt: number,
  isSprinting: boolean,
  isMoving: boolean,
  player?: { health: number; maxHealth: number },
): void {
  const sprintHungerBonus = isSprinting ? 0.5 : 0;
  needs.hunger = Math.min(100, needs.hunger + HUNGER_DECAY_RATE * (1 + sprintHungerBonus) * dt);

  const movingThirstBonus = isMoving ? 0.2 : 0;
  const sprintThirstBonus = isSprinting ? 1.0 : movingThirstBonus;
  needs.thirst = Math.min(100, needs.thirst + THIRST_DECAY_RATE * (1 + sprintThirstBonus) * dt);

  if (isSprinting) {
    needs.fatigue = Math.min(100, needs.fatigue + FATIGUE_SPRINT_RATE * dt);
  } else {
    const recoveryScale = isMoving ? 0.4 : 1.0;
    needs.fatigue = Math.max(0, needs.fatigue - FATIGUE_RECOVERY_RATE * recoveryScale * dt);
  }

  const isBleeding = needs.bleeding;
  if (isBleeding) {
    needs.bleedTimer += dt;
    const isTickReady = needs.bleedTimer >= BLEED_TICK_SEC;
    if (isTickReady) {
      needs.bleedTimer -= BLEED_TICK_SEC;
      const hasPlayer = player !== undefined;
      if (hasPlayer) {
        player.health = Math.max(0, player.health - BLEED_DAMAGE);
      }
    }
  }

  const isInfected = needs.isInfected;
  if (isInfected) {
    needs.infection = Math.min(100, needs.infection + INFECTION_GROWTH_RATE * dt);
    const isTerminal = needs.infection >= 100;
    const hasPlayer = player !== undefined;
    const shouldKill = isTerminal && hasPlayer;
    if (shouldKill) {
      player.health = 0;
    }
  }
}

export function rollCombatWound(needs: SurvivalNeeds, damage: number, rng: () => number = Math.random): WoundType {
  const isDeadlyHit = damage >= 25;
  const biteThreshold = isDeadlyHit ? 0.20 : 0.10;
  const lacerationThreshold = isDeadlyHit ? 0.55 : 0.40;

  const roll = rng();
  const isBite = roll < biteThreshold;
  if (isBite) {
    inflictWound(needs, 'bite', rng);
    return 'bite';
  }

  const isLaceration = roll < lacerationThreshold;
  if (isLaceration) {
    inflictWound(needs, 'laceration', rng);
    return 'laceration';
  }

  inflictWound(needs, 'scratch', rng);
  return 'scratch';
}


