import type { ArtBook } from '../art/types.ts';
import type { ContainerArt } from '../art/containers.ts';
import type { LootHit } from '../engine/loot-ui.ts';
import type { DualLootState } from './inventory/dual-loot-modal.ts';

/**
 * The loot window as the frame should draw it, when it is drawn on the game canvas. The inventory sets and
 * clears it; the renderer reads it each draw (engine/loot-ui.ts). Plain state, not reactive, like held-cursor.
 */
export interface LootWindow {
  readonly state: DualLootState;
  readonly art: ArtBook | null;
  readonly containerArt: ContainerArt | null;
  hover: LootHit | null;
  /** The pointer in buffer pixels, or null when it is off the canvas. */
  pointer: { x: number; y: number } | null;
}

let current: LootWindow | null = null;

export function setLootWindow(window: LootWindow | null): void {
  current = window;
}

export function lootWindow(): LootWindow | null {
  return current;
}
