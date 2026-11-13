import { bagHash, bagLayout, bagWanted, createBag, isAmmoBoxType, isBagItemType, isDroppableBagItem, layoutHash, retierBag, stampAmmoBoxes, syncBag } from '@shared/bag.ts';
import type { BagCommit, BagDrop, BagItemType, BagWanted, PlayerBag } from '@shared/bag.ts';
import { backpackDef } from '@shared/backpack.ts';
import type { BackpackTier } from '@shared/backpack.ts';
import { autoPackItem, canPlaceItem, createInventoryGrid, findAvailableSlot, placeItem } from '@shared/grid-inventory.ts';
import type { GridItem, InventoryGrid } from '@shared/grid-inventory.ts';
import { containerGridDimensions } from '@shared/containers.ts';
import type { ContainerKind } from '@shared/containers.ts';
import type { WeaponId } from '@shared/protocol.ts';
import { isCandyId, type CandyId } from '@shared/candy.ts';
import { isSupplyType, SUPPLY_TYPES } from '@shared/supply-types.ts';
import type { Supplies } from '@shared/supply-types.ts';
import type { ContainerArt } from '@art/containers.ts';
import type { HudState } from '@game/hud-state.ts';

/** How long a layout may disagree with the host's hash, bag shut, before it is sent again. */
const HEAL_AFTER_MS = 1000;
const HEAL_EVERY_MS = 2000;
const HEAL_TRIES = 3;
/** How long a drop is held back from the snapshots, in case the host has not heard it yet. */
const PENDING_MS = 2000;

type Carried = Pick<HudState, 'owned' | 'weapon' | 'mags' | 'ammoBag' | 'medkits' | 'bottles' | 'fireworks' | 'fountains' | 'knife' | 'backpackTier' | 'materials' | 'supplies' | 'bagHash'> & {
  bag?: HudState['bag'];
};

/** Guns are worn, not packed: the held gun, another long gun, and the pistol each have a slot of their own. */
export interface WornGear {
  primary: GridItem | null;
  secondary: GridItem | null;
  sidearm: GridItem | null;
  armor: GridItem | null;
}

/** What the modal edits while it is open. Nothing here reaches the sim until the bag closes. */
export interface BagWorking {
  readonly tier: BackpackTier;
  readonly pack: InventoryGrid;
  readonly pockets: InventoryGrid;
  readonly candyBag: InventoryGrid;
  /** Items remaining in the container. */
  readonly container: InventoryGrid;
  readonly gear: WornGear;
  /** Supplies used by hand (the USE button) while open. Sent as the commit's `use` rows. */
  readonly used: GridItem[];
  /** Items dropped by hand while open. */
  readonly dropped: GridItem[];
  readonly containerTitle?: string;
  readonly containerKind?: ContainerKind;
  readonly containerId?: number | null;
  readonly containerArt?: ContainerArt | null;
}

function gunItem(weapon: WeaponId, hud: Carried): GridItem {
  return { id: weapon, type: weapon, x: 0, y: 0, rotated: false, ammo: hud.mags[weapon] + hud.ammoBag[weapon] };
}

/** The held gun is primary, a second long gun is secondary, and the pistol rides as the sidearm unless it is the one held. */
export function wornGear(hud: Pick<Carried, 'owned' | 'weapon' | 'mags' | 'ammoBag'>): WornGear {
  const owned = (weapon: WeaponId): boolean => hud.owned.includes(weapon);
  const primary = owned(hud.weapon) ? hud.weapon : null;
  const secondary = (['carbine', 'shotgun'] as const).find((weapon) => owned(weapon) && weapon !== primary) ?? null;
  const sidearm = owned('pistol') && primary !== 'pistol' ? 'pistol' : null;
  const item = (weapon: WeaponId | null): GridItem | null => (weapon ? gunItem(weapon, hud as Carried) : null);
  return { primary: item(primary), secondary: item(secondary), sidearm: item(sidearm), armor: null };
}

