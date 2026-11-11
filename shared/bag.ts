import { backpackDef } from './backpack.ts';
import type { BackpackTier } from './backpack.ts';
import {
  canPlaceItem,
  createInventoryGrid,
  findAvailableSlot,
  placeItem,
  removeItem,
} from './grid-inventory.ts';
import type { GridItem, InventoryGrid } from './grid-inventory.ts';

/** The things a survivor packs. Guns are worn, and ammo, candy, parts, kits and treasure are not bag items. */
export const BAG_ITEM_TYPES = [
  'medkit', 'bottle', 'knife', 'plank', 'hammer_tool', 'crowbar', 'sheet_curtain', 'firework', 'fountain', 'nails',
] as const;
export type BagItemType = (typeof BAG_ITEM_TYPES)[number];

/** One item stands for the whole count, as a box of nails does. */
const STACKED: readonly BagItemType[] = ['firework', 'fountain', 'nails'];

export const POCKET_COLS = 2;
export const POCKET_ROWS = 2;

export type BagGridId = 'pack' | 'pockets';

export interface PlayerBag {
  pack: InventoryGrid;
  pockets: InventoryGrid;
  /** Mints item ids, so a host and a client that see the same changes name the same items the same way. */
  serial: number;
}

/** What the layout says about one item: the whole of what a commit may say. Ids never cross the wire; the type says which item. */
export interface BagLayoutRow {
  readonly type: BagItemType;
  readonly grid: BagGridId;
  readonly x: number;
  readonly y: number;
  readonly rotated: boolean;
}

export interface BagDrop {
  readonly type: BagItemType;
  readonly count: number;
}

/** What the client sends when the bag closes. */
export interface BagCommit {
  readonly layout: readonly BagLayoutRow[];
  readonly drop: readonly BagDrop[];
}

export type BagWanted = Record<BagItemType, number>;

/** The counters a bag is built from. A player, a snapshot entity and the HUD all carry these. */
export interface BagSource {
  readonly medkits: number;
  readonly knife: boolean;
  readonly bottles?: number;
  readonly fireworks?: number;
  readonly fountains?: number;
  readonly materials?: {
    readonly planks: number;
    readonly nails: number;
    readonly sheets: number;
    readonly hasHammer: boolean;
    readonly hasCrowbar: boolean;
  };
}

export function isBagItemType(value: unknown): value is BagItemType {
  return typeof value === 'string' && (BAG_ITEM_TYPES as readonly string[]).includes(value);
}

export function isStackedType(type: BagItemType): boolean {
  return STACKED.includes(type);
}

export function createBag(tier: BackpackTier | undefined): PlayerBag {
  const { cols, rows } = backpackDef(tier ?? 'satchel');
  return { pack: createInventoryGrid(cols, rows), pockets: createInventoryGrid(POCKET_COLS, POCKET_ROWS), serial: 0 };
}

