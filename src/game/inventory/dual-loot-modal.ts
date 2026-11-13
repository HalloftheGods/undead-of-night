import { CANDIES, isCandyId } from '@shared/candy.ts';
import { containerGridDimensions, type ContainerKind } from '@shared/containers.ts';
import type { ContainerArt } from '@art/containers.ts';
import type { ArtBook } from '@art/types.ts';
import { backpackDef, type BackpackTier } from '@shared/backpack.ts';
import {
  autoPackItem,
  canPlaceItem,
  createInventoryGrid,
  getItemFootprint,
  placeItem,
  removeItem,
  rotateItem,
  type GridFootprint,
  type GridItem,
  type InventoryGrid,
} from '@shared/grid-inventory.ts';

export type GridIdentifier = 'container' | 'pockets' | 'backpack' | 'candyBag';
export type GearSlotId = 'primary' | 'secondary' | 'sidearm' | 'armor';
export type TileHighlightState = 'valid' | 'invalid' | 'none';

export interface GridItemSource {
  readonly kind: 'grid';
  readonly gridId: GridIdentifier;
  readonly x: number;
  readonly y: number;
}

export interface GearItemSource {
  readonly kind: 'gear';
  readonly slotId: GearSlotId;
}

export type ItemSource = GridItemSource | GearItemSource;

/** Where a held item came from, by name: the grid it left or the gear slot it left. */
export function sourceName(source: ItemSource): string {
  return source.kind === 'grid' ? source.gridId : source.slotId;
}

export interface HeldItemState {
  readonly item: GridItem;
  readonly source: ItemSource;
  readonly originalRotated: boolean;
}

export interface GearEquipState {
  primary: GridItem | null;
  secondary: GridItem | null;
  sidearm: GridItem | null;
  armor: GridItem | null;
}

export interface DualLootModalProps {
  /** The game's sprites, for drawing each item; without it items fall back to their names. */
  art?: ArtBook | null;
  containerArt?: ContainerArt | null;
  containerTitle?: string;
  containerKind?: ContainerKind;
  containerGrid?: InventoryGrid;
  backpackTier?: BackpackTier;
  backpackGrid?: InventoryGrid;
  pocketsGrid?: InventoryGrid;
  candyBagGrid?: InventoryGrid;
  equippedPrimary?: GridItem | null;
  equippedSecondary?: GridItem | null;
  equippedSidearm?: GridItem | null;
  equippedArmor?: GridItem | null;
  primary?: GridItem | null;
  secondary?: GridItem | null;
  sidearm?: GridItem | null;
  armor?: GridItem | null;
}

export interface GearSlotDef {
  readonly id: GearSlotId;
  readonly label: string;
  readonly emptyLabel: string;
}

export const GEAR_SLOT_DEFS: readonly GearSlotDef[] = [
  { id: 'primary', label: 'PRIMARY WEAPON', emptyLabel: '[EMPTY PRIMARY]' },
  { id: 'secondary', label: 'SECONDARY WEAPON', emptyLabel: '[EMPTY SECONDARY]' },
  { id: 'sidearm', label: 'SIDEARM', emptyLabel: '[EMPTY SIDEARM]' },
  { id: 'armor', label: 'ARMOR VEST', emptyLabel: '[EMPTY VEST]' },
];

export function buildGridCells(cols: number, rows: number): { col: number; row: number }[] {
  const cells: { col: number; row: number }[] = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      cells.push({ col: c, row: r });
    }
  }
  return cells;
}

export interface DualLootState {
  containerGrid: InventoryGrid;
  pocketsGrid: InventoryGrid;
  backpackGrid: InventoryGrid;
  candyBagGrid: InventoryGrid;
  gear: GearEquipState;
  backpackTier: BackpackTier;
  containerTitle: string;
  containerKind?: ContainerKind;
  heldItem: HeldItemState | null;
  selectedItemId: string | null;
  selectedGridId: GridIdentifier | null;
}

