import { findItemAtTile, getItemFootprint, isCellBlocked } from '../../../shared/grid-inventory.ts';
import type { GridItem, InventoryGrid } from '../../../shared/grid-inventory.ts';
import type { GridIdentifier } from './dual-loot-modal.ts';

/** Where the pad's highlight sits: one cell of one grid. */
export interface LootCursor {
  readonly gridId: GridIdentifier;
  readonly col: number;
  readonly row: number;
}

export type LootDirection = 'up' | 'down' | 'left' | 'right';

/** The pad buttons a loot screen takes for itself: A takes or sets down, X lifts, Y turns. */
export type LootButton = 'a' | 'b' | 'x' | 'y' | 'start';

/** What the open loot screen answers to. One at a time: the screen on top. */
export interface LootPadTarget {
  move(direction: LootDirection): boolean;
  press(button: LootButton): boolean;
}

let target: LootPadTarget | null = null;

/** The screen takes the pad while it is up; pass null when it goes. */
export function setLootPad(next: LootPadTarget | null): void {
  target = next;
}

let padInCharge: () => boolean = () => false;

/** The input manager says whether a pad was the last hand on the game, so a screen opening knows to light a cursor. */
export function setLootPadDevice(inCharge: () => boolean): void {
  padInCharge = inCharge;
}

export function isLootPadInCharge(): boolean {
  return padInCharge();
}

export function lootPadMove(direction: LootDirection): boolean {
  return target?.move(direction) ?? false;
}

export function lootPadPress(button: LootButton): boolean {
  return target?.press(button) ?? false;
}

/** The grids as they sit on the screen: where a push off one grid's edge lands. */
const NEIGHBOURS: Record<GridIdentifier, Partial<Record<LootDirection, GridIdentifier>>> = {
  container: { right: 'pockets' },
  pockets: { left: 'container', right: 'candyBag', down: 'backpack' },
  candyBag: { left: 'pockets', down: 'backpack' },
  backpack: { left: 'container', up: 'pockets' },
};

const STEP: Record<LootDirection, { col: number; row: number }> = {
  up: { col: 0, row: -1 },
  down: { col: 0, row: 1 },
  left: { col: -1, row: 0 },
  right: { col: 1, row: 0 },
};

type GridOf = (id: GridIdentifier) => InventoryGrid;

/** The top-left cell of an item: what a cursor over any part of it settles on. */
export function anchorOf(grid: InventoryGrid, col: number, row: number): { col: number; row: number } {
  const item = findItemAtTile(grid, col, row);
  return item ? { col: item.x, row: item.y } : { col, row };
}

/** Where a push goes: the next cell, or the neighbouring grid at the same height or width, or nowhere. */
export function moveCursor(cursor: LootCursor, direction: LootDirection, gridOf: GridOf): LootCursor | null {
  const grid = gridOf(cursor.gridId);
  const step = STEP[direction];
  // A big item is one stop: leave from the edge of it, not from its corner.
  const item = findItemAtTile(grid, cursor.col, cursor.row);
  const edge = item ? stepPast(item, direction, cursor) : { col: cursor.col, row: cursor.row };
  let col = edge.col + step.col;
  let row = edge.row + step.row;
  const inside = () => col >= 0 && row >= 0 && col < grid.cols && row < grid.rows;
  while (inside() && isCellBlocked(grid, col, row)) {
    col += step.col;
    row += step.row;
  }
  if (inside()) return { gridId: cursor.gridId, ...anchorOf(grid, col, row) };
  const next = NEIGHBOURS[cursor.gridId][direction];
  if (!next) return null;
  const to = gridOf(next);
  if (to.cols === 0 || to.rows === 0) return null;
  const across = step.col !== 0;
  const fraction = across ? (cursor.row + 0.5) / grid.rows : (cursor.col + 0.5) / grid.cols;
  const entry = (size: number) => Math.min(size - 1, Math.floor(fraction * size));
  const landCol = across ? (step.col > 0 ? 0 : to.cols - 1) : entry(to.cols);
  const landRow = across ? entry(to.rows) : step.row > 0 ? 0 : to.rows - 1;
  return { gridId: next, ...anchorOf(to, landCol, landRow) };
}

/** The cell of the item that a push in this direction leaves from: its far edge, so a big item is one stop. */
function stepPast(item: GridItem, direction: LootDirection, at: { col: number; row: number }): { col: number; row: number } {
  const { width: w, height: h } = getItemFootprint(item.type, item.rotated);
  if (direction === 'right') return { col: item.x + w - 1, row: at.row };
  if (direction === 'down') return { col: at.col, row: item.y + h - 1 };
  if (direction === 'left') return { col: item.x, row: at.row };
  return { col: at.col, row: item.y };
}

/** The cell to start on when a screen opens: the first item of the container, else of the bag, else the corner. */
export function startCursor(gridOf: GridOf): LootCursor {
  for (const gridId of ['container', 'backpack', 'pockets', 'candyBag'] as const) {
    const first = firstItem(gridOf(gridId));
    if (first) return { gridId, col: first.x, row: first.y };
  }
  return { gridId: 'container', col: 0, row: 0 };
}

/** The item nearest the top-left that sits in the grid, reading left to right, top to bottom. */
function firstItem(grid: InventoryGrid): GridItem | null {
  let best: GridItem | null = null;
  for (const item of grid.items) {
    if (best === null || item.y < best.y || (item.y === best.y && item.x < best.x)) best = item;
  }
  return best;
}

/** After an item leaves: the nearest item left in that grid, or the same cell if it is empty now. */
export function settleCursor(cursor: LootCursor, gridOf: GridOf): LootCursor {
  const grid = gridOf(cursor.gridId);
  if (findItemAtTile(grid, cursor.col, cursor.row)) return cursor;
  let best: GridItem | null = null;
  let bestDistance = Infinity;
  for (const item of grid.items) {
    const distance = Math.abs(item.x - cursor.col) + Math.abs(item.y - cursor.row);
    if (distance < bestDistance) {
      best = item;
      bestDistance = distance;
    }
  }
  return best ? { gridId: cursor.gridId, col: best.x, row: best.y } : cursor;
}

const ARROW_CODE: Record<LootDirection, string> = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };

/** A key press that is the pad's, marked so the input manager does not take it for the keyboard coming back. */
function padKey(code: string): void {
  if (typeof document === 'undefined') return;
  const event = new KeyboardEvent('keydown', { code, key: code, bubbles: true, cancelable: true });
  Object.defineProperty(event, 'fromPad', { value: true });
  (document.body ?? document).dispatchEvent(event);
}

export function isPadKey(event: Event): boolean {
  return (event as { fromPad?: boolean }).fromPad === true;
}

/**
 * For a screen drawn on the canvas that already answers the arrow keys, Enter and Escape: the D-pad is the arrows,
 * A is Enter and B is Escape. Nothing on those screens is focused until the first push, so A before that focuses first. Start, if the screen gives a way, presses its main button.
 */
export function keyBridgePad(start?: () => boolean): LootPadTarget {
  let focused = false;
  return {
    move(direction) {
      focused = true;
      padKey(ARROW_CODE[direction]);
      return true;
    },
    press(button) {
      if (button === 'start') return start?.() ?? false;
      if (button === 'b') {
        padKey('Escape');
        return true;
      }
      if (button !== 'a') return false;
      if (!focused) {
        focused = true;
        padKey('ArrowDown');
        return true;
      }
      padKey('Enter');
      return true;
    },
  };
}
