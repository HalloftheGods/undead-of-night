// The client's side of item moves. It keeps what the host last said (`confirmed`: the bag, the open container, the
// candy and the worn guns from the latest snapshot) and the moves this survivor made that the host has not taken in
// yet. The grids both windows draw are the confirmed ones with those moves replayed on top, rebuilt on every snapshot
// and every answer, so a move shows at once and an item is never shown where the host does not have it for longer
// than one round trip.

import { createBag, isAmmoBoxType } from '../../../shared/bag.ts';
import type { BackpackTier } from '../../../shared/backpack.ts';
import type { BagLayoutRow } from '../../../shared/bag.ts';
import { CANDY_GRID } from '../../../shared/candy.ts';
import { autoPackFromBottom, createInventoryGrid, placeItem, removeItem } from '../../../shared/grid-inventory.ts';
import type { GridItem, GridPoint, InventoryGrid } from '../../../shared/grid-inventory.ts';
import { touchesContainer } from '../../../shared/item-move.ts';
import type { ItemMove, MoveReason } from '../../../shared/item-move.ts';
import { applyMoveToGrids, candyGridOf, candyMoveFor, copyGrid, moveSourceItem } from '../../../shared/item-move-grids.ts';
import type { MoveGrids } from '../../../shared/item-move-grids.ts';
import type { WornGear } from './bag-working.ts';

/** A move the host has not answered in this long is taken as a no. */
export const PENDING_TIMEOUT_MS = 2000;

/** The open container as the host has it, in the host's own cells (never flipped). */
export interface LedgerContainer {
  readonly id: number;
  readonly cols: number;
  readonly rows: number;
  readonly blocked?: readonly GridPoint[];
  readonly items: readonly GridItem[];
}

/** What one snapshot says about this survivor's things. */
export interface LedgerView {
  readonly tier: BackpackTier;
  /** The host's pack and pockets, with its ids (`bagRows`). */
  readonly bag: readonly BagLayoutRow[];
  readonly lastMoveId: number;
  readonly container: LedgerContainer | null;
  /** The candy bag as counts by kind: the host keeps no layout for it. */
  readonly candy: readonly { readonly id: string; readonly count: number }[];
  readonly gear: WornGear;
}

/**
 * What a rebuild undid: moves of ours that no longer apply, and container items a teammate took. `renamed` pairs an
 * item shown under one id with the host's id for it in the same cell (a find packed into the bag gets the bag's id),
 * so its motion carries on.
 */
export interface LedgerChange {
  readonly rejected: ItemMove[];
  readonly vanished: GridItem[];
  readonly renamed?: readonly (readonly [string, string])[];
}

interface Pending {
  readonly move: ItemMove;
  readonly at: number;
  /** The host said ok; it stays replayed until a snapshot's `lastMoveId` covers it, so nothing flickers. */
  acked: boolean;
}

const NO_CHANGE: LedgerChange = { rejected: [], vanished: [] };

function emptyGrids(): MoveGrids {
  const bag = createBag('satchel');
  return {
    pack: bag.pack,
    pockets: bag.pockets,
    candy: createInventoryGrid(CANDY_GRID.cols, CANDY_GRID.rows),
    container: null,
    gear: { primary: null, secondary: null, sidearm: null, armor: null },
  };
}

function cloneGrids(grids: MoveGrids): MoveGrids {
  const gear = { ...grids.gear };
  for (const slot of Object.keys(gear) as (keyof typeof gear)[]) gear[slot] = gear[slot] ? { ...gear[slot]! } : null;
  return { pack: copyGrid(grids.pack), pockets: copyGrid(grids.pockets), candy: copyGrid(grids.candy), container: grids.container ? copyGrid(grids.container) : null, gear };
}

/** The host's pack and pockets from its rows. A row from a host that sends no id gets one from its place in the list. */
function bagGridsOf(tier: BackpackTier, rows: readonly BagLayoutRow[]): { pack: InventoryGrid; pockets: InventoryGrid } {
  const bag = createBag(tier);
  rows.forEach((row, index) => {
    const item: GridItem = {
      id: row.id ?? `${row.type}:row-${index}`,
      type: row.type,
      x: row.x,
      y: row.y,
      rotated: row.rotated,
      ...(row.count !== undefined ? { count: row.count } : {}),
      ...(row.ammo !== undefined ? { ammo: row.ammo } : {}),
    };
    placeItem(bag[row.grid], item);
  });
  return { pack: bag.pack, pockets: bag.pockets };
}

