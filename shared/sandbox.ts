export type ZombieSpeedOption = 'shambler' | 'walker' | 'sprinter';
export type SensesOption = 'impaired' | 'normal' | 'heightened';
export type LootScarcityOption = 'abundant' | 'normal' | 'scarce' | 'barren';
export type HordeFrequencyOption = 'relaxed' | 'normal' | 'relentless';
export type InfectionOption = 'none' | 'slow' | 'lethal';

export interface SandboxSettings {
  readonly zombieSpeed: ZombieSpeedOption;
  readonly zombieSight: SensesOption;
  readonly zombieHearing: SensesOption;
  readonly lootScarcity: LootScarcityOption;
  readonly hordeFrequency: HordeFrequencyOption;
  readonly infection: InfectionOption;
}

export const DEFAULT_SANDBOX_SETTINGS: SandboxSettings = {
  zombieSpeed: 'walker',
  zombieSight: 'normal',
  zombieHearing: 'normal',
  lootScarcity: 'normal',
  hordeFrequency: 'normal',
  infection: 'slow',
};

export const ZOMBIE_SPEED_SCALES: Readonly<Record<ZombieSpeedOption, number>> = {
  shambler: 0.65,
  walker: 1.0,
  sprinter: 1.35,
};

export const SENSES_SCALES: Readonly<Record<SensesOption, number>> = {
  impaired: 0.6,
  normal: 1.0,
  heightened: 1.4,
};

export const LOOT_SCARCITY_SCALES: Readonly<Record<LootScarcityOption, number>> = {
  abundant: 1.6,
  normal: 1.0,
  scarce: 0.55,
  barren: 0.25,
};

export const HORDE_LULL_SCALES: Readonly<Record<HordeFrequencyOption, number>> = {
  relaxed: 1.5,
  normal: 1.0,
  relentless: 0.6,
};

export interface SandboxPreset {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly settings: SandboxSettings;
}

export const SANDBOX_PRESETS: readonly SandboxPreset[] = [
  {
    id: 'default',
    name: 'Standard Outbreak',
    description: 'Balanced survival experience.',
    settings: DEFAULT_SANDBOX_SETTINGS,
  },
  {
    id: 'sprinters',
    name: 'Sprinter Nightmare',
    description: 'High-speed terrifying zombies with acute vision.',
    settings: {
      zombieSpeed: 'sprinter',
      zombieSight: 'heightened',
      zombieHearing: 'normal',
      lootScarcity: 'normal',
      hordeFrequency: 'relentless',
      infection: 'lethal',
    },
  },
  {
    id: 'shamblers',
    name: 'Classic Romero',
    description: 'Slow dragging walkers, but ammo and supplies are scarce.',
    settings: {
      zombieSpeed: 'shambler',
      zombieSight: 'impaired',
      zombieHearing: 'heightened',
      lootScarcity: 'scarce',
      hordeFrequency: 'normal',
      infection: 'slow',
    },
  },
  {
    id: 'scavenger',
    name: 'Scavenger Run',
    description: 'Plentiful supplies, ideal for testing builds.',
    settings: {
      zombieSpeed: 'walker',
      zombieSight: 'normal',
      zombieHearing: 'normal',
      lootScarcity: 'abundant',
      hordeFrequency: 'relaxed',
      infection: 'none',
    },
  },
];

export function resolveSpeedMultiplier(settings: SandboxSettings): number {
  return ZOMBIE_SPEED_SCALES[settings.zombieSpeed] ?? 1.0;
}

export function resolveSightMultiplier(settings: SandboxSettings): number {
  return SENSES_SCALES[settings.zombieSight] ?? 1.0;
}

export function resolveHearingMultiplier(settings: SandboxSettings): number {
  return SENSES_SCALES[settings.zombieHearing] ?? 1.0;
}

export function resolveLootMultiplier(settings: SandboxSettings): number {
  return LOOT_SCARCITY_SCALES[settings.lootScarcity] ?? 1.0;
}

export function resolveLullMultiplier(settings: SandboxSettings): number {
  return HORDE_LULL_SCALES[settings.hordeFrequency] ?? 1.0;
}
