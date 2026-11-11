// The building materials a player carries, as a list of HUD chips. Live state only.
import { BACKPACK_TIERS } from '../../shared/backpack.ts';
import type { BackpackTier } from '../../shared/backpack.ts';
import type { FortificationInventory, FortificationItemType } from '../../shared/fortifications.ts';

export interface MaterialChip {
  readonly type: FortificationItemType;
  readonly label: string;
  /** Text beside the icon, or null for a tool the player simply has. */
  readonly count: string | null;
}

/** One chip per material held, in a steady order; an empty list when nothing is carried. */
export function materialChips(materials: FortificationInventory | undefined, tier: BackpackTier | undefined): readonly MaterialChip[] {
  if (!materials) return [];
  const plankMax = (BACKPACK_TIERS[tier ?? 'satchel'] ?? BACKPACK_TIERS.satchel).plankMax;
  const chips: MaterialChip[] = [];
  if (materials.planks > 0) chips.push({ type: 'plank', label: 'Planks', count: `${materials.planks}/${plankMax}` });
  if (materials.nails > 0) chips.push({ type: 'nails', label: 'Nails', count: String(materials.nails) });
  if (materials.sheets > 0) chips.push({ type: 'sheet_curtain', label: 'Curtain sheets', count: String(materials.sheets) });
  if (materials.hasHammer) chips.push({ type: 'hammer_tool', label: 'Hammer', count: null });
  if (materials.hasCrowbar) chips.push({ type: 'crowbar', label: 'Crowbar', count: null });
  return chips;
}