function whole(value: number | undefined): number {
  return value !== undefined && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

/** The multiset the counters imply. Stacked types hold their unit count; everything else holds one item per unit. */
export function bagWanted(p: BagSource): BagWanted {
  const m = p.materials;
  return {
    medkit: whole(p.medkits),
    bottle: whole(p.bottles),
    knife: p.knife ? 1 : 0,
    plank: whole(m?.planks),
    hammer_tool: m?.hasHammer ? 1 : 0,
    crowbar: m?.hasCrowbar ? 1 : 0,
    sheet_curtain: whole(m?.sheets),
    firework: whole(p.fireworks),
    fountain: whole(p.fountains),
    nails: whole(m?.nails),
  };
}

/** Which bag item a pickup or a find becomes, if it is one. */
export function bagTypeOf(type: string): BagItemType | null {
  return isBagItemType(type) ? type : null;
}

function serialOf(item: GridItem): number {
  return Number(item.id.slice(item.id.indexOf(':') + 1));
}

/** Every item of one type, the pack's first, as `[grid, item]`. */
function itemsOf(bag: PlayerBag, type: BagItemType): { grid: InventoryGrid; item: GridItem }[] {
  const found: { grid: InventoryGrid; item: GridItem }[] = [];
  for (const grid of [bag.pack, bag.pockets]) {
    for (const item of grid.items) if (item.type === type) found.push({ grid, item });
  }
  return found;
}

function pack(bag: PlayerBag, type: BagItemType, count?: number): boolean {
  for (const grid of [bag.pack, bag.pockets]) {
    const slot = findAvailableSlot(grid, type, true);
    if (!slot) continue;
    const id = `${type}:${bag.serial + 1}`;
    const placed = placeItem(grid, { id, type, x: slot.x, y: slot.y, rotated: slot.rotated, ...(count !== undefined ? { count } : {}) });
    if (!placed) continue;
    bag.serial += 1;
    return true;
  }
  return false;
}

/** One more of `type` has a slot: a stack already there takes it, otherwise the pack and then the pockets must have room. */
export function canCarry(bag: PlayerBag, type: BagItemType): boolean {
  if (isStackedType(type) && itemsOf(bag, type).length > 0) return true;
  return [bag.pack, bag.pockets].some((grid) => findAvailableSlot(grid, type, true) !== null);
}

/**
 * Brings the bag to what the counters say. Surplus items go newest first; missing ones are packed in a fixed type order,
 * pack before pockets. Returns what had no room, in units, and mints no id for it. Same counters in, same layout out.
 */
export function syncBag(bag: PlayerBag, wanted: BagWanted): Partial<BagWanted> {
  const overflow: Partial<BagWanted> = {};
  for (const type of BAG_ITEM_TYPES) {
    const want = wanted[type];
    const have = itemsOf(bag, type);
    if (isStackedType(type)) {
      syncStack(bag, type, want, have, overflow);
      continue;
    }
    const surplus = [...have].sort((a, b) => serialOf(b.item) - serialOf(a.item)).slice(0, Math.max(0, have.length - want));
    for (const { grid, item } of surplus) removeItem(grid, item.id);
    for (let missing = want - have.length; missing > 0; missing -= 1) {
      if (pack(bag, type)) continue;
      overflow[type] = missing;
      break;
    }
  }
  return overflow;
}

function syncStack(bag: PlayerBag, type: BagItemType, want: number, have: { grid: InventoryGrid; item: GridItem }[], overflow: Partial<BagWanted>): void {
  const keep = want > 0 ? have[0] : undefined;
  for (const extra of have.filter((entry) => entry !== keep)) removeItem(extra.grid, extra.item.id);
  if (keep) keep.item.count = want;
  else if (want > 0 && !pack(bag, type, want)) overflow[type] = want;
}

/**
 * Resizes the pack to a tier. What no longer fits where it was is packed again, and what fits nowhere is returned
 * so the caller can drop it. A bag already the right size is left alone.
 */
export function retierBag(bag: PlayerBag, tier: BackpackTier | undefined): GridItem[] {
  const { cols, rows } = backpackDef(tier ?? 'satchel');
  if (bag.pack.cols === cols && bag.pack.rows === rows) return [];
  const old = [...bag.pack.items];
  bag.pack = createInventoryGrid(cols, rows);
  const evicted: GridItem[] = [];
  for (const item of old) {
    if (canPlaceItem(bag.pack, item.type, item.x, item.y, item.rotated) && placeItem(bag.pack, { ...item })) continue;
    const grid = [bag.pack, bag.pockets].find((candidate) => findAvailableSlot(candidate, item.type, true) !== null);
    const slot = grid ? findAvailableSlot(grid, item.type, true) : null;
    if (grid && slot && placeItem(grid, { ...item, x: slot.x, y: slot.y, rotated: slot.rotated })) continue;
    evicted.push(item);
  }
  return evicted;
}

/** Code-point order, never a locale's, so both sides sort the same. */
function byRow(a: BagLayoutRow, b: BagLayoutRow): number {
  const ka = `${a.type}|${a.grid}|${String(a.x).padStart(4, '0')}|${String(a.y).padStart(4, '0')}|${a.rotated ? 1 : 0}`;
  const kb = `${b.type}|${b.grid}|${String(b.x).padStart(4, '0')}|${String(b.y).padStart(4, '0')}|${b.rotated ? 1 : 0}`;
  if (ka === kb) return 0;
  return ka < kb ? -1 : 1;
}

/** The pack and pockets as one list of rows, sorted by what they say. No ids: two bags that look alike have equal layouts. */
export function bagLayout(bag: PlayerBag): BagLayoutRow[] {
  const rows: BagLayoutRow[] = [];
  for (const [name, grid] of [['pack', bag.pack], ['pockets', bag.pockets]] as const) {
    for (const item of grid.items) rows.push({ type: item.type as BagItemType, grid: name, x: item.x, y: item.y, rotated: item.rotated });
  }
  return rows.sort(byRow);
}

/** A small integer over (type, grid, x, y, rotated) sorted: the same things in the same places hash the same, whatever their ids. */
export function layoutHash(layout: readonly BagLayoutRow[]): number {
  let hash = 0x811c9dc5;
  for (const row of [...layout].sort(byRow)) {
    const text = `${row.type}|${row.grid}|${row.x}|${row.y}|${row.rotated ? 1 : 0};`;
    for (let i = 0; i < text.length; i += 1) hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193);
  }
  return (hash >>> 8) & 0xffffff;
}

