export interface GridFootprint {
  readonly width: number;
  readonly height: number;
}

export interface GridPoint {
  readonly x: number;
  readonly y: number;
}

export interface GridItem {
  readonly id: string;
  readonly type: string;
  x: number;
  y: number;
  rotated: boolean;
  count?: number;
  ammo?: number;
}

export interface InventoryGrid {
  readonly cols: number;
  readonly rows: number;
  items: GridItem[];
}

export const ITEM_FOOTPRINTS: Record<string, GridFootprint> = {
  ammo_box: { width: 1, height: 1 },
  pistol_ammo: { width: 1, height: 1 },
  carbine_ammo: { width: 1, height: 1 },
  shells: { width: 1, height: 1 },
  bandage: { width: 1, height: 1 },
  antibiotics: { width: 1, height: 1 },
  disinfectant: { width: 1, height: 1 },
  nails: { width: 1, height: 1 },
  firework: { width: 1, height: 1 },
  fountain: { width: 1, height: 1 },
  candy: { width: 1, height: 1 },
  map: { width: 1, height: 1 },

  bottle: { width: 1, height: 2 },
  soda: { width: 1, height: 2 },
  hammer_tool: { width: 1, height: 2 },
  knife: { width: 1, height: 2 },

  pistol: { width: 2, height: 1 },
  medkit: { width: 2, height: 2 },
  sheet_curtain: { width: 2, height: 2 },
  armor_vest: { width: 2, height: 2 },

  plank: { width: 1, height: 3 },
  crowbar: { width: 1, height: 3 },

  shotgun: { width: 4, height: 1 },
  carbine: { width: 4, height: 2 },
};

const DEFAULT_FOOTPRINT: GridFootprint = { width: 1, height: 1 };

export function getItemFootprint(type: string, rotated: boolean): GridFootprint {
  const base = ITEM_FOOTPRINTS[type] ?? DEFAULT_FOOTPRINT;
  if (!rotated) {
    return base;
  }
  return {
    width: base.height,
    height: base.width,
  };
}

export function createInventoryGrid(cols: number, rows: number): InventoryGrid {
  return {
    cols: Math.max(1, cols),
    rows: Math.max(1, rows),
    items: [],
  };
}

export function isWithinGridBounds(grid: InventoryGrid, x: number, y: number, w: number, h: number): boolean {
  const isLeftOutOfBounds = x < 0;
  const isTopOutOfBounds = y < 0;
  const isRightOutOfBounds = x + w > grid.cols;
  const isBottomOutOfBounds = y + h > grid.rows;

  const isOutOfBounds = isLeftOutOfBounds || isTopOutOfBounds || isRightOutOfBounds || isBottomOutOfBounds;
  return !isOutOfBounds;
}

export function getOccupiedTiles(item: GridItem): GridPoint[] {
  const dims = getItemFootprint(item.type, item.rotated);
  const points: GridPoint[] = [];

  for (let dy = 0; dy < dims.height; dy += 1) {
    for (let dx = 0; dx < dims.width; dx += 1) {
      points.push({ x: item.x + dx, y: item.y + dy });
    }
  }

  return points;
}

export function itemOccupiesTile(item: GridItem, tileX: number, tileY: number): boolean {
  const dims = getItemFootprint(item.type, item.rotated);
  const isWithinHorizontal = tileX >= item.x && tileX < item.x + dims.width;
  const isWithinVertical = tileY >= item.y && tileY < item.y + dims.height;

  const doesOccupy = isWithinHorizontal && isWithinVertical;
  return doesOccupy;
}

export function findItemAtTile(grid: InventoryGrid, tileX: number, tileY: number): GridItem | null {
  const matchesTile = (item: GridItem) => itemOccupiesTile(item, tileX, tileY);
  return grid.items.find(matchesTile) ?? null;
}

