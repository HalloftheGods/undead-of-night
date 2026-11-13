// Manages the bunker locker's 4x12 inventory grid storage. Converts between
// the persistent Loadout counters and the physical 4x12 grid items.

import { AMMO_PICKUPS } from '../../../shared/constants.ts';
import type { AmmoPickup } from '../../../shared/constants.ts';
import { WEAPON_ORDER } from '../../../shared/protocol.ts';
import type { WeaponId } from '../../../shared/protocol.ts';
import { autoPackItem, canPlaceItem, createInventoryGrid, placeItem } from '../../../shared/grid-inventory.ts';
import type { GridItem, InventoryGrid } from '../../../shared/grid-inventory.ts';
import type { Loadout } from '../../../shared/home-protocol.ts';
import { emptyLoadout } from '../../../shared/loadout.ts';
import { emptySupplies, isSupplyType, SUPPLY_TYPES } from '../../../shared/supply-types.ts';
import type { SupplyType } from '../../../shared/supply-types.ts';
import { bagWanted, createBag, syncBag } from '../../../shared/bag.ts';
import type { BackpackTier } from '../../../shared/backpack.ts';
import type { GearEquipState } from '../dual-loot-modal.ts';

export const BUNKER_LOCKER_COLS = 4;
export const BUNKER_LOCKER_ROWS = 12;

export const WEAPON_AMMO_TYPE: Record<WeaponId, AmmoPickup> = {
  pistol: 'pistol_ammo',
  carbine: 'carbine_ammo',
  shotgun: 'shells',
};

export const AMMO_WEAPON_MAP: Partial<Record<string, WeaponId>> = {
  pistol_ammo: 'pistol',
  carbine_ammo: 'carbine',
  shells: 'shotgun',
};

export function createBunkerLockerGrid(): InventoryGrid {
  return createInventoryGrid(BUNKER_LOCKER_COLS, BUNKER_LOCKER_ROWS);
}

/** Converts an InventoryGrid back into a Loadout, preserving parts and kits from baseLoadout. */
export function gridToLoadout(grid: InventoryGrid, baseLoadout?: Loadout): Loadout {
  const result: Loadout = {
    guns: {},
    ammoBag: { pistol: 0, carbine: 0, shotgun: 0 },
    parts: { ...(baseLoadout?.parts ?? emptyLoadout().parts) },
    kits: { ...(baseLoadout?.kits ?? emptyLoadout().kits) },
    medkits: 0,
    knife: false,
    bottles: 0,
    supplies: emptySupplies(),
  };

  for (const item of grid.items) {
    const isGun = (WEAPON_ORDER as readonly string[]).includes(item.type);
    if (isGun) {
      const weapon = item.type as WeaponId;
      const fit = baseLoadout?.guns[weapon]?.fit;
      result.guns[weapon] = fit ? { fit } : {};
      continue;
    }

    const matchedWeapon = AMMO_WEAPON_MAP[item.type];
    const isAmmo = matchedWeapon !== undefined;
    if (isAmmo) {
      const defaultRounds = AMMO_PICKUPS[item.type as AmmoPickup]?.rounds ?? 6;
      const rounds = item.ammo ?? item.count ?? defaultRounds;
      result.ammoBag[matchedWeapon] += rounds;
      continue;
    }

    const isMedkit = item.type === 'medkit';
    if (isMedkit) {
      result.medkits += 1;
      continue;
    }

    const isKnife = item.type === 'knife';
    if (isKnife) {
      result.knife = true;
      continue;
    }

    const isBottle = item.type === 'bottle';
    if (isBottle) {
      result.bottles += 1;
      continue;
    }

    const isSupply = isSupplyType(item.type);
    if (isSupply) {
      const supplyType = item.type as SupplyType;
      result.supplies![supplyType] += 1;
    }
  }

  return result;
}

