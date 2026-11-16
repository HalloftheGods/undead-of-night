import type { SfxName } from '../../audio/sfx-registry.ts';
import type { ArtBook } from '../../art/types.ts';
import { findItemAtTile, getItemFootprint, type InventoryGrid } from '../../../shared/grid-inventory.ts';
import { heldAnchor, itemPlateAt, layoutLootUi, lootHitAt, TILE, type LootHit, type LootLayout } from '../../engine/loot-ui.ts';
import type { MoveTo } from '../../../shared/item-move.ts';
import type { CellOrigin, MotionKind } from './move-motion.ts';
import { cellFrom, findShown, GROUND_TARGET, groundTargetAt, placedAt, sourceOf, USE_TARGET, windowMove, type ProposedMove } from './loot-moves.ts';
import { careTargetAt } from './care-hover.ts';
import { heldButtonAt, heldOnSurvivor, setHeld, setHeldBare } from '../held-cursor.ts';
import { setLootWindow, type LootWindow } from '../loot-view.ts';
import { isLootPadInCharge, moveCursor, setLootPad, settleCursor, startCursor, type LootButton, type LootCursor, type LootDirection } from './loot-pad.ts';
import { itemBlurb } from './item-blurb.ts';
import { heldActions, isLoadable, type HeldActionKind } from './held-actions.ts';
import { useSoundOf } from './use-sound.ts';
import { formatItemName } from './dual-loot-modal.ts';
import {
  createDualLootState,
  pickUpItemFromGear,
  pickUpItemFromGrid,
  placeHeldItemInGear,
  placeHeldItemInGrid,
  quickTransferBetweenInventories,
  resolveGridById,
  returnHeldItemToSource,
  rotateActiveItem,
  type DualLootModalProps,
  type DualLootState,
  type GridIdentifier,
} from './dual-loot-modal.ts';
import type { GridItem } from '../../../shared/grid-inventory.ts';
import type { InventoryPanel } from './inventory-modal.ts';

/** What the loot window hands back to the inventory, the same things the Vue modal emits. */
export interface CanvasLootHost {
  close: () => void;
  /** One item moved, used or dropped, as it happens (loot-moves.ts). */
  move: (move: ProposedMove, motion: MotionKind, origin: CellOrigin | null) => void;
  playSfx: (name: SfxName) => void;
}

export interface CanvasLoot extends InventoryPanel {
  /** Stops listening and takes the window off the canvas. */
  dispose: () => void;
}

/** A second click on the same item inside this long is a double click. */
const DOUBLE_CLICK_MS = 400;

/**
 * The loot window drawn on the game canvas (engine/loot-ui.ts), driven by the same state functions and the
 * same rules as the Vue modal. It answers the pointer and the keys itself, and hands the item in hand to the
 * canvas drawer the way the modal does, so the USE and DROP buttons work as they always have.
 */
