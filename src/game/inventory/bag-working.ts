import type { BackpackTier } from '../../../shared/backpack.ts';
import type { ContainerKind } from '../../../shared/containers.ts';
import type { GridItem, InventoryGrid } from '../../../shared/grid-inventory.ts';
import type { WeaponId } from '../../../shared/protocol.ts';
import type { ContainerArt } from '../../art/containers.ts';
import type { HudState } from '../hud-state.ts';

/** Guns are worn, not packed: the held gun, another long gun, and the pistol each have a slot of their own. */
export interface WornGear {
  primary: GridItem | null;
  secondary: GridItem | null;
  sidearm: GridItem | null;
  armor: GridItem | null;
}

/**
 * The grids an open window draws and edits. The move ledger (move-ledger.ts) refills them in place from the host's
 * state with the survivor's unanswered moves on top; the window lifts and sets down items in them as the hand does.
 */
export interface BagWorking {
  readonly tier: BackpackTier;
  readonly pack: InventoryGrid;
  readonly pockets: InventoryGrid;
  readonly candyBag: InventoryGrid;
  /** Items in the open container, shown on its side when `flipped`. */
  readonly container: InventoryGrid;
  readonly gear: WornGear;
  readonly containerTitle?: string;
  readonly containerKind?: ContainerKind;
  readonly containerId?: number | null;
  readonly containerArt?: ContainerArt | null;
  /** The grid is shown on its side (a car parked nose up). Moves turn its cells back before they are sent. */
  readonly flipped?: boolean;
}

type GunCounters = Pick<HudState, 'owned' | 'weapon' | 'mags' | 'ammoBag'>;

function gunItem(weapon: WeaponId, hud: GunCounters): GridItem {
  return { id: weapon, type: weapon, x: 0, y: 0, rotated: false, ammo: hud.mags[weapon] + hud.ammoBag[weapon] };
}

/** The held gun is primary, a second long gun is secondary, and the pistol rides as the sidearm unless it is the one held. */
export function wornGear(hud: GunCounters): WornGear {
  const owned = (weapon: WeaponId): boolean => hud.owned.includes(weapon);
  const primary = owned(hud.weapon) ? hud.weapon : null;
  const secondary = (['carbine', 'shotgun'] as const).find((weapon) => owned(weapon) && weapon !== primary) ?? null;
  const sidearm = owned('pistol') && primary !== 'pistol' ? 'pistol' : null;
  const item = (weapon: WeaponId | null): GridItem | null => (weapon ? gunItem(weapon, hud) : null);
  return { primary: item(primary), secondary: item(secondary), sidearm: item(sidearm), armor: null };
}