function containerGridOf(view: LedgerContainer): InventoryGrid {
  const grid = createInventoryGrid(view.cols, view.rows, view.blocked);
  for (const item of view.items) placeItem(grid, { ...item });
  return grid;
}

/** Loading a box of rounds leaves it in the bag until the reload ends: the move only checks it is there. */
function applyLocal(grids: MoveGrids, move: ItemMove): MoveReason | null {
  const isLoad = move.to.kind === 'use' && isAmmoBoxType(move.type);
  if (isLoad) return moveSourceItem(grids, move) ? null : 'gone';
  return applyMoveToGrids(grids, move);
}

const cellOf = (item: GridItem): string => `${item.type}@${item.x},${item.y}`;

/** Items that kept their cell and type but changed id across a rebuild, as [shown id, new id]. */
function renamesBetween(before: MoveGrids, after: MoveGrids): [string, string][] {
  const pairs: [string, string][] = [];
  for (const key of ['pack', 'pockets', 'candy'] as const) {
    const was = before[key].items;
    const now = after[key].items;
    const nowIds = new Set(now.map((item) => item.id));
    const wasIds = new Set(was.map((item) => item.id));
    const gone = new Map(was.filter((item) => !nowIds.has(item.id)).map((item) => [cellOf(item), item.id]));
    for (const item of now) {
      const old = wasIds.has(item.id) ? undefined : gone.get(cellOf(item));
      if (old) pairs.push([old, item.id]);
    }
  }
  return pairs;
}

export class MoveLedger {
  private confirmed: MoveGrids = emptyGrids();
  private working: MoveGrids = emptyGrids();
  private pending: Pending[] = [];
  private nextId = 1;
  private candySerial = 0;
  private containerId: number | null = null;
  private confirmedOnce = false;

  constructor(
    private readonly send: (move: ItemMove) => void,
    private readonly now: () => number = () => Date.now(),
  ) {}

  /** The grids to draw: the host's, with this survivor's unanswered moves on top. */
  grids(): MoveGrids {
    return this.working;
  }

  /** The moves the host has not taken in yet, oldest first. */
  pendingMoves(): readonly ItemMove[] {
    return this.pending.map((entry) => entry.move);
  }

  /**
   * A snapshot: drops every pending move at or below its `lastMoveId` (the host has it), rebuilds from the host's view
   * and replays the rest. A replayed move that no longer applies is rejected. A container item the window still showed
   * that the host no longer has, and no move of ours took, vanished: a teammate took it.
   */
  confirm(view: LedgerView): LedgerChange {
    const shown = this.working;
    const previous = this.confirmed;
    const sameContainer = view.container !== null && view.container.id === this.containerId;
    this.pending = this.pending.filter((entry) => entry.move.id > view.lastMoveId);
    this.nextId = Math.max(this.nextId, view.lastMoveId + 1);
    const pendingIds = new Set(this.pending.map((entry) => entry.move.item));
    const bag = bagGridsOf(view.tier, view.bag);
    const container = view.container ? containerGridOf(view.container) : null;
    const candy = this.confirmedOnce ? this.candyFrom(shown.candy, view.candy, pendingIds) : candyGridOf(view.candy);
    const gear = { ...view.gear };
    this.confirmed = { pack: bag.pack, pockets: bag.pockets, candy, container, gear };
    this.containerId = view.container?.id ?? null;
    this.confirmedOnce = true;
    const vanished = sameContainer ? this.vanishedFrom(previous.container, shown.container, container) : [];
    const rejected = this.replay();
    return { rejected, vanished, renamed: renamesBetween(shown, this.working) };
  }