/** Packs a Loadout into a 4x12 grid. If existingGrid is given, preserves positions of matching items. */
export function loadoutToGrid(loadout: Loadout, existingGrid?: InventoryGrid): InventoryGrid {
  const grid = createBunkerLockerGrid();
  let nextSerial = 1;

  const remainingGuns = new Set(WEAPON_ORDER.filter((w) => loadout.guns[w]));
  const remainingAmmo: Record<WeaponId, number> = { ...loadout.ammoBag };
  let remainingMedkits = loadout.medkits;
  let remainingKnife = loadout.knife;
  let remainingBottles = loadout.bottles;
  const remainingSupplies: Record<SupplyType, number> = {
    bandage: loadout.supplies?.bandage ?? 0,
    canned_food: loadout.supplies?.canned_food ?? 0,
    water_bottle: loadout.supplies?.water_bottle ?? 0,
    disinfectant: loadout.supplies?.disinfectant ?? 0,
    antibiotics: loadout.supplies?.antibiotics ?? 0,
  };

  // 1. Keep existing placed items if they match what loadout specifies
  if (existingGrid) {
    for (const item of existingGrid.items) {
      const isGun = (WEAPON_ORDER as readonly string[]).includes(item.type);
      if (isGun && remainingGuns.has(item.type as WeaponId)) {
        if (canPlaceItem(grid, item.type, item.x, item.y, item.rotated)) {
          placeItem(grid, { ...item });
          remainingGuns.delete(item.type as WeaponId);
          continue;
        }
      }

      const ammoWeapon = AMMO_WEAPON_MAP[item.type];
      if (ammoWeapon && remainingAmmo[ammoWeapon] > 0) {
        if (canPlaceItem(grid, item.type, item.x, item.y, item.rotated)) {
          const rounds = item.ammo ?? AMMO_PICKUPS[item.type as AmmoPickup]?.rounds ?? 6;
          placeItem(grid, { ...item, ammo: Math.min(rounds, remainingAmmo[ammoWeapon]) });
          remainingAmmo[ammoWeapon] = Math.max(0, remainingAmmo[ammoWeapon] - rounds);
          continue;
        }
      }

      const isMedkit = item.type === 'medkit';
      if (isMedkit && remainingMedkits > 0) {
        if (canPlaceItem(grid, item.type, item.x, item.y, item.rotated)) {
          placeItem(grid, { ...item });
          remainingMedkits -= 1;
          continue;
        }
      }

      const isKnife = item.type === 'knife';
      if (isKnife && remainingKnife) {
        if (canPlaceItem(grid, item.type, item.x, item.y, item.rotated)) {
          placeItem(grid, { ...item });
          remainingKnife = false;
          continue;
        }
      }

      const isBottle = item.type === 'bottle';
      if (isBottle && remainingBottles > 0) {
        if (canPlaceItem(grid, item.type, item.x, item.y, item.rotated)) {
          placeItem(grid, { ...item });
          remainingBottles -= 1;
          continue;
        }
      }

      const isSupply = isSupplyType(item.type);
      if (isSupply && remainingSupplies[item.type as SupplyType] > 0) {
        if (canPlaceItem(grid, item.type, item.x, item.y, item.rotated)) {
          placeItem(grid, { ...item });
          remainingSupplies[item.type as SupplyType] -= 1;
          continue;
        }
      }
    }
  }

  // 2. Pack any newly added or remaining items into available slots
  for (const weapon of remainingGuns) {
    autoPackItem(grid, { id: `gun:${weapon}:${nextSerial++}`, type: weapon, rotated: false });
  }

  for (const weapon of WEAPON_ORDER) {
    const ammoType = WEAPON_AMMO_TYPE[weapon];
    const boxRounds = AMMO_PICKUPS[ammoType].rounds;
    while (remainingAmmo[weapon] > 0) {
      const rounds = Math.min(remainingAmmo[weapon], boxRounds);
      const packed = autoPackItem(grid, { id: `ammo:${weapon}:${nextSerial++}`, type: ammoType, ammo: rounds, rotated: false });
      if (!packed) break;
      remainingAmmo[weapon] -= rounds;
    }
  }

  while (remainingMedkits > 0) {
    const packed = autoPackItem(grid, { id: `medkit:${nextSerial++}`, type: 'medkit', rotated: false });
    if (!packed) break;
    remainingMedkits -= 1;
  }

  if (remainingKnife) {
    autoPackItem(grid, { id: `knife:${nextSerial++}`, type: 'knife', rotated: false });
  }

  while (remainingBottles > 0) {
    const packed = autoPackItem(grid, { id: `bottle:${nextSerial++}`, type: 'bottle', rotated: false });
    if (!packed) break;
    remainingBottles -= 1;
  }

  for (const supplyType of SUPPLY_TYPES) {
    while (remainingSupplies[supplyType] > 0) {
      const packed = autoPackItem(grid, { id: `${supplyType}:${nextSerial++}`, type: supplyType, rotated: false });
      if (!packed) break;
      remainingSupplies[supplyType] -= 1;
    }
  }

  return grid;
}

