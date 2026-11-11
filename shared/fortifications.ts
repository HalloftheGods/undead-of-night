import type { BuildingKind } from './map-protocol.ts';
import type { Rng } from './rng.ts';
import { plankCapForTier, type BackpackTier } from './backpack.ts';

export type FortificationItemType = 'plank' | 'nails' | 'hammer_tool' | 'sheet_curtain' | 'crowbar';

export interface FortificationItemDef {
  readonly type: FortificationItemType;
  readonly name: string;
  readonly description: string;
  readonly isTool: boolean;
  readonly unitsPerFind: number;
}

export const FORTIFICATION_ITEMS: Record<FortificationItemType, FortificationItemDef> = {
  plank: { type: 'plank', name: 'Wooden Plank', description: 'Heavy construction timber for barricading doors and windows.', isTool: false, unitsPerFind: 2 },
  nails: { type: 'nails', name: 'Nails', description: 'Steel framing nails needed to fasten barricade planks.', isTool: false, unitsPerFind: 8 },
  hammer_tool: { type: 'hammer_tool', name: 'Claw Hammer', description: 'Carpentry tool for driving nails into wooden barricades.', isTool: true, unitsPerFind: 1 },
  sheet_curtain: { type: 'sheet_curtain', name: 'Sheet Curtain', description: 'Cloth drape hung over windows to block zombie line of sight.', isTool: false, unitsPerFind: 1 },
  crowbar: { type: 'crowbar', name: 'Crowbar', description: 'Heavy iron pry bar to dismantle barricades and clear broken glass.', isTool: true, unitsPerFind: 1 },
};

export const MAX_PLANKS_PER_OPENING = 4;
export const HEALTH_PER_PLANK = 100;
export const NAILS_PER_PLANK = 2;
export const WINDOW_SHATTER_NOISE_RADIUS = 300;
export const BARRICADE_HIT_NOISE_RADIUS = 120;
export const GLASS_LACERATION_ODDS = 0.45;
export const DOOR_BASE_HEALTH = 150;
export const DOOR_MAX_PLANKS = MAX_PLANKS_PER_OPENING;
export const DOOR_MAX_HEALTH = 550;
export const DOOR_DAMAGE_PER_ZOMBIE_SEC = 20;
export const DOOR_SPLINTER_NOISE_RADIUS = 240;

export interface FortificationInventory {
  planks: number;
  nails: number;
  sheets: number;
  hasHammer: boolean;
  hasCrowbar: boolean;
}

export function createEmptyFortificationInventory(): FortificationInventory {
  return { planks: 0, nails: 0, sheets: 0, hasHammer: false, hasCrowbar: false };
}

export type BarricadeOpeningType = 'door' | 'window' | 'passageway' | 'passage';
export type OpeningFacing = 'north' | 'south' | 'east' | 'west';

export interface BarricadeOpening {
  readonly id: string;
  readonly buildingId: string;
  readonly type: BarricadeOpeningType;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly facing: OpeningFacing;
  planks: number;
  health: number;
  maxHealth: number;
  hasCurtain: boolean;
  isCurtainClosed: boolean;
  isBroken: boolean;
  glassCleared: boolean;
  isOpen: boolean;
}

export interface BarricadeOptions {
  planks?: number;
  hasCurtain?: boolean;
  isCurtainClosed?: boolean;
  isBroken?: boolean;
  glassCleared?: boolean;
  isOpen?: boolean;
  health?: number;
  maxHealth?: number;
}

