import { onScopeDispose, shallowRef } from 'vue';
import type { ContainerArt } from '../../art/containers.ts';
import { flipDimensions, flipItem } from '../../../shared/container-flip.ts';
import { containerGridDimensions, type ContainerKind } from '../../../shared/containers.ts';
import { createInventoryGrid, type GridItem, type InventoryGrid } from '../../../shared/grid-inventory.ts';
import type { ItemMove, MoveFrom, MoveTo } from '../../../shared/item-move.ts';
import type { ProposedMove } from './loot-moves.ts';
import type { MoveGrids } from '../../../shared/item-move-grids.ts';
import type { HudState } from '../hud-state.ts';
import { heldInfo } from '../held-cursor.ts';
import { wornGear, type BagWorking } from './bag-working.ts';
import { MoveLedger, type LedgerChange, type LedgerView } from './move-ledger.ts';
import { onMoveAnswer, viewedItems } from './move-feed.ts';
import { cellKey, clearMotions, motionTick, noteMotion, noteShake, nowMs, renameMotion, type CellOrigin, type MotionKind } from './move-motion.ts';

/** A move as a window proposes it: no id yet, and container cells as the window draws them (maybe flipped). */
export type { ProposedMove };

/** How often unanswered moves are checked against the timeout. */
const EXPIRE_CHECK_MS = 250;

/** What a window was opened on: nothing for the bag alone, or the container it searches. */
export interface OpenedGrid {
  readonly containerId: number | null;
  readonly title: string;
  /** The container's items when the window opened, in the host's cells, until a snapshot carries its contents. */
  readonly items: readonly GridItem[];
  readonly kind?: ContainerKind;
  readonly art?: ContainerArt | null;
  /** Shown on its side: a car parked nose up. */
  readonly flipped?: boolean;
  /** The look it is drawn with, which may have its own grid. */
  readonly look?: string;
}

/** Where an item now sits on screen, from the open window, so a flight back or a puff starts there. */
export type ItemOrigin = (itemId: string) => CellOrigin | null;

type Carried = Pick<HudState, 'backpackTier' | 'bagLayout' | 'lastMoveId' | 'bag' | 'owned' | 'weapon' | 'mags' | 'ammoBag'>;

/** The window's container cells turned back to the host's when the window shows it on its side. A flip is its own undo. */
function hostEnd<T extends MoveFrom | MoveTo>(end: T, flipped: boolean, type: string): T {
  if (!flipped || end.kind !== 'cell' || end.grid !== 'container') return end;
  if (!('rotated' in end)) return { ...end, x: end.y, y: end.x } as T;
  const turned = flipItem({ id: '', type, x: end.x, y: end.y, rotated: end.rotated });
  return { ...end, x: turned.x, y: turned.y, rotated: turned.rotated } as T;
}

const hasItem = (grids: MoveGrids, id: string): boolean => [grids.pack, grids.pockets, grids.candy, grids.container].some((grid) => grid?.items.some((item) => item.id === id) ?? false);

const gearKey = (gear: BagWorking['gear']): string => [gear.primary, gear.secondary, gear.sidearm, gear.armor].map((item) => item?.type ?? '-').join('|');

/**
 * The inventory's move ledger glue. It feeds the ledger every snapshot (the HUD watch calls `confirm`) and every host
 * answer, turns what the ledger undid into flights back, shakes and puffs, and keeps the grids the window draws
 * (`working`) filled in place from the ledger. Windows propose moves with `onMove`.
 */
