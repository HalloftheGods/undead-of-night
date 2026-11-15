import { heldInfo } from '../held-cursor.ts';

/**
 * One source of truth for whether the open inventory owns the pointer, the keys or the pad right now. The
 * game stays live while the inventory is up: the input manager asks here before a click fires or the wheel
 * cycles a gun, and the frame asks before it draws the crosshair. Plain state, not reactive, like held-cursor.
 */
export interface InventoryHands {
  /** The client point is on the open window's own UI: a panel, a grid, a gear slot or a button. */
  ownsPoint(clientX: number, clientY: number): boolean;
  /** The window shares the pad: false mid-search, when every button stays the game's so the search keeps counting. */
  sharesPad?(): boolean;
}

let hands: InventoryHands | null = null;

/** The inventory window registers itself on every opening and passes null when it goes. */
export function setInventoryHands(next: InventoryHands | null): void {
  hands = next;
}

/** A loot window is up over the live game. */
export function inventoryUp(): boolean {
  return hands !== null;
}

/** A loot window is up and takes the pad's face buttons and D-pad. A search window leaves the whole pad to the game. */
export function inventoryPadShared(): boolean {
  return hands !== null && (hands.sharesPad?.() ?? true);
}

/** An item is in hand. Only while the inventory is up, so a hand left stale by a close never counts. */
export function inventoryHolding(): boolean {
  return hands !== null && heldInfo() !== null;
}

/** The pointer is on the inventory's own UI: the player is choosing, not aiming. */
export function inventoryChoosing(clientX: number, clientY: number): boolean {
  return hands?.ownsPoint(clientX, clientY) ?? false;
}

/** A press here belongs to the inventory: it is on the inventory's UI, or an item is in hand. */
export function inventoryOwnsPointer(clientX: number, clientY: number): boolean {
  return inventoryHolding() || inventoryChoosing(clientX, clientY);
}

/** The page element under a client point is inside this root. Gaps the root lets clicks through hit the game. */
export function elementOwnsPoint(root: Element | null, clientX: number, clientY: number): boolean {
  const canAsk = root !== null && typeof document !== 'undefined' && typeof document.elementFromPoint === 'function';
  if (!canAsk) return false;
  const hit = document.elementFromPoint(clientX, clientY);
  return hit !== null && root.contains(hit);
}