  /**
   * One move from a window. It is tried on the grids on screen first: if it does not apply there it is not sent and
   * this returns null. Otherwise it is applied, numbered, sent, and returned as sent.
   */
  propose(proposed: Omit<ItemMove, 'id'>): ItemMove | null {
    const numbered: ItemMove = { ...proposed, id: this.nextId };
    const move = candyMoveFor(this.working, numbered);
    if (applyLocal(this.working, move)) return null;
    this.nextId += 1;
    this.pending.push({ move, at: this.now(), acked: false });
    this.send(move);
    return move;
  }

  /** The host's answer to one move. An ok only marks it; a no undoes it and anything that leaned on it. */
  answer(moveId: number, ok: boolean): LedgerChange {
    const entry = this.pending.find((each) => each.move.id === moveId);
    if (!entry) return NO_CHANGE;
    if (ok) {
      entry.acked = true;
      return NO_CHANGE;
    }
    this.pending = this.pending.filter((each) => each !== entry);
    return { rejected: [entry.move, ...this.replay()], vanished: [] };
  }

  /** Moves left unanswered past the timeout are taken as a no. */
  expire(): LedgerChange {
    const now = this.now();
    const stale = this.pending.filter((entry) => !entry.acked && now - entry.at > PENDING_TIMEOUT_MS);
    if (stale.length === 0) return NO_CHANGE;
    this.pending = this.pending.filter((entry) => !stale.includes(entry));
    return { rejected: [...stale.map((entry) => entry.move), ...this.replay()], vanished: [] };
  }

  /** Forgets everything: the run ended or the survivor is gone. */
  reset(): void {
    this.confirmed = emptyGrids();
    this.working = emptyGrids();
    this.pending = [];
    this.containerId = null;
    this.confirmedOnce = false;
  }

  /** Rebuilds the grids on screen from the confirmed ones and the pending moves; returns the moves that failed. */
  private replay(): ItemMove[] {
    const grids = cloneGrids(this.confirmed);
    const rejected: ItemMove[] = [];
    const kept: Pending[] = [];
    for (const entry of this.pending) {
      // A move on a container that is no longer the open one waits for the host; it can not be tried here.
      const elsewhere = touchesContainer(entry.move) && entry.move.container !== this.containerId;
      if (elsewhere) {
        kept.push(entry);
        continue;
      }
      const move = candyMoveFor(grids, entry.move);
      const refused = applyLocal(grids, move) !== null;
      if (!refused) kept.push(entry);
      else if (!entry.acked) rejected.push(entry.move);
    }
    this.pending = kept;
    this.working = grids;
    return rejected;
  }

  /**
   * The candy bag kept as the window had it, brought to the host's counts: extra pieces go (one a pending move named
   * first, since replaying that move puts it back), missing ones are packed from the bottom.
   */
  private candyFrom(shown: InventoryGrid, stacks: LedgerView['candy'], pendingIds: ReadonlySet<string>): InventoryGrid {
    const grid = copyGrid(shown);
    const want = new Map(stacks.map((stack) => [stack.id, stack.count]));
    const kinds = new Set([...want.keys(), ...grid.items.map((item) => item.type)]);
    for (const kind of kinds) {
      const have = grid.items.filter((item) => item.type === kind);
      const extra = have.length - (want.get(kind) ?? 0);
      const byPending = [...have].sort((a, b) => Number(pendingIds.has(b.id)) - Number(pendingIds.has(a.id)) || have.indexOf(b) - have.indexOf(a));
      for (const item of byPending.slice(0, Math.max(0, extra))) removeItem(grid, item.id);
      for (let missing = -extra; missing > 0; missing -= 1) {
        this.candySerial += 1;
        if (!autoPackFromBottom(grid, { id: `candy-carried-${kind}-live-${this.candySerial}`, type: kind, rotated: false })) break;
      }
    }
    return grid;
  }

  /** Items in the host's last container that were still on screen and are now gone from the host's. */
  private vanishedFrom(before: InventoryGrid | null, shown: InventoryGrid | null, after: InventoryGrid | null): GridItem[] {
    if (!before || !shown || !after) return [];
    const still = new Set(after.items.map((item) => item.id));
    const onScreen = new Set(shown.items.map((item) => item.id));
    return before.items.filter((item) => onScreen.has(item.id) && !still.has(item.id)).map((item) => ({ ...item }));
  }
}