export interface TransferEventPayload {
  readonly itemId: string;
  readonly source: string;
  readonly target: string;
}

export type DualLootModalEmits = {
  (e: 'close'): void;
  (e: 'update:equippedPrimary', item: GridItem | null): void;
  (e: 'update:equippedSecondary', item: GridItem | null): void;
  (e: 'update:equippedSidearm', item: GridItem | null): void;
  (e: 'update:equippedArmor', item: GridItem | null): void;
  (e: 'transfer', event: TransferEventPayload): void;
  (e: 'use', item: GridItem): void;
  (e: 'drop', item: GridItem): void;
};

export const ITEM_DISPLAY_NAMES: Record<string, string> = {
  ammo_box: 'Ammo Box', nails: 'Box of Nails', firework: 'Firework', fountain: 'Fountain',
  candy: 'Candy', map: 'Town Map', bottle: 'Glass Bottle', soda: 'Soda Can',
  hammer_tool: 'Claw Hammer', knife: 'Combat Knife', pistol: '9mm Pistol', medkit: 'First Aid Kit',
  sheet_curtain: 'Sheet Curtain', armor_vest: 'Armor Vest', plank: 'Wooden Plank', crowbar: 'Crowbar',
  shotgun: 'Shotgun', carbine: 'Carbine',
  bandage: 'Bandage', canned_food: 'Canned Food', water_bottle: 'Water Bottle',
  disinfectant: 'Disinfectant', antibiotics: 'Antibiotics',
};