export function canPlaceItem(
  grid: InventoryGrid,
  itemType: string,
  targetX: number,
  targetY: number,
  rotated: boolean,
  excludeItemId?: string
): boolean {
  const dims = getItemFootprint(itemType, rotated);
  const fitsInBounds = isWithinGridBounds(grid, targetX, targetY, dims.width, dims.height);
  if (!fitsInBounds) {
    return false;
  }

  for (const existingItem of grid.items) {
    const isExcluded = excludeItemId !== undefined && existingItem.id === excludeItemId;
    if (isExcluded) {
      continue;
    }

    const existingDims = getItemFootprint(existingItem.type, existingItem.rotated);
    const hasHorizontalOverlap = targetX < existingItem.x + existingDims.width && targetX + dims.width > existingItem.x;
    const hasVerticalOverlap = targetY < existingItem.y + existingDims.height && targetY + dims.height > existingItem.y;

    const hasCollision = hasHorizontalOverlap && hasVerticalOverlap;
    if (hasCollision) {
      return false;
    }
  }

  return true;
}

export function placeItem(grid: InventoryGrid, item: GridItem): boolean {
  const canFit = canPlaceItem(grid, item.type, item.x, item.y, item.rotated, item.id);
  if (!canFit) {
    return false;
  }

  const existingIndex = grid.items.findIndex((candidate) => candidate.id === item.id);
  const alreadyExists = existingIndex >= 0;
  if (alreadyExists) {
    grid.items[existingIndex] = { ...item };
  } else {
    grid.items.push({ ...item });
  }

  return true;
}

export function removeItem(grid: InventoryGrid, itemId: string): GridItem | null {
  const itemIndex = grid.items.findIndex((item) => item.id === itemId);
  const itemNotFound = itemIndex < 0;
  if (itemNotFound) {
    return null;
  }

  const [removed] = grid.items.splice(itemIndex, 1);
  return removed ?? null;
}

export function rotateItem(grid: InventoryGrid, itemId: string): boolean {
  const item = grid.items.find((candidate) => candidate.id === itemId);
  const itemMissing = item === undefined;
  if (itemMissing) {
    return false;
  }

  const targetRotation = !item.rotated;
  const canRotate = canPlaceItem(grid, item.type, item.x, item.y, targetRotation, item.id);
  if (!canRotate) {
    return false;
  }

  item.rotated = targetRotation;
  return true;
}

export function transferItem(
  source: InventoryGrid,
  target: InventoryGrid,
  itemId: string,
  targetX: number,
  targetY: number,
  rotated?: boolean
): boolean {
  const sourceItem = source.items.find((item) => item.id === itemId);
  const sourceItemMissing = sourceItem === undefined;
  if (sourceItemMissing) {
    return false;
  }

  const desiredRotation = rotated !== undefined ? rotated : sourceItem.rotated;
  const canFitInTarget = canPlaceItem(target, sourceItem.type, targetX, targetY, desiredRotation);
  if (!canFitInTarget) {
    return false;
  }

  removeItem(source, itemId);
  const placed = placeItem(target, {
    ...sourceItem,
    x: targetX,
    y: targetY,
    rotated: desiredRotation,
  });

  return placed;
}

export function findAvailableSlot(
  grid: InventoryGrid,
  itemType: string,
  tryRotation: boolean = true
): { x: number; y: number; rotated: boolean } | null {
  for (let y = 0; y < grid.rows; y += 1) {
    for (let x = 0; x < grid.cols; x += 1) {
      const fitsStandard = canPlaceItem(grid, itemType, x, y, false);
      if (fitsStandard) {
        return { x, y, rotated: false };
      }

      const shouldCheckRotation = tryRotation;
      if (shouldCheckRotation) {
        const fitsRotated = canPlaceItem(grid, itemType, x, y, true);
        if (fitsRotated) {
          return { x, y, rotated: true };
        }
      }
    }
  }

  return null;
}

export function autoPackItem(grid: InventoryGrid, item: Omit<GridItem, 'x' | 'y'>): boolean {
  const slot = findAvailableSlot(grid, item.type, true);
  const noSlotAvailable = slot === null;
  if (noSlotAvailable) {
    return false;
  }

  return placeItem(grid, {
    ...item,
    x: slot.x,
    y: slot.y,
    rotated: slot.rotated,
  });
}