export function createBarricadeOpening(
  id: string,
  buildingId: string,
  type: BarricadeOpeningType,
  x: number,
  y: number,
  w: number,
  h: number,
  facing: OpeningFacing,
  options?: BarricadeOptions
): BarricadeOpening {
  const initialPlanks = Math.max(0, Math.min(MAX_PLANKS_PER_OPENING, options?.planks ?? 0));
  const hasCustomHealth = options?.health !== undefined;
  const defaultPlankHealth = initialPlanks * HEALTH_PER_PLANK;
  const calculatedHealth = hasCustomHealth ? Number(options?.health) : defaultPlankHealth;
  const calculatedMaxHealth = options?.maxHealth ?? calculatedHealth;

  const hasExplicitOpenState = options?.isOpen !== undefined;
  const isDoor = type === 'door';
  const defaultOpenState = !isDoor;
  const resolvedIsOpen = hasExplicitOpenState ? Boolean(options?.isOpen) : defaultOpenState;

  return {
    id,
    buildingId,
    type,
    x,
    y,
    w,
    h,
    facing,
    planks: initialPlanks,
    health: calculatedHealth,
    maxHealth: calculatedMaxHealth,
    hasCurtain: options?.hasCurtain ?? false,
    isCurtainClosed: options?.isCurtainClosed ?? false,
    isBroken: options?.isBroken ?? false,
    glassCleared: options?.glassCleared ?? false,
    isOpen: resolvedIsOpen,
  };
}

export function calculateDoorMaxHealth(planks: number): number {
  const boundedPlanks = Math.max(0, Math.min(MAX_PLANKS_PER_OPENING, planks));
  return DOOR_BASE_HEALTH + boundedPlanks * HEALTH_PER_PLANK;
}

export function createDoorOpening(
  id: string,
  buildingId: string,
  x: number,
  y: number,
  w: number,
  h: number,
  facing: OpeningFacing,
  options?: BarricadeOptions
): BarricadeOpening {
  const initialPlanks = Math.max(0, Math.min(MAX_PLANKS_PER_OPENING, options?.planks ?? 0));
  const doorMaxHealth = calculateDoorMaxHealth(initialPlanks);
  const initialHealth = options?.health ?? doorMaxHealth;

  return createBarricadeOpening(id, buildingId, 'door', x, y, w, h, facing, {
    ...options,
    planks: initialPlanks,
    health: initialHealth,
    maxHealth: options?.maxHealth ?? doorMaxHealth,
    isOpen: options?.isOpen ?? false,
  });
}

export function toggleDoor(opening: BarricadeOpening): boolean {
  const isNotDoor = opening.type !== 'door';
  if (isNotDoor) return false;

  const isBroken = opening.isBroken;
  if (isBroken) return false;

  const isBarricaded = opening.planks > 0;
  if (isBarricaded) return false;

  opening.isOpen = !opening.isOpen;
  return true;
}

export function calculateDoorDamage(zombieCount: number, dt: number): number {
  const hasNoZombies = zombieCount <= 0;
  const hasNoTime = dt <= 0;
  const isInvalid = hasNoZombies || hasNoTime;
  if (isInvalid) return 0;

  return zombieCount * DOOR_DAMAGE_PER_ZOMBIE_SEC * dt;
}

export interface DoorDamageResult {
  readonly damageDealt: number;
  readonly remainingHealth: number;
  readonly brokenPlanks: number;
  readonly destroyed: boolean;
  readonly noiseRadius: number;
}