/** Packs new gear brought home by a banked run into the existing 4x12 bunker grid. */
export function mergeGridLocker(existingGrid: InventoryGrid, gear: Loadout): InventoryGrid {
  const grid: InventoryGrid = {
    cols: existingGrid.cols,
    rows: existingGrid.rows,
    items: existingGrid.items.map((item) => ({ ...item })),
  };

  let nextSerial = Date.now();

  for (const weapon of WEAPON_ORDER) {
    const hasGun = gear.guns[weapon] !== undefined;
    const alreadyStored = grid.items.some((item) => item.type === weapon);
    if (hasGun && !alreadyStored) {
      autoPackItem(grid, { id: `gun:${weapon}:${nextSerial++}`, type: weapon, rotated: false });
    }
  }

  for (const weapon of WEAPON_ORDER) {
    let rounds = gear.ammoBag[weapon] ?? 0;
    const ammoType = WEAPON_AMMO_TYPE[weapon];
    const boxRounds = AMMO_PICKUPS[ammoType].rounds;
    while (rounds > 0) {
      const takeRounds = Math.min(rounds, boxRounds);
      const packed = autoPackItem(grid, { id: `ammo:${weapon}:${nextSerial++}`, type: ammoType, ammo: takeRounds, rotated: false });
      if (!packed) break;
      rounds -= takeRounds;
    }
  }

  for (let m = 0; m < gear.medkits; m += 1) {
    autoPackItem(grid, { id: `medkit:${nextSerial++}`, type: 'medkit', rotated: false });
  }

  if (gear.knife && !grid.items.some((item) => item.type === 'knife')) {
    autoPackItem(grid, { id: `knife:${nextSerial++}`, type: 'knife', rotated: false });
  }

  for (let b = 0; b < gear.bottles; b += 1) {
    autoPackItem(grid, { id: `bottle:${nextSerial++}`, type: 'bottle', rotated: false });
  }

  for (const supplyType of SUPPLY_TYPES) {
    const count = gear.supplies?.[supplyType] ?? 0;
    for (let s = 0; s < count; s += 1) {
      autoPackItem(grid, { id: `${supplyType}:${nextSerial++}`, type: supplyType, rotated: false });
    }
  }

  return grid;
}

