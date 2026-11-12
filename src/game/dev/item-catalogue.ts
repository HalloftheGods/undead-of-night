import { CANDIES, type CandyId } from '../../../shared/candy.ts';
import {
  FORTIFICATION_TYPES,
  SALVAGE_TYPES,
  SURVIVAL_ITEM_TYPES,
  TREASURE_TYPES,
} from '../../../shared/events.ts';
import { ITEM_FOOTPRINTS, type GridFootprint } from '../../../shared/grid-inventory.ts';
import { PART_ORDER } from '../../../shared/gun-upgrade-data.ts';
import { KIT_ORDER } from '../../../shared/round-effect-data.ts';
import { formatItemName } from '../dual-loot-modal.ts';

export type DevItemCategory =
  | 'weapons'
  | 'ammo'
  | 'survival'
  | 'fortifications'
  | 'gear'
  | 'parts'
  | 'kits'
  | 'salvage'
  | 'candies';

export interface DevItemEntry {
  readonly id: string;
  readonly name: string;
  readonly category: DevItemCategory;
  readonly defaultFootprint: GridFootprint;
  readonly isExplicitlyMapped: boolean;
}

const WEAPON_IDS: readonly string[] = ['pistol', 'carbine', 'shotgun'];
const AMMO_IDS: readonly string[] = ['pistol_ammo', 'carbine_ammo', 'shells', 'ammo_box'];
const SURVIVAL_IDS: readonly string[] = [
  ...SURVIVAL_ITEM_TYPES,
  'bandage',
  'medkit',
  'bottle',
  'water_bottle',
  'soda',
];
const FORTIFICATION_IDS: readonly string[] = [
  ...FORTIFICATION_TYPES,
  'knife',
];
const GEAR_IDS: readonly string[] = [
  'armor_vest',
  'radio',
  'map',
  'fountain',
  'firework',
];
const PART_IDS: readonly string[] = [...PART_ORDER];
const KIT_IDS: readonly string[] = [...KIT_ORDER];
const SALVAGE_IDS: readonly string[] = [
  ...SALVAGE_TYPES,
  ...TREASURE_TYPES,
];
const CANDY_IDS: readonly string[] = [
  'candy',
  ...(Object.keys(CANDIES) as CandyId[]),
];

const CATEGORY_MAP: ReadonlyArray<{ readonly category: DevItemCategory; readonly ids: readonly string[] }> = [
  { category: 'weapons', ids: WEAPON_IDS },
  { category: 'ammo', ids: AMMO_IDS },
  { category: 'survival', ids: SURVIVAL_IDS },
  { category: 'fortifications', ids: FORTIFICATION_IDS },
  { category: 'gear', ids: GEAR_IDS },
  { category: 'parts', ids: PART_IDS },
  { category: 'kits', ids: KIT_IDS },
  { category: 'salvage', ids: SALVAGE_IDS },
  { category: 'candies', ids: CANDY_IDS },
];

const DEFAULT_FOOTPRINT: GridFootprint = { width: 1, height: 1 };

export function buildItemCatalogue(): DevItemEntry[] {
  const seen = new Set<string>();
  const entries: DevItemEntry[] = [];

  for (const group of CATEGORY_MAP) {
    for (const id of group.ids) {
      const isAlreadyAdded = seen.has(id);
      if (isAlreadyAdded) {
        continue;
      }
      seen.add(id);

      const existingFootprint = ITEM_FOOTPRINTS[id];
      const isExplicitlyMapped = existingFootprint !== undefined;
      const defaultFootprint = existingFootprint ?? DEFAULT_FOOTPRINT;

      entries.push({
        id,
        name: formatItemName(id),
        category: group.category,
        defaultFootprint: { width: defaultFootprint.width, height: defaultFootprint.height },
        isExplicitlyMapped,
      });
    }
  }

  // Include any extra entries present in ITEM_FOOTPRINTS not caught above
  for (const id of Object.keys(ITEM_FOOTPRINTS)) {
    const isAlreadyAdded = seen.has(id);
    if (!isAlreadyAdded) {
      seen.add(id);
      const footprint = ITEM_FOOTPRINTS[id];
      entries.push({
        id,
        name: formatItemName(id),
        category: 'gear',
        defaultFootprint: { width: footprint.width, height: footprint.height },
        isExplicitlyMapped: true,
      });
    }
  }

  return entries;
}

export function generateFootprintsCode(
  footprints: Record<string, GridFootprint>,
  modifiedOnly = false,
  originalFootprints: Record<string, GridFootprint> = ITEM_FOOTPRINTS,
): string {
  const keys = Object.keys(footprints).sort();
  const lines: string[] = [];

  if (modifiedOnly) {
    for (const key of keys) {
      const current = footprints[key];
      const original = originalFootprints[key] ?? DEFAULT_FOOTPRINT;
      const isModified = current.width !== original.width || current.height !== original.height;
      if (isModified) {
        lines.push(`  ${key}: { width: ${current.width}, height: ${current.height} },`);
      }
    }

    if (lines.length === 0) {
      return '// No item sizes modified from original defaults.';
    }

    return [
      '// Modified item footprints only:',
      ...lines,
    ].join('\n');
  }

  for (const key of keys) {
    const current = footprints[key];
    lines.push(`  ${key}: { width: ${current.width}, height: ${current.height} },`);
  }

  return [
    'export const ITEM_FOOTPRINTS: Record<string, GridFootprint> = {',
    ...lines,
    '};',
  ].join('\n');
}

export function generateFootprintsJson(
  footprints: Record<string, GridFootprint>,
  modifiedOnly = false,
  originalFootprints: Record<string, GridFootprint> = ITEM_FOOTPRINTS,
): string {
  if (!modifiedOnly) {
    return JSON.stringify(footprints, null, 2);
  }

  const modified: Record<string, GridFootprint> = {};
  for (const [key, current] of Object.entries(footprints)) {
    const original = originalFootprints[key] ?? DEFAULT_FOOTPRINT;
    const isModified = current.width !== original.width || current.height !== original.height;
    if (isModified) {
      modified[key] = current;
    }
  }

  return JSON.stringify(modified, null, 2);
}