export function damageDoorOpening(
  opening: BarricadeOpening,
  zombieCount: number,
  dt: number
): DoorDamageResult {
  const isNotDoor = opening.type !== 'door';
  if (isNotDoor) {
    return {
      damageDealt: 0,
      remainingHealth: opening.health,
      brokenPlanks: 0,
      destroyed: opening.isBroken,
      noiseRadius: 0,
    };
  }

  const isAlreadyBroken = opening.isBroken;
  if (isAlreadyBroken) {
    return {
      damageDealt: 0,
      remainingHealth: 0,
      brokenPlanks: 0,
      destroyed: true,
      noiseRadius: 0,
    };
  }

  const needsHealthInit = opening.health <= 0 && opening.maxHealth <= 0;
  if (needsHealthInit) {
    const initializedMaxHealth = calculateDoorMaxHealth(opening.planks);
    opening.health = initializedMaxHealth;
    opening.maxHealth = initializedMaxHealth;
  }

  const damageToApply = calculateDoorDamage(zombieCount, dt);
  const hasNoDamage = damageToApply <= 0;
  if (hasNoDamage) {
    return {
      damageDealt: 0,
      remainingHealth: opening.health,
      brokenPlanks: 0,
      destroyed: false,
      noiseRadius: 0,
    };
  }

  const previousHealth = opening.health;
  const previousPlanks = opening.planks;

  const nextHealth = Math.max(0, previousHealth - damageToApply);
  const actualDamageDealt = previousHealth - nextHealth;
  opening.health = nextHealth;

  const isDestroyed = nextHealth <= 0;
  if (isDestroyed) {
    opening.isBroken = true;
    opening.isOpen = true;
    opening.planks = 0;
    return {
      damageDealt: actualDamageDealt,
      remainingHealth: 0,
      brokenPlanks: previousPlanks,
      destroyed: true,
      noiseRadius: DOOR_SPLINTER_NOISE_RADIUS,
    };
  }

  const plankHealthRemaining = Math.max(0, nextHealth - DOOR_BASE_HEALTH);
  const calculatedSurvivingPlanks = Math.ceil(plankHealthRemaining / HEALTH_PER_PLANK);
  const newPlankCount = Math.min(previousPlanks, calculatedSurvivingPlanks);
  opening.planks = newPlankCount;

  const brokenPlankCount = Math.max(0, previousPlanks - newPlankCount);

  return {
    damageDealt: actualDamageDealt,
    remainingHealth: nextHealth,
    brokenPlanks: brokenPlankCount,
    destroyed: false,
    noiseRadius: 0,
  };
}

export function canAddPlank(materials: FortificationInventory, opening: BarricadeOpening): boolean {
  const isOpeningFull = opening.planks >= MAX_PLANKS_PER_OPENING;
  if (isOpeningFull) return false;

  const hasSufficientPlanks = materials.planks >= 1;
  const hasSufficientNails = materials.nails >= NAILS_PER_PLANK;
  const hasRequiredTool = materials.hasHammer;

  const canAfford = hasSufficientPlanks && hasSufficientNails;
  return canAfford && hasRequiredTool;
}

export function addPlank(materials: FortificationInventory, opening: BarricadeOpening): boolean {
  const eligible = canAddPlank(materials, opening);
  if (!eligible) return false;

  materials.planks -= 1;
  materials.nails -= NAILS_PER_PLANK;
  opening.planks += 1;
  opening.health += HEALTH_PER_PLANK;

  const isDoor = opening.type === 'door';
  const hasDoorBaseHealth = isDoor && opening.maxHealth >= DOOR_BASE_HEALTH;
  const baseHealth = hasDoorBaseHealth ? DOOR_BASE_HEALTH : 0;
  opening.maxHealth = baseHealth + opening.planks * HEALTH_PER_PLANK;
  return true;
}

export function canDismantlePlank(materials: FortificationInventory, opening: BarricadeOpening): boolean {
  const hasPlanksToDismantle = opening.planks > 0;
  const hasDismantleTool = materials.hasCrowbar || materials.hasHammer;
  return hasPlanksToDismantle && hasDismantleTool;
}

export function dismantlePlank(materials: FortificationInventory, opening: BarricadeOpening): boolean {
  const eligible = canDismantlePlank(materials, opening);
  if (!eligible) return false;

  const isDoor = opening.type === 'door';
  const hasDoorBaseHealth = isDoor && opening.maxHealth > opening.planks * HEALTH_PER_PLANK;
  const baseHealth = hasDoorBaseHealth ? DOOR_BASE_HEALTH : 0;

  opening.planks -= 1;
  const targetMaxHealth = baseHealth + opening.planks * HEALTH_PER_PLANK;
  opening.health = Math.min(opening.health, targetMaxHealth);
  opening.maxHealth = targetMaxHealth;
  materials.planks += 1;
  materials.nails += 1;
  return true;
}