export function bagHash(bag: PlayerBag): number {
  return layoutHash(bagLayout(bag));
}

/**
 * Checks a layout against a bag without touching it and, if it holds, returns the placements. Its rows must be exactly
 * the multiset of types the bag holds, each in bounds and clear of the others. Each row takes an unused item of its
 * type (items of a type are interchangeable), so the bag keeps its own ids and counts. Anything else is null.
 */
export function validateLayout(bag: PlayerBag, layout: readonly BagLayoutRow[]): { row: BagLayoutRow; item: GridItem }[] | null {
  const pool = new Map<string, GridItem[]>();
  let total = 0;
  for (const item of [...bag.pack.items, ...bag.pockets.items]) {
    pool.set(item.type, [...(pool.get(item.type) ?? []), item]);
    total += 1;
  }
  if (layout.length !== total) return null;
  const scratch = { pack: createInventoryGrid(bag.pack.cols, bag.pack.rows), pockets: createInventoryGrid(bag.pockets.cols, bag.pockets.rows) };
  const placements: { row: BagLayoutRow; item: GridItem }[] = [];
  for (const row of layout) {
    const grid = row.grid === 'pack' || row.grid === 'pockets' ? scratch[row.grid] : null;
    const item = isBagItemType(row.type) ? pool.get(row.type)?.shift() : undefined;
    const wellFormed = item !== undefined && grid !== null && Number.isInteger(row.x) && Number.isInteger(row.y) && typeof row.rotated === 'boolean';
    if (!wellFormed || !canPlaceItem(grid, item.type, row.x, row.y, row.rotated)) return null;
    placeItem(grid, { ...item, x: row.x, y: row.y, rotated: row.rotated });
    placements.push({ row, item });
  }
  return placements;
}

/** Moves the bag's items to a layout `validateLayout` accepted. */
export function adoptLayout(bag: PlayerBag, placements: { row: BagLayoutRow; item: GridItem }[]): void {
  bag.pack.items = [];
  bag.pockets.items = [];
  for (const { row, item } of placements) {
    (row.grid === 'pack' ? bag.pack : bag.pockets).items.push({ ...item, x: row.x, y: row.y, rotated: row.rotated });
  }
}

/** The room for one more, after bringing the bag up to the counters. For a pickup or a find to ask before it takes. */
export function roomFor(p: BagSource & { inventory: PlayerBag }, type: BagItemType): boolean {
  syncBag(p.inventory, bagWanted(p));
  return canCarry(p.inventory, type);
}