export function useMoveLedger(send: (move: ItemMove) => void, sendView: (id: number, open: boolean) => void, itemOrigin: () => ItemOrigin | null) {
  const ledger = new MoveLedger(send, nowMs);
  const working = shallowRef<BagWorking | null>(null);
  /** Changes when the window must be rebuilt from `working` (a new opening, a new pack, the guns changed). */
  const openings = shallowRef(0);
  let opened: OpenedGrid | null = null;
  let lastHud: Carried | null = null;

  function viewOf(hud: Carried): LedgerView {
    const id = opened?.containerId ?? null;
    const shape = opened ? containerGridDimensions(opened.kind, opened.look) : null;
    const items = id === null ? null : (viewedItems(id) ?? opened?.items ?? []);
    const container = id !== null && shape && items ? { id, cols: shape.cols, rows: shape.rows, blocked: shape.blocked, items } : null;
    const stacks = (hud.bag ?? []).map((stack) => ({ id: stack.id, count: stack.count }));
    return { tier: hud.backpackTier ?? 'satchel', bag: hud.bagLayout ?? [], lastMoveId: hud.lastMoveId ?? 0, container, candy: stacks, gear: wornGear(hud) };
  }

  /** The grids the window draws, fresh, for a new opening. */
  function display(grid: OpenedGrid, grids: MoveGrids, tier: BagWorking['tier']): BagWorking {
    const shape = containerGridDimensions(grid.kind, grid.look);
    const { cols, rows, blocked } = grid.flipped ? flipDimensions(shape) : shape;
    return {
      tier,
      pack: createInventoryGrid(grids.pack.cols, grids.pack.rows),
      pockets: createInventoryGrid(grids.pockets.cols, grids.pockets.rows),
      candyBag: createInventoryGrid(grids.candy.cols, grids.candy.rows),
      container: createInventoryGrid(cols, rows, blocked),
      gear: { primary: null, secondary: null, sidearm: null, armor: null },
      containerTitle: grid.title,
      containerKind: grid.kind,
      containerId: grid.containerId,
      containerArt: grid.art,
      flipped: grid.flipped === true,
    };
  }

  /** Refills the window's grids in place from the ledger, leaving out the item in hand. */
  function refill(): void {
    const shown = working.value;
    if (!shown || !opened) return;
    const grids = ledger.grids();
    const heldId = heldInfo()?.itemId ?? null;
    const resized = grids.pack.cols !== shown.pack.cols || grids.pack.rows !== shown.pack.rows;
    if (resized) {
      working.value = display(opened, grids, lastHud?.backpackTier ?? shown.tier);
      openings.value += 1;
    }
    const target = working.value!;
    const fill = (into: InventoryGrid, from: InventoryGrid | null, flip: boolean): void => {
      into.items = (from?.items ?? []).filter((item) => item.id !== heldId).map((item) => (flip ? flipItem(item) : { ...item }));
    };
    fill(target.pack, grids.pack, false);
    fill(target.pockets, grids.pockets, false);
    fill(target.candyBag, grids.candy, false);
    if (opened.containerId !== null) fill(target.container, grids.container, target.flipped === true);
    const gearBefore = gearKey(target.gear);
    Object.assign(target.gear, { ...grids.gear });
    // The windows copy the worn guns when they are built: a change they did not make needs a fresh window.
    if (!resized && heldId === null && gearKey(target.gear) !== gearBefore) openings.value += 1;
    motionTick.value += 1;
  }

  /** The cell the move aimed at, as the window draws it, for its shake. */
  function shownTarget(move: ItemMove): string | null {
    const { to } = move;
    if (to.kind !== 'cell') return null;
    const turned = to.grid === 'container' && working.value?.flipped === true;
    return turned ? cellKey(to.grid, to.y, to.x) : cellKey(to.grid, to.x, to.y);
  }

  /** What the ledger undid: a refused move flies back to its source (or puffs if it has none now) and its target shakes. */
  function settle(change: LedgerChange): void {
    for (const [from, to] of change.renamed ?? []) renameMotion(from, to);
    const origin = itemOrigin();
    for (const move of change.rejected) {
      const from = origin?.(move.item) ?? null;
      const kind: MotionKind = hasItem(ledger.grids(), move.item) ? 'back' : 'puff';
      noteMotion({ itemId: move.item, itemType: move.type, kind, from: from ? { cell: from } : null, to: null });
      const key = shownTarget(move);
      if (key) noteShake(key);
    }
    for (const item of change.vanished) {
      const from = origin?.(item.id) ?? null;
      if (from) noteMotion({ itemId: item.id, itemType: item.type, kind: 'puff', from: { cell: from }, to: null });
    }
    refill();
  }

  /** Every snapshot, open or shut: the ledger takes the host's view. */
  function confirm(hud: Carried | null): void {
    lastHud = hud;
    if (!hud) {
      ledger.reset();
      return;
    }
    settle(ledger.confirm(viewOf(hud)));
  }

  /** A window opens on the bag, or on a container: the host is told it is being viewed, and the grids are built. */
  function open(hud: Carried, grid: OpenedGrid): void {
    const before = opened?.containerId ?? null;
    if (before !== null && before !== grid.containerId) sendView(before, false);
    if (grid.containerId !== null && grid.containerId !== before) sendView(grid.containerId, true);
    opened = grid;
    lastHud = hud;
    ledger.confirm(viewOf(hud));
    working.value = display(grid, ledger.grids(), hud.backpackTier ?? 'satchel');
    openings.value += 1;
    refill();
  }

  /** The window shut. Pending moves stay in the ledger and their answers still settle it. */
  function close(): void {
    const id = opened?.containerId ?? null;
    if (id !== null) sendView(id, false);
    opened = null;
    working.value = null;
    clearMotions();
    if (lastHud) ledger.confirm(viewOf(lastHud));
  }

  /**
   * One move from a window, as it happens. `motion` is how it looks: `land` for an item set down by hand, `fly` for
   * one sent across (from `origin`, the cell it left). A move the grids refuse is not sent: the window is refilled and
   * the aimed cell shakes. True when it was sent.
   */
  function onMove(proposed: ProposedMove, motion: MotionKind, origin: CellOrigin | null = null): boolean {
    const shown = working.value;
    if (!shown) return false;
    const flipped = shown.flipped === true;
    const containerId = shown.containerId ?? null;
    const usesContainer = [proposed.from, proposed.to].some((end) => end.kind === 'cell' && end.grid === 'container');
    const move: ProposedMove = {
      ...proposed,
      from: hostEnd(proposed.from, flipped, proposed.type),
      to: hostEnd(proposed.to, flipped, proposed.type),
      ...(usesContainer && containerId !== null ? { container: containerId } : {}),
    };
    const sent = ledger.propose(move);
    if (!sent) {
      const key = proposed.to.kind === 'cell' ? cellKey(proposed.to.grid, proposed.to.x, proposed.to.y) : null;
      if (key) noteShake(key);
      if (proposed.from.kind === 'gear' || proposed.to.kind === 'gear') openings.value += 1;
      refill();
      return false;
    }
    const staysShown = sent.to.kind === 'cell' || sent.to.kind === 'gear';
    if (staysShown) noteMotion({ itemId: sent.item, itemType: sent.type, kind: motion, from: motion === 'fly' && origin ? { cell: origin } : null, to: null });
    refill();
    return true;
  }

  const stopAnswers = onMoveAnswer((answer) => settle(ledger.answer(answer.moveId, answer.ok)));
  const expireTimer = setInterval(() => settle(ledger.expire()), EXPIRE_CHECK_MS);
  onScopeDispose(() => {
    stopAnswers();
    clearInterval(expireTimer);
  });

  return { working, openings, open, close, confirm, onMove };
}
