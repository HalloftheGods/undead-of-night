import type { PixelSprite } from '../art/types.ts';
import type { HeldAction, HeldActionKind } from './inventory/held-actions.ts';

/**
 * The item in the player's hand while the inventory is open. The inventory sets it and clears it; the frame
 * reads it each draw and the canvas paints it (engine/held-ui.ts), then reports back where its buttons landed
 * so the inventory can answer a click. Plain state, not reactive.
 */
export interface HeldInfo {
  readonly sprite: PixelSprite | null;
  readonly name: string;
  readonly hint: string;
  readonly actions: readonly HeldAction[];
}

/** Where a button was drawn, in client pixels. */
export interface HeldButtonBox {
  readonly kind: HeldActionKind;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

let held: HeldInfo | null = null;
let survivor: Omit<HeldButtonBox, 'kind'> | null = null;
let buttons: readonly HeldButtonBox[] = [];

export function setHeld(info: HeldInfo | null): void {
  held = info;
  if (info === null) buttons = [];
}

export function heldInfo(): HeldInfo | null {
  return held;
}

export function setHeldButtons(boxes: readonly HeldButtonBox[]): void {
  buttons = boxes;
}

/** Where the survivor was drawn, in client pixels: an item dropped on them is used. */
export function setHeldSurvivor(box: Omit<HeldButtonBox, 'kind'> | null): void {
  survivor = box;
}

export function heldOnSurvivor(clientX: number, clientY: number): boolean {
  return survivor !== null && clientX >= survivor.x && clientX <= survivor.x + survivor.w && clientY >= survivor.y && clientY <= survivor.y + survivor.h;
}

/** The button under a client point, if any. */
export function heldButtonAt(clientX: number, clientY: number): HeldActionKind | null {
  const hit = buttons.find((b) => clientX >= b.x && clientX <= b.x + b.w && clientY >= b.y && clientY <= b.y + b.h);
  return hit?.kind ?? null;
}