/** Prepares player's carried hands as pack and pockets grids plus equipped weapons for DualLootModal. */
export function loadoutToHandsBag(
  hands: Loadout,
  tier: BackpackTier = 'satchel'
): {
  backpackGrid: InventoryGrid;
  pocketsGrid: InventoryGrid;
  gear: GearEquipState;
} {
  const bag = createBag(tier);
  // The hands' rounds are laid out as their own boxes below, so the bag's own ammo boxes are left out here.
  syncBag(bag, bagWanted({ ...hands, materials: undefined, fireworks: 0, fountains: 0, ammoBag: undefined }));

  let primary: GridItem | null = null;
  let secondary: GridItem | null = null;
  let sidearm: GridItem | null = null;

  for (const weapon of WEAPON_ORDER) {
    if (!hands.guns[weapon]) continue;
    const isPistol = weapon === 'pistol';
    if (isPistol && sidearm === null) {
      sidearm = { id: `gear:sidearm:${weapon}`, type: weapon, x: 0, y: 0, rotated: false };
    } else if (primary === null) {
      primary = { id: `gear:primary:${weapon}`, type: weapon, x: 0, y: 0, rotated: false };
    } else if (secondary === null) {
      secondary = { id: `gear:secondary:${weapon}`, type: weapon, x: 0, y: 0, rotated: false };
    } else {
      autoPackItem(bag.pack, { id: `gear:extra:${weapon}`, type: weapon, rotated: false });
    }
  }

  let ammoSerial = 1;
  for (const weapon of WEAPON_ORDER) {
    let rounds = hands.ammoBag[weapon] ?? 0;
    const ammoType = WEAPON_AMMO_TYPE[weapon];
    const boxRounds = AMMO_PICKUPS[ammoType].rounds;
    while (rounds > 0) {
      const takeRounds = Math.min(rounds, boxRounds);
      const packed = autoPackItem(bag.pack, {
        id: `hands-ammo:${weapon}:${ammoSerial++}`,
        type: ammoType,
        ammo: takeRounds,
        rotated: false,
      });
      if (!packed) break;
      rounds -= takeRounds;
    }
  }

  return {
    backpackGrid: bag.pack,
    pocketsGrid: bag.pockets,
    gear: { primary, secondary, sidearm, armor: null },
  };
}

/** Derives the player's carried Loadout from the items in pack, pockets, and equipped gear slots. */
export function handsFromGrids(
  backpackGrid: InventoryGrid,
  pocketsGrid: InventoryGrid,
  gear: GearEquipState,
  baseHands?: Loadout
): Loadout {
  const result: Loadout = {
    guns: {},
    ammoBag: { pistol: 0, carbine: 0, shotgun: 0 },
    parts: { ...(baseHands?.parts ?? emptyLoadout().parts) },
    kits: { ...(baseHands?.kits ?? emptyLoadout().kits) },
    medkits: 0,
    knife: false,
    bottles: 0,
    supplies: emptySupplies(),
  };

  const allItems = [...backpackGrid.items, ...pocketsGrid.items];
  const gearItems = [gear.primary, gear.secondary, gear.sidearm].filter((g): g is GridItem => g !== null);

  for (const gearItem of gearItems) {
    if ((WEAPON_ORDER as readonly string[]).includes(gearItem.type)) {
      const weapon = gearItem.type as WeaponId;
      const fit = baseHands?.guns[weapon]?.fit;
      result.guns[weapon] = fit ? { fit } : {};
    }
  }

  for (const item of allItems) {
    const isGun = (WEAPON_ORDER as readonly string[]).includes(item.type);
    if (isGun) {
      const weapon = item.type as WeaponId;
      const fit = baseHands?.guns[weapon]?.fit;
      result.guns[weapon] = fit ? { fit } : {};
      continue;
    }

    const matchedWeapon = AMMO_WEAPON_MAP[item.type];
    const isAmmo = matchedWeapon !== undefined;
    if (isAmmo) {
      const defaultRounds = AMMO_PICKUPS[item.type as AmmoPickup]?.rounds ?? 6;
      const rounds = item.ammo ?? item.count ?? defaultRounds;
      result.ammoBag[matchedWeapon] += rounds;
      continue;
    }

    const isMedkit = item.type === 'medkit';
    if (isMedkit) {
      result.medkits += 1;
      continue;
    }

    const isKnife = item.type === 'knife';
    if (isKnife) {
      result.knife = true;
      continue;
    }

    const isBottle = item.type === 'bottle';
    if (isBottle) {
      result.bottles += 1;
      continue;
    }

    const isSupply = isSupplyType(item.type);
    if (isSupply) {
      const supplyType = item.type as SupplyType;
      result.supplies![supplyType] += 1;
    }
  }

  return result;
}