function copyGrid(grid: InventoryGrid): InventoryGrid {
  return { cols: grid.cols, rows: grid.rows, items: grid.items.map((item) => ({ ...item })) };
}

/** The pack as the player's own client keeps it: the same bag the host keeps, built from the same counters. */
export class LocalBag {
  readonly bag: PlayerBag = createBag('satchel');

  private openIds: Set<string> | null = null;
  private containerOriginalIds: Set<string> | null = null;
  private hostHash: number | undefined;
  private mismatchSince: number | null = null;
  private lastHeal = -Infinity;
  private heals = 0;
  private pending: { type: BagItemType; before: number; dropped: number; at: number }[] = [];

  constructor(
    private readonly send: (commit: BagCommit) => void,
    private readonly now: () => number = () => Date.now(),
  ) {}

  reset(): void {
    this.bag.pack = createInventoryGrid(this.bag.pack.cols, this.bag.pack.rows);
    this.bag.pockets.items = [];
    this.bag.serial = 0;
    this.pending = [];
    this.openIds = null;
    this.containerOriginalIds = null;
    this.mismatchSince = null;
    this.heals = 0;
  }

  /** Every snapshot: the same sync the host runs, so a pickup appears and a used item goes with no message. */
  sync(hud: Carried): void {
    const wanted = bagWanted(hud);
    const now = this.now();
    this.pending = this.pending.filter((entry) => now - entry.at < PENDING_MS && wanted[entry.type] === entry.before);
    for (const entry of this.pending) wanted[entry.type] = Math.max(0, entry.before - entry.dropped);
    retierBag(this.bag, hud.backpackTier);
    syncBag(this.bag, wanted);
    stampAmmoBoxes(this.bag, hud.ammoBag);
    this.hostHash = hud.bagHash;
  }

  /** The bag is shut and the host's hash has disagreed for a while: say where everything is, once in a while, a few times. */
  heal(): void {
    const now = this.now();
    const settled = this.openIds === null && this.pending.length === 0 && this.hostHash !== undefined;
    if (!settled) return;
    if (bagHash(this.bag) === this.hostHash) {
      this.mismatchSince = null;
      this.heals = 0;
      return;
    }
    this.mismatchSince ??= now;
    const due = now - this.mismatchSince >= HEAL_AFTER_MS && now - this.lastHeal >= HEAL_EVERY_MS && this.heals < HEAL_TRIES;
    if (!due) return;
    this.lastHeal = now;
    this.heals += 1;
    this.send({ layout: bagLayout(this.bag), drop: [] });
  }

  /** A copy of the bag to edit, and the gear the survivor wears. */
  open(
    hud: Carried,
    containerId: number | null = null,
    containerTitle = 'Nearby',
    containerItems: readonly GridItem[] = [],
    containerKind?: ContainerKind,
    containerArt?: ContainerArt | null,
  ): BagWorking {
    this.openIds = new Set([...this.bag.pack.items, ...this.bag.pockets.items].map((item) => item.id));
    this.containerOriginalIds = new Set(containerItems.map((item) => item.id));
    const tier = hud.backpackTier ?? 'satchel';
    const { cols, rows, blocked } = containerGridDimensions(containerKind);
    const container = createInventoryGrid(cols, rows, blocked);
    for (const item of containerItems) {
      if (!placeItem(container, { ...item })) {
        autoPackItem(container, { ...item });
      }
    }
    const candyBag = createInventoryGrid(2, 6);
    let candyIdx = 0;
    for (const stack of hud.bag ?? []) {
      for (let c = 0; c < stack.count; c += 1) {
        autoPackItem(candyBag, {
          id: `candy-carried-${stack.id}-${candyIdx++}`,
          type: stack.id,
          rotated: false,
        });
      }
    }
    return {
      tier,
      pack: copyGrid(this.bag.pack),
      pockets: copyGrid(this.bag.pockets),
      candyBag,
      container,
      gear: wornGear(hud),
      used: [],
      dropped: [],
      containerTitle,
      containerKind,
      containerId,
      containerArt,
    };
  }