export function createCanvasLoot(canvas: HTMLCanvasElement, art: ArtBook | null, props: DualLootModalProps, host: CanvasLootHost): CanvasLoot {
  const state: DualLootState = createDualLootState(props);
  const window_: LootWindow = { state, art, containerArt: props.containerArt ?? null, hover: null, pointer: null };
  let lastItemClick: { id: string; time: number } | null = null;

  function layout(): LootLayout {
    return layoutLootUi(state, canvas.width, canvas.height);
  }

  /** Buffer pixels under a client point. The canvas is as many pixels as the game draws, scaled up by CSS. */
  function bufferPoint(event: Pick<MouseEvent, 'clientX' | 'clientY'>): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    return { x: ((event.clientX - rect.left) * canvas.width) / rect.width, y: ((event.clientY - rect.top) * canvas.height) / rect.height };
  }

  /** What the pointer is over. An item in hand lands by its first cell, which hangs half a tile from its top left. */
  function hitFor(point: { x: number; y: number }): LootHit | null {
    const l = layout();
    const raw = lootHitAt(l, point.x, point.y);
    const held = state.heldItem;
    const isOverNonCell = raw !== null && raw.kind !== 'cell';
    const isNothingHeld = !held;
    const shouldKeepRaw = isNothingHeld || isOverNonCell;
    if (shouldKeepRaw) return raw;
    const anchor = heldAnchor(held.item, point);
    const landing = lootHitAt(l, anchor.x, anchor.y);
    const landsOnCell = landing !== null && landing.kind === 'cell';
    return landsOnCell ? landing : raw;
  }

  function overDock(point: { x: number; y: number }): boolean {
    const l = layout();
    const docks = [
      l.container,
      l.survivor,
      l.pack ? { x: l.pack.x - 2, y: l.pack.y - 10, w: l.pack.w + 4, h: l.pack.h + 12 } : null,
      l.pockets ? { x: l.pockets.x - 2, y: l.pockets.y - 10, w: l.pockets.w + 4, h: l.pockets.h + 12 } : null,
      l.candy ? { x: l.candy.x - 2, y: l.candy.y - 10, w: l.candy.w + 4, h: l.candy.h + 12 } : null,
      ...l.gear,
      ...l.buttons,
    ];
    return docks.some((d) => d !== null && point.x >= d.x && point.x < d.x + d.w && point.y >= d.y && point.y < d.y + d.h);
  }

  /** The client point is on the window's panels, grids or docks: there a click is the window's, never a shot. */
  function onUi(clientX: number, clientY: number): boolean {
    const point = bufferPoint({ clientX, clientY });
    return hitFor(point) !== null || overDock(point);
  }

  function gridOf(id: GridIdentifier): InventoryGrid {
    return resolveGridById(state, id);
  }

  function syncHeld(): void {
    const held = state.heldItem;
    if (!held) {
      setHeld(null);
      return;
    }
    const { item } = held;
    // The loot window draws the item in hand at the size the grid shows it, so the hand drawer keeps to the words and buttons.
    setHeld({ sprite: null, name: formatItemName(item.type), hint: itemBlurb(item.type), actions: heldActions(item), type: item.type, itemId: item.id });
    setHeldBare((clientX, clientY) => !onUi(clientX, clientY));
  }

  /** Hands the inventory what the hand just did. The hand drawer is told first, so the grids refill around the right item. */
  function sendMove(item: GridItem, from: ReturnType<typeof sourceOf>, motion: MotionKind, origin: CellOrigin | null = null): void {
    syncHeld();
    const move = windowMove(item, from, placedAt(state, item.id));
    if (move) host.move(move, motion, origin);
  }

  /** Where an item is drawn now, in buffer pixels, for a flight back or a puff. */
  function itemOrigin(itemId: string): CellOrigin | null {
    const shown = findShown(state, itemId);
    const plate = shown ? itemPlateAt(layout(), shown.gridId, shown.item) : null;
    return plate ? { buffer: plate } : null;
  }

  /** The cell the item in hand was lifted from, in buffer pixels (it is out of its grid while held, so it is rebuilt from where it sat). */
  function heldPlate(held: NonNullable<typeof state.heldItem>): ReturnType<typeof itemPlateAt> {
    const { source } = held;
    const isLiftedFromGrid = source.kind === 'grid';
    if (!isLiftedFromGrid) return null;
    return itemPlateAt(layout(), source.gridId, { ...held.item, x: source.x, y: source.y, rotated: held.originalRotated });
  }

  function place(gridId: GridIdentifier, col: number, row: number): boolean {
    const held = state.heldItem;
    if (!held) return false;
    // Lifted from another grid (the container, say): it hops over from the cell it left. Within one grid it only lands.
    const heldSource = held.source;
    const isFromGrid = heldSource.kind === 'grid';
    const crosses = isFromGrid && heldSource.gridId !== gridId;
    const plate = crosses ? heldPlate(held) : null;
    const placed = placeHeldItemInGrid(state, gridId, col, row);
    if (placed) {
      sendMove(held.item, sourceOf(held.source), plate ? 'fly' : 'land', plate ? { buffer: plate } : null);
      host.playSfx('ui_place');
    }
    return placed;
  }

  function quickTransfer(gridId: GridIdentifier, itemId: string): void {
    // A double click sends it across: it flies from the cell it is leaving. The first click already lifted it, so that cell is where the hand got it.
    const leaving = gridOf(gridId).items.find((item) => item.id === itemId);
    const held = state.heldItem;
    const heldOnlyPlate = held ? heldPlate(held) : null;
    const plate = leaving ? itemPlateAt(layout(), gridId, leaving) : heldOnlyPlate;
    const moving = leaving ?? held?.item ?? null;
    const heldFrom = held ? sourceOf(held.source) : null;
    const from = leaving ? cellFrom(gridId, leaving) : heldFrom;
    const didTransfer = quickTransferBetweenInventories(state, gridId, itemId);
    if (!didTransfer) return;
    host.playSfx('ui_place');
    const canSendMove = moving && from;
    if (canSendMove) sendMove(moving, from, plate ? 'fly' : 'land', plate ? { buffer: plate } : null);
  }

  function onCell(hit: Extract<LootHit, { kind: 'cell' }>): void {
    const held = state.heldItem;
    const grid = gridOf(hit.gridId);
    const under = findItemAtTile(grid, hit.col, hit.row);
    const now = Date.now();
    if (held) {
      const heldSource = held.source;
      const isFromThisGrid = heldSource.kind === 'grid' && heldSource.gridId === hit.gridId;
      const origin = isFromThisGrid ? heldSource : null;
      const ghost = origin ? getItemFootprint(held.item.type, held.originalRotated) : null;
      const isInsideOriginSpan = origin !== null && ghost !== null && hit.col >= origin.x && hit.col < origin.x + ghost.width && hit.row >= origin.y && hit.row < origin.y + ghost.height;
      const onOwnSpot = isInsideOriginSpan;
      const lastClick = lastItemClick;
      const isSameItemClick = lastClick !== null && lastClick.id === held.item.id;
      const second = isSameItemClick && now - lastClick.time < DOUBLE_CLICK_MS;
      const isDoubleClickOnOwnSpot = onOwnSpot && second;
      if (isDoubleClickOnOwnSpot) {
        quickTransfer(hit.gridId, held.item.id);
        lastItemClick = null;
        return;
      }
      if (onOwnSpot) {
        returnHeldItemToSource(state);
        return;
      }
      // An item under the pointer is landed on by its first cell, the way the page version does, so a swap works.
      place(hit.gridId, under ? under.x : hit.col, under ? under.y : hit.row);
      return;
    }
    if (!under) return;
    lastItemClick = { id: under.id, time: now };
    const didPickUp = pickUpItemFromGrid(state, hit.gridId, under.id);
    if (didPickUp) host.playSfx('ui_pickup');
  }

  function onGear(slot: Extract<LootHit, { kind: 'gear' }>['slot']): void {
    const held = state.heldItem;
    if (held) {
      const didPlaceInGear = placeHeldItemInGear(state, slot);
      if (didPlaceInGear) sendMove(held.item, sourceOf(held.source), 'land');
      return;
    }
    const isSlotFilled = state.gear[slot] !== null;
    if (isSlotFilled) pickUpItemFromGear(state, slot);
  }

  function useHeld(): void {
    const held = state.heldItem;
    if (!held) return;
    const item = { ...held.item };
    const from = sourceOf(held.source);
    // A box of rounds is loaded, not spent: it goes back where it was.
    if (isLoadable(item)) returnHeldItemToSource(state);
    else state.heldItem = null;
    syncHeld();
    const move = windowMove(item, from, USE_TARGET);
    if (move) host.move(move, 'land', null);
  }

  function dropHeld(to: MoveTo = GROUND_TARGET): void {
    const held = state.heldItem;
    if (!held) return;
    state.heldItem = null;
    syncHeld();
    const move = windowMove(held.item, sourceOf(held.source), to);
    if (move) host.move(move, 'land', null);
  }

  function rotate(): void {
    const held = state.heldItem;
    const isHeldLoadable = held && isLoadable(held.item);
    if (isHeldLoadable) {
      host.playSfx(useSoundOf(held.item.type));
      useHeld();
      syncHeld();
      return;
    }
    const didRotate = rotateActiveItem(state);
    if (didRotate) host.playSfx('ui_rotate');
    syncHeld();
  }

  function escape(): void {
    if (state.heldItem) {
      returnHeldItemToSource(state);
      syncHeld();
      return;
    }
    host.close();
  }

  function settle(): void {
    if (state.heldItem) returnHeldItemToSource(state);
    syncHeld();
  }

  /** Uses or drops the item in hand, with its sound, if it allows that. True when something happened. */
  function actOnHeld(kind: HeldActionKind | null, to: MoveTo = GROUND_TARGET): boolean {
    const held = state.heldItem;
    const hasNoAction = !held || kind === null;
    if (hasNoAction) return false;
    const allowed = heldActions(held.item).some((a) => a.kind === kind);
    if (!allowed) return false;
    const isUse = kind === 'use';
    if (isUse) {
      host.playSfx(useSoundOf(held.item.type));
      useHeld();
    } else {
      host.playSfx('ui_drop');
      dropHeld(to);
    }
    return true;
  }

  /** A click on a hand button does what it says; one on the bare game drops the item, or uses it on the survivor. */
  function heldClick(event: MouseEvent, point: { x: number; y: number }): boolean {
    if (!state.heldItem) return false;
    const onButton = heldButtonAt(event.clientX, event.clientY);
    const bare = hitFor(point) === null && !overDock(point);
    const careTo = careTargetAt(event.clientX, event.clientY);
    const onGame: HeldActionKind = heldOnSurvivor(event.clientX, event.clientY) ? 'use' : 'drop';
    const kind = onButton ?? (bare ? onGame : null);
    // A teammate under the item, in reach and helped by it, is handed it instead of the item being dropped.
    const isHandingToTeammate = careTo && kind === 'drop';
    const to = isHandingToTeammate ? careTo : groundTargetAt(event.clientX, event.clientY);
    const didAct = actOnHeld(kind, to);
    return didAct || onButton !== null;
  }

  /**
   * The last press was the window's: on its UI, or with an item in hand. A shot pressed on the game and let go over
   * a cell still clicks the canvas, so the click only counts when its press did too.
   */
  let pressOwned = false;
  function onPress(event: MouseEvent): void {
    const isPressOnWindow = state.heldItem !== null || onUi(event.clientX, event.clientY);
    pressOwned = event.target === canvas && isPressOnWindow;
  }

  function onClick(event: MouseEvent): void {
    const isClickNotOwned = event.target !== canvas || !pressOwned;
    if (isClickNotOwned) return;
    const point = bufferPoint(event);
    const wasHeldClick = heldClick(event, point);
    if (wasHeldClick) {
      syncHeld();
      return;
    }
    const hit = hitFor(point);
    if (hit?.kind === 'button') {
      const isCloseButton = hit.id === 'close';
      if (isCloseButton) {
        if (state.heldItem) returnHeldItemToSource(state);
        host.close();
      } else rotate();
    } else if (hit?.kind === 'gear') onGear(hit.slot);
    else if (hit?.kind === 'cell') onCell(hit);
    syncHeld();
  }

  function onDoubleClick(event: MouseEvent): void {
    const isClickNotOwned = event.target !== canvas || !pressOwned;
    if (isClickNotOwned) return;
    const hit = hitFor(bufferPoint(event));
    const isNotOverCell = !hit || hit.kind !== 'cell';
    if (isNotOverCell) return;
    const held = state.heldItem;
    const itemId = held ? held.item.id : findItemAtTile(gridOf(hit.gridId), hit.col, hit.row)?.id;
    if (!itemId) return;
    const heldSource = held ? held.source : null;
    const isHeldFromGrid = heldSource !== null && heldSource.kind === 'grid';
    const gridId = isHeldFromGrid ? heldSource.gridId : hit.gridId;
    quickTransfer(gridId, itemId);
    lastItemClick = null;
    syncHeld();
  }

  function onMove(event: MouseEvent): void {
    const isOutsideCanvas = event.target !== canvas;
    if (isOutsideCanvas) {
      window_.pointer = null;
      window_.hover = null;
      canvas.style.cursor = '';
      return;
    }
    // Over the game the crosshair is the cursor; over the window the OS cursor shows, as it does on the page modal.
    canvas.style.cursor = onUi(event.clientX, event.clientY) ? 'default' : '';
    const point = bufferPoint(event);
    window_.pointer = point;
    window_.hover = hitFor(point);
  }


  /** The controller's highlight. It shows as the pointer's hover does, and an item in hand rides it. */
  let cursor: LootCursor | null = null;

  function showCursor(): void {
    if (!cursor) return;
    const at = cursor;
    window_.hover = { kind: 'cell', gridId: at.gridId, col: at.col, row: at.row };
    const held = state.heldItem;
    const l = layout();
    const board = [l.container?.board, l.pack, l.pockets, l.candy].find((each) => each?.id === at.gridId);
    const hasNoHeldOrBoard = !held || !board;
    if (hasNoHeldOrBoard) return;
    const dims = getItemFootprint(held.item.type, held.item.rotated);
    window_.pointer = {
      x: board.x + at.col * TILE + 1 + (dims.width * TILE - 2) / 2,
      y: board.y + at.row * TILE + 1 + (dims.height * TILE - 2) / 2,
    };
  }

  function padMove(direction: LootDirection): boolean {
    // The first push only shows the highlight, so a player is never moved off the item they meant.
    cursor = cursor ? moveCursor(cursor, direction, gridOf) ?? cursor : startCursor(gridOf);
    showCursor();
    return true;
  }

  /** A takes the item under the highlight across, or sets a held one down; X lifts it to move it; Y turns it. */
  function padPress(button: LootButton): boolean {
    const isBack = button === 'b';
    if (isBack) return false;
    const isTrigger = button === 'rt' || button === 'lt';
    // With the hand empty the triggers are the game's (fire and shove), so they leave the highlight unlit.
    const isTriggerWithEmptyHand = isTrigger && !state.heldItem;
    if (isTriggerWithEmptyHand) return false;
    cursor = cursor ?? startCursor(gridOf);
    if (isTrigger) {
      // RT feeds the item in hand to the survivor, LT drops it: the pad's USE and DROP buttons.
      const acted = actOnHeld(button === 'rt' ? 'use' : 'drop');
      if (acted) cursor = settleCursor(cursor, gridOf);
      syncHeld();
      showCursor();
      return acted;
    }
    const isRotate = button === 'y';
    if (isRotate) {
      rotate();
      showCursor();
      return true;
    }
    const at = cursor;
    const under = findItemAtTile(gridOf(at.gridId), at.col, at.row);
    const isLiftPress = under && button === 'x';
    if (state.heldItem) onCell({ kind: 'cell', gridId: at.gridId, col: at.col, row: at.row });
    else if (isLiftPress) onCell({ kind: 'cell', gridId: at.gridId, col: at.col, row: at.row });
    else if (under) quickTransfer(at.gridId, under.id);
    if (!state.heldItem) cursor = settleCursor(at, gridOf);
    syncHeld();
    showCursor();
    return true;
  }

  window.addEventListener('mousemove', onMove);
  window.addEventListener('mousedown', onPress, true);
  window.addEventListener('click', onClick);
  window.addEventListener('dblclick', onDoubleClick);
  setLootWindow(window_);
  setLootPad({ move: padMove, press: padPress });
  if (isLootPadInCharge()) {
    cursor = startCursor(gridOf);
    showCursor();
  }
  syncHeld();

  return {
    escape,
    rotate,
    settle,
    ownsPoint: onUi,
    itemOrigin,
    dispose() {
      canvas.style.cursor = '';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mousedown', onPress, true);
      window.removeEventListener('click', onClick);
      window.removeEventListener('dblclick', onDoubleClick);
      setLootWindow(null);
      setLootPad(null);
      setHeld(null);
    },
  };
}