export function repairBarricade(materials: FortificationInventory, opening: BarricadeOpening): boolean {
  const hasPlanks = opening.planks > 0;
  const isDamaged = opening.health < opening.maxHealth;
  const hasNails = materials.nails >= 1;
  const hasHammer = materials.hasHammer;

  const canRepair = hasPlanks && isDamaged && hasNails && hasHammer;
  if (!canRepair) return false;

  materials.nails -= 1;
  opening.health = Math.min(opening.maxHealth, opening.health + 50);
  return true;
}

export interface BarricadeDamageResult {
  brokenPlanks: number;
  destroyed: boolean;
  remainingHealth: number;
}

export function damageBarricade(opening: BarricadeOpening, damage: number): BarricadeDamageResult {
  const hasNoPlanks = opening.planks <= 0;
  if (hasNoPlanks) {
    return { brokenPlanks: 0, destroyed: true, remainingHealth: 0 };
  }

  const previousPlanks = opening.planks;
  opening.health = Math.max(0, opening.health - damage);

  const survivingPlanks = Math.ceil(opening.health / HEALTH_PER_PLANK);
  opening.planks = survivingPlanks;
  opening.maxHealth = survivingPlanks * HEALTH_PER_PLANK;

  const brokenPlanks = previousPlanks - survivingPlanks;
  const isDestroyed = opening.planks <= 0;

  return {
    brokenPlanks,
    destroyed: isDestroyed,
    remainingHealth: opening.health,
  };
}

export interface ShatterResult {
  shattered: boolean;
  noiseRadius: number;
}

export function shatterWindow(opening: BarricadeOpening): ShatterResult {
  const isNotWindow = opening.type !== 'window';
  if (isNotWindow) return { shattered: false, noiseRadius: 0 };

  const alreadyBroken = opening.isBroken;
  if (alreadyBroken) return { shattered: false, noiseRadius: 0 };

  opening.isBroken = true;
  opening.glassCleared = false;
  return { shattered: true, noiseRadius: WINDOW_SHATTER_NOISE_RADIUS };
}

export function clearBrokenGlass(opening: BarricadeOpening, hasTool: boolean): boolean {
  const isEligibleWindow = opening.type === 'window' && opening.isBroken;
  const needsClearing = isEligibleWindow && !opening.glassCleared;
  const canClear = needsClearing && hasTool;
  if (!canClear) return false;

  opening.glassCleared = true;
  return true;
}

export function toggleCurtain(opening: BarricadeOpening): boolean {
  const isWindow = opening.type === 'window';
  const hasCurtainInstalled = isWindow && opening.hasCurtain;
  if (!hasCurtainInstalled) return false;

  opening.isCurtainClosed = !opening.isCurtainClosed;
  return true;
}

export function installCurtain(materials: FortificationInventory, opening: BarricadeOpening): boolean {
  const isWindow = opening.type === 'window';
  const canInstall = isWindow && !opening.hasCurtain && materials.sheets >= 1;
  if (!canInstall) return false;

  materials.sheets -= 1;
  opening.hasCurtain = true;
  opening.isCurtainClosed = true;
  return true;
}

export function blocksLineOfSight(opening: BarricadeOpening): boolean {
  const fullBarricade = opening.planks >= MAX_PLANKS_PER_OPENING;
  const closedCurtain = opening.hasCurtain && opening.isCurtainClosed;
  return fullBarricade || closedCurtain;
}

export function blocksPassage(opening: BarricadeOpening): boolean {
  const hasStandingPlanks = opening.planks > 0;
  if (hasStandingPlanks) return true;

  return opening.type === 'window' && !opening.isBroken;
}

export interface FortificationLootRule {
  odds: number;
  table: Partial<Record<FortificationItemType, number>>;
}