export function formatItemName(type?: string | null): string {
  const isMissingType = !type;
  if (isMissingType) {
    return '';
  }
  if (isCandyId(type)) {
    return CANDIES[type].name;
  }
  const customName = ITEM_DISPLAY_NAMES[type];
  const hasCustomName = customName !== undefined;
  if (hasCustomName) {
    return customName;
  }
  return type
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function formatClueLabel(clueItem?: string | null): string {
  const isMissingClue = !clueItem;
  if (isMissingClue) return 'CACHE';
  const types = clueItem.split(',').map((s) => s.trim()).filter(Boolean);
  if (types.length === 0) return 'CACHE';
  const counts = new Map<string, number>();
  for (const type of types) {
    counts.set(type, (counts.get(type) ?? 0) + 1);
  }
  return [...counts.entries()].map(([type, count]) => {
    const name = formatItemName(type).toUpperCase();
    return count > 1 ? `${name} X${count}` : name;
  }).join(', ');
}

export function isItemValidForGearSlot(itemType: string, slotId: GearSlotId): boolean {
  const isArmorSlot = slotId === 'armor';
  if (isArmorSlot) {
    const isArmorVest = itemType === 'armor_vest';
    return isArmorVest;
  }

  const isPrimarySlot = slotId === 'primary';
  if (isPrimarySlot) {
    const isCarbine = itemType === 'carbine';
    const isShotgun = itemType === 'shotgun';
    const isPistol = itemType === 'pistol';
    const isKnife = itemType === 'knife';
    const isPrimaryWeapon = isCarbine || isShotgun || isPistol || isKnife;
    return isPrimaryWeapon;
  }

  const isSidearmSlot = slotId === 'sidearm';
  if (isSidearmSlot) return itemType === 'pistol';

  const isSecondarySlot = slotId === 'secondary';
  if (isSecondarySlot) {
    const isPistol = itemType === 'pistol';
    const isKnife = itemType === 'knife';
    const isShotgun = itemType === 'shotgun';
    const isSecondaryWeapon = isPistol || isKnife || isShotgun;
    return isSecondaryWeapon;
  }

  return false;
}

export function createDualLootState(options?: DualLootModalProps): DualLootState {
  const tier = options?.backpackTier ?? 'satchel';
  const tierConfig = backpackDef(tier);

  const { cols, rows, blocked } = containerGridDimensions(options?.containerKind);
  const containerGrid = options?.containerGrid ?? createInventoryGrid(cols, rows, blocked);
  const pocketsGrid = options?.pocketsGrid ?? createInventoryGrid(2, 2);
  const backpackGrid = options?.backpackGrid ?? createInventoryGrid(tierConfig.cols, tierConfig.rows);
  const candyBagGrid = options?.candyBagGrid ?? createInventoryGrid(2, 6);

  return {
    containerGrid,
    pocketsGrid,
    backpackGrid,
    candyBagGrid,
    gear: {
      primary: options?.equippedPrimary ?? options?.primary ?? null,
      secondary: options?.equippedSecondary ?? options?.secondary ?? null,
      sidearm: options?.equippedSidearm ?? options?.sidearm ?? null,
      armor: options?.equippedArmor ?? options?.armor ?? null,
    },
    backpackTier: tier,
    containerTitle: options?.containerTitle ?? 'Inspected Container',
    containerKind: options?.containerKind,
    heldItem: null,
    selectedItemId: null,
    selectedGridId: null,
  };
}

export function resolveGridById(
  state: DualLootState,
  gridId: GridIdentifier
): InventoryGrid {
  const isContainer = gridId === 'container';
  if (isContainer) {
    return state.containerGrid;
  }
  const isPockets = gridId === 'pockets';
  if (isPockets) {
    return state.pocketsGrid;
  }
  const isCandyBag = gridId === 'candyBag';
  if (isCandyBag) {
    return state.candyBagGrid;
  }
  return state.backpackGrid;
}

export function computeTileHighlight(
  grid: InventoryGrid,
  col: number,
  row: number,
  hoveredCol: number | null,
  hoveredRow: number | null,
  heldItem: GridItem | null,
  gridId?: GridIdentifier
): TileHighlightState {
  const hasNoHover = hoveredCol === null || hoveredRow === null;
  const hasNoHeldItem = heldItem === null;
  const shouldSkipHighlight = hasNoHover || hasNoHeldItem;
  if (shouldSkipHighlight) {
    return 'none';
  }

  const dims = getItemFootprint(heldItem.type, heldItem.rotated);
  const isWithinColSpan = col >= hoveredCol && col < hoveredCol + dims.width;
  const isWithinRowSpan = row >= hoveredRow && row < hoveredRow + dims.height;
  const isCellCovered = isWithinColSpan && isWithinRowSpan;
  const isNotCovered = !isCellCovered;

  if (isNotCovered) {
    return 'none';
  }

  const isCandyBag = gridId === 'candyBag';
  const isCandyItem = isCandyId(heldItem.type) || heldItem.type === 'candy';
  if (isCandyBag && !isCandyItem) {
    return 'invalid';
  }

  const canFit = canPlaceItem(
    grid,
    heldItem.type,
    hoveredCol,
    hoveredRow,
    heldItem.rotated,
    heldItem.id
  );

  if (canFit) {
    return 'valid';
  }
  return 'invalid';
}

export function pickUpItemFromGrid(
  state: DualLootState,
  gridId: GridIdentifier,
  itemId: string
): boolean {
  const targetGrid = resolveGridById(state, gridId);
  const targetItem = targetGrid.items.find((candidate) => candidate.id === itemId);
  const itemNotFound = targetItem === undefined;
  if (itemNotFound) {
    return false;
  }

  const itemCopy: GridItem = { ...targetItem };
  removeItem(targetGrid, itemId);

  state.heldItem = {
    item: itemCopy,
    source: {
      kind: 'grid',
      gridId,
      x: itemCopy.x,
      y: itemCopy.y,
    },
    originalRotated: itemCopy.rotated,
  };
  state.selectedItemId = itemCopy.id;
  state.selectedGridId = gridId;

  return true;
}

export function pickUpItemFromGear(
  state: DualLootState,
  slotId: GearSlotId
): boolean {
  const equippedItem = state.gear[slotId];
  const slotIsEmpty = equippedItem === null;
  if (slotIsEmpty) {
    return false;
  }

  const itemCopy: GridItem = { ...equippedItem };
  state.gear[slotId] = null;

  state.heldItem = {
    item: itemCopy,
    source: {
      kind: 'gear',
      slotId,
    },
    originalRotated: itemCopy.rotated,
  };
  state.selectedItemId = itemCopy.id;
  state.selectedGridId = null;

  return true;
}

export function placeHeldItemInGrid(
  state: DualLootState,
  gridId: GridIdentifier,
  targetX: number,
  targetY: number
): boolean {
  const activeHeld = state.heldItem;
  const hasNoHeldItem = activeHeld === null;
  if (hasNoHeldItem) {
    return false;
  }

  const isCandyBag = gridId === 'candyBag';
  const isCandyItem = isCandyId(activeHeld.item.type) || activeHeld.item.type === 'candy';
  if (isCandyBag && !isCandyItem) {
    return false;
  }

  const targetGrid = resolveGridById(state, gridId);
  const canFit = canPlaceItem(
    targetGrid,
    activeHeld.item.type,
    targetX,
    targetY,
    activeHeld.item.rotated,
    activeHeld.item.id
  );
  const cannotFit = !canFit;

  if (cannotFit) {
    return false;
  }

  const itemToPlace: GridItem = {
    ...activeHeld.item,
    x: targetX,
    y: targetY,
  };

  placeItem(targetGrid, itemToPlace);
  state.heldItem = null;
  state.selectedItemId = itemToPlace.id;
  state.selectedGridId = gridId;

  return true;
}

export function placeHeldItemInGear(
  state: DualLootState,
  slotId: GearSlotId
): boolean {
  const activeHeld = state.heldItem;
  const hasNoHeldItem = activeHeld === null;
  if (hasNoHeldItem) {
    return false;
  }

  const isValidForSlot = isItemValidForGearSlot(activeHeld.item.type, slotId);
  const isInvalid = !isValidForSlot;
  if (isInvalid) {
    return false;
  }

  const existingEquipped = state.gear[slotId];
  state.gear[slotId] = { ...activeHeld.item };

  const hasExistingItem = existingEquipped !== null;
  if (hasExistingItem) {
    state.heldItem = {
      item: { ...existingEquipped },
      source: {
        kind: 'gear',
        slotId,
      },
      originalRotated: existingEquipped.rotated,
    };
    state.selectedItemId = existingEquipped.id;
    state.selectedGridId = null;
  } else {
    state.heldItem = null;
    state.selectedItemId = activeHeld.item.id;
    state.selectedGridId = null;
  }

  return true;
}

export function rotateActiveItem(state: DualLootState): boolean {
  const activeHeld = state.heldItem;
  const isHoldingItem = activeHeld !== null;
  if (isHoldingItem) {
    state.heldItem = {
      ...activeHeld,
      item: {
        ...activeHeld.item,
        rotated: !activeHeld.item.rotated,
      },
    };
    return true;
  }

  const { selectedGridId, selectedItemId } = state;
  const hasSelection = selectedGridId !== null && selectedItemId !== null;
  if (hasSelection) {
    return rotateItem(resolveGridById(state, selectedGridId), selectedItemId);
  }

  return false;
}

export function returnHeldItemToSource(state: DualLootState): boolean {
  const activeHeld = state.heldItem;
  const hasNoHeldItem = activeHeld === null;
  if (hasNoHeldItem) {
    return false;
  }

  const isFromGrid = activeHeld.source.kind === 'grid';
  if (isFromGrid) {
    const grid = resolveGridById(state, activeHeld.source.gridId);
    const restoredItem: GridItem = {
      ...activeHeld.item,
      x: activeHeld.source.x,
      y: activeHeld.source.y,
      rotated: activeHeld.originalRotated,
    };
    placeItem(grid, restoredItem);
    state.heldItem = null;
    return true;
  }

  const slotId = activeHeld.source.slotId;
  state.gear[slotId] = {
    ...activeHeld.item,
    rotated: activeHeld.originalRotated,
  };
  state.heldItem = null;
  return true;
}

export function transferItemDirectly(
  sourceGrid: InventoryGrid,
  targetGrid: InventoryGrid,
  itemId: string,
  targetX: number,
  targetY: number,
  rotated?: boolean
): boolean {
  const sourceItem = sourceGrid.items.find((item) => item.id === itemId);
  const sourceItemMissing = sourceItem === undefined;
  if (sourceItemMissing) {
    return false;
  }

  const desiredRotation = rotated !== undefined ? rotated : sourceItem.rotated;
  const canFitInTarget = canPlaceItem(targetGrid, sourceItem.type, targetX, targetY, desiredRotation);
  const cannotFit = !canFitInTarget;
  if (cannotFit) {
    return false;
  }

  removeItem(sourceGrid, itemId);
  return placeItem(targetGrid, {
    ...sourceItem,
    x: targetX,
    y: targetY,
    rotated: desiredRotation,
  });
}

export function quickTransferHeldItem(state: DualLootState): boolean {
  const activeHeld = state.heldItem;
  const hasNoHeld = activeHeld === null;
  if (hasNoHeld) {
    return false;
  }
  const isFromGear = activeHeld.source.kind === 'gear';
  if (isFromGear) {
    return false;
  }

  const fromGridId = activeHeld.source.gridId;
  const itemToPlace = activeHeld.item;
  const isContainerSource = fromGridId === 'container';

  if (isContainerSource) {
    const isCandy = isCandyId(itemToPlace.type) || itemToPlace.type === 'candy';
    if (isCandy) {
      const packedInCandyBag = autoPackItem(state.candyBagGrid, itemToPlace);
      if (packedInCandyBag) {
        state.heldItem = null;
        return true;
      }
    }

    const packedInBackpack = autoPackItem(state.backpackGrid, itemToPlace);
    if (packedInBackpack) {
      state.heldItem = null;
      return true;
    }

    const packedInPockets = autoPackItem(state.pocketsGrid, itemToPlace);
    if (packedInPockets) {
      state.heldItem = null;
      return true;
    }
    return false;
  }

  const packedInContainer = autoPackItem(state.containerGrid, itemToPlace);
  if (packedInContainer) {
    state.heldItem = null;
    return true;
  }

  return false;
}

export function quickTransferBetweenInventories(
  state: DualLootState,
  fromGridId: GridIdentifier,
  itemId: string
): boolean {
  const sourceGrid = resolveGridById(state, fromGridId);
  const sourceItem = sourceGrid.items.find((candidate) => candidate.id === itemId);
  const sourceItemMissing = sourceItem === undefined;
  if (sourceItemMissing) {
    const isHeld = state.heldItem !== null && state.heldItem.item.id === itemId;
    if (isHeld) {
      return quickTransferHeldItem(state);
    }
    return false;
  }

  const isContainerSource = fromGridId === 'container';
  if (isContainerSource) {
    const isCandy = isCandyId(sourceItem.type) || sourceItem.type === 'candy';
    if (isCandy) {
      const packedInCandyBag = autoPackItem(state.candyBagGrid, sourceItem);
      if (packedInCandyBag) {
        removeItem(sourceGrid, itemId);
        return true;
      }
    }

    const packedInBackpack = autoPackItem(state.backpackGrid, sourceItem);
    if (packedInBackpack) {
      removeItem(sourceGrid, itemId);
      return true;
    }

    const packedInPockets = autoPackItem(state.pocketsGrid, sourceItem);
    if (packedInPockets) {
      removeItem(sourceGrid, itemId);
      return true;
    }
    return false;
  }

  const packedInContainer = autoPackItem(state.containerGrid, sourceItem);
  if (packedInContainer) {
    removeItem(sourceGrid, itemId);
    return true;
  }

  return false;
}