  /** The bag closed. Sends one commit if anything changed, adopts the working copy, and says what it sent (null for nothing). */
  close(working: BagWorking): BagCommit | null {
    const openIds = this.openIds ?? new Set<string>();
    const containerOriginalIds = this.containerOriginalIds ?? new Set<string>();
    this.openIds = null;
    this.containerOriginalIds = null;
    const known = new Map<string, GridItem>();
    for (const item of [...this.bag.pack.items, ...this.bag.pockets.items]) known.set(item.id, item);
    const scratch = { pack: createInventoryGrid(this.bag.pack.cols, this.bag.pack.rows), pockets: createInventoryGrid(this.bag.pockets.cols, this.bag.pockets.rows) };
    const placed = new Set<string>();
    for (const [name, grid] of [['pack', working.pack], ['pockets', working.pockets]] as const) {
      for (const item of grid.items) {
        if (containerOriginalIds.has(item.id)) {
          if (placeItem(scratch[name], { ...item })) placed.add(item.id);
        } else {
          const real = known.get(item.id);
          if (real && !placed.has(item.id) && placeItem(scratch[name], { ...real, x: item.x, y: item.y, rotated: item.rotated })) placed.add(item.id);
        }
      }
    }
    const dropped = new Map<BagItemType | CandyId, number>();
    const isFurniture = working.containerId !== null && working.containerId !== undefined;
    const inContainer = isFurniture ? new Set(working.container.items.map((i) => i.id)) : new Set<string>();
    const usedIds = new Set(working.used.map((item) => item.id));
    const usedCounts = new Map<BagItemType | CandyId, number>();
    for (const [id, item] of known) {
      if (placed.has(id) || inContainer.has(id)) continue;
      const type = item.type as BagItemType;
      const wasUsed = usedIds.has(id) && isSupplyType(type);
      const meantToGo = openIds.has(id) && isDroppableBagItem(type);
      if (wasUsed) usedCounts.set(type, (usedCounts.get(type) ?? 0) + 1);
      else if (meantToGo) dropped.set(type, (dropped.get(type) ?? 0) + (item.count ?? 1));
      else if (!settle(scratch, item)) continue;
      else placed.add(id);
    }
    const containerTaken: GridItem[] = [];
    for (const item of [...working.pack.items, ...working.pockets.items, ...working.candyBag.items]) {
      if (containerOriginalIds.has(item.id)) containerTaken.push(item);
    }
    for (const item of working.used) {
      // A box that was loaded: the host starts the reload, and the box goes when the rounds do.
      if (isAmmoBoxType(item.type)) {
        usedCounts.set(item.type, (usedCounts.get(item.type) ?? 0) + 1);
        continue;
      }
      const isCandy = isCandyId(item.type);
      const isSupply = isSupplyType(item.type);
      if (isCandy) {
        usedCounts.set(item.type, (usedCounts.get(item.type) ?? 0) + 1);
        if (containerOriginalIds.has(item.id)) containerTaken.push(item);
      } else if (containerOriginalIds.has(item.id)) {
        containerTaken.push(item);
        if (isSupply) {
          usedCounts.set(item.type as BagItemType, (usedCounts.get(item.type as BagItemType) ?? 0) + 1);
        }
      }
    }
    for (const item of working.dropped) {
      const isCandy = isCandyId(item.type);
      const isDroppable = isDroppableBagItem(item.type);
      if (isCandy) {
        dropped.set(item.type, (dropped.get(item.type) ?? 0) + 1);
        if (containerOriginalIds.has(item.id)) containerTaken.push(item);
      } else if (containerOriginalIds.has(item.id)) {
        containerTaken.push(item);
        if (isDroppable) {
          dropped.set(item.type as BagItemType, (dropped.get(item.type as BagItemType) ?? 0) + (item.count ?? 1));
        }
      }
    }
    const layout = bagLayout({ ...scratch, serial: this.bag.serial });
    const toRow = ([type, count]: [BagItemType | CandyId, number]): BagDrop => ({ type, count });
    const drop: BagDrop[] = [...dropped].map(toRow);
    const use: BagDrop[] = [...usedCounts].map(toRow);
    const containerDeposited: GridItem[] = [];
    for (const item of working.container.items) {
      if (!containerOriginalIds.has(item.id)) containerDeposited.push(item);
    }
    const container = isFurniture ? {
      id: working.containerId!,
      items: [...working.container.items],
      taken: containerTaken,
      deposited: containerDeposited,
    } : undefined;

    const isUnchanged = drop.length === 0 && use.length === 0 && !container && bagHash(this.bag) === layoutHash(layout);
    if (isUnchanged) return null;
    this.adopt(scratch, [...drop, ...use], containerDeposited);
    const commit: BagCommit = { layout, drop, ...(use.length > 0 ? { use } : {}), ...(container ? { container } : {}) };
    this.send(commit);
    return commit;
  }