export const FORTIFICATION_LOOT: Record<BuildingKind | 'outdoors', FortificationLootRule> = {
  house: { odds: 0.35, table: { sheet_curtain: 4, nails: 3, hammer_tool: 2, plank: 2 } },
  apartment: { odds: 0.30, table: { sheet_curtain: 3, nails: 2, hammer_tool: 1 } },
  upstairs: { odds: 0.25, table: { sheet_curtain: 4, nails: 2, plank: 1 } },
  apartment_upstairs: { odds: 0.25, table: { sheet_curtain: 3, nails: 1 } },
  hospital_upstairs: { odds: 0.15, table: { sheet_curtain: 3 } },
  school_upstairs: { odds: 0.18, table: { crowbar: 1, nails: 1 } },
  sewer_maze: { odds: 0.05, table: { crowbar: 1 } },
  cellar: { odds: 0.50, table: { plank: 4, nails: 4, hammer_tool: 2, crowbar: 2 } },
  diner: { odds: 0.15, table: { sheet_curtain: 2, crowbar: 1 } },
  garage: { odds: 0.65, table: { nails: 6, plank: 5, hammer_tool: 4, crowbar: 3 } },
  warehouse: { odds: 0.60, table: { plank: 6, nails: 5, crowbar: 3, hammer_tool: 2 } },
  grocery: { odds: 0.15, table: { sheet_curtain: 3, nails: 1 } },
  discount: { odds: 0.35, table: { nails: 3, hammer_tool: 2, plank: 2, crowbar: 1 } },
  pharmacy: { odds: 0.12, table: { sheet_curtain: 2 } },
  clinic: { odds: 0.12, table: { sheet_curtain: 2 } },
  hospital: { odds: 0.15, table: { sheet_curtain: 3, crowbar: 1 } },
  school: { odds: 0.20, table: { crowbar: 2, nails: 2, sheet_curtain: 1 } },
  police: { odds: 0.30, table: { crowbar: 3, hammer_tool: 1, plank: 1 } },
  gun_shop: { odds: 0.20, table: { crowbar: 2, hammer_tool: 1 } },
  outdoors: { odds: 0.10, table: { plank: 2, nails: 1 } },
};

export function rollFortificationLoot(
  kind: BuildingKind | 'outdoors',
  rng: Rng
): FortificationItemType | null {
  const rule = FORTIFICATION_LOOT[kind] ?? FORTIFICATION_LOOT.outdoors;
  const roll = rng();
  const didHit = roll < rule.odds;
  if (!didHit) return null;

  const entries = Object.entries(rule.table) as [FortificationItemType, number][];
  const totalWeight = entries.reduce((sum, [, weight]) => sum + weight, 0);
  const target = rng() * totalWeight;

  let accumulated = 0;
  for (const [item, weight] of entries) {
    accumulated += weight;
    const isSelected = target <= accumulated;
    if (isSelected) return item;
  }

  return entries[0]?.[0] ?? null;
}

export function isFortificationItem(type: string): type is FortificationItemType {
  return type in FORTIFICATION_ITEMS;
}

export function takeFortificationItem(
  materials: FortificationInventory,
  type: FortificationItemType,
  backpackTier: BackpackTier = 'satchel'
): boolean {
  const isHammer = type === 'hammer_tool';
  if (isHammer) {
    const alreadyHas = materials.hasHammer;
    if (alreadyHas) return false;
    materials.hasHammer = true;
    return true;
  }

  const isCrowbar = type === 'crowbar';
  if (isCrowbar) {
    const alreadyHas = materials.hasCrowbar;
    if (alreadyHas) return false;
    materials.hasCrowbar = true;
    return true;
  }

  const isPlank = type === 'plank';
  if (isPlank) {
    const maxPlanks = plankCapForTier(backpackTier);
    const isFull = materials.planks >= maxPlanks;
    if (isFull) return false;
    materials.planks += 1;
    return true;
  }

  const isNails = type === 'nails';
  if (isNails) {
    materials.nails += FORTIFICATION_ITEMS.nails.unitsPerFind;
    return true;
  }

  const isCurtain = type === 'sheet_curtain';
  if (isCurtain) {
    materials.sheets += 1;
    return true;
  }

  return false;
}