  /** Takes the edited layout as the bag's own. The host drops the newest of a type, but ids are not on the wire, so which survive does not matter. */
  private adopt(
    scratch: { pack: InventoryGrid; pockets: InventoryGrid },
    gone: BagDrop[],
    deposited: readonly GridItem[] = [],
  ): void {
    const before = bagWanted(this.currentCounters());
    for (const { type, count } of gone) {
      // Loading a box leaves it in the bag until the rounds are spent, so it is no pending removal.
      const isBagItem = isBagItemType(type) && !isAmmoBoxType(type);
      if (isBagItem) this.pending.push({ type, before: before[type], dropped: count, at: this.now() });
    }
    for (const item of deposited) {
      const isBagItem = isBagItemType(item.type);
      if (isBagItem) {
        this.pending.push({
          type: item.type,
          before: before[item.type],
          dropped: item.count ?? 1,
          at: this.now(),
        });
      }
    }
    this.bag.pack.items = scratch.pack.items;
    this.bag.pockets.items = scratch.pockets.items;
  }

  private currentCounters(): Carried {
    const count = (type: BagItemType): number => [...this.bag.pack.items, ...this.bag.pockets.items].filter((item) => item.type === type).reduce((sum, item) => sum + (item.count ?? 1), 0);
    const supplies = Object.fromEntries(SUPPLY_TYPES.map((type) => [type, count(type)])) as Supplies;
    return {
      owned: [], weapon: 'pistol', mags: { pistol: 0, carbine: 0, shotgun: 0 }, ammoBag: { pistol: 0, carbine: 0, shotgun: 0 },
      medkits: count('medkit'), bottles: count('bottle'), fireworks: count('firework'), fountains: count('fountain'), knife: count('knife') > 0,
      materials: { planks: count('plank'), nails: count('nails'), sheets: count('sheet_curtain'), hasHammer: count('hammer_tool') > 0, hasCrowbar: count('crowbar') > 0 },
      supplies,
    };
  }
}

/** Puts an item back where it was if that is still free, and anywhere it fits if not. False when nothing is free. */
function settle(scratch: { pack: InventoryGrid; pockets: InventoryGrid }, item: GridItem): boolean {
  for (const grid of [scratch.pack, scratch.pockets]) {
    if (canPlaceItem(grid, item.type, item.x, item.y, item.rotated) && placeItem(grid, { ...item })) return true;
  }
  const grid = [scratch.pack, scratch.pockets].find((candidate) => findAvailableSlot(candidate, item.type, true) !== null);
  return grid ? autoPackItem(grid, item) : false;
}

export type { BagWanted };
