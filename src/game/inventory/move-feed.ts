// What each snapshot tells an open loot window about item moves: the host's answers to this survivor's moves, the
// contents of the containers someone has open, and the world pickups that just went into the bag. The snapshot
// handler feeds it; the inventory's move ledger (use-move-ledger.ts) reads it. Plain module state, not reactive.

import type { GameEvent, SnapshotPacket } from '../../../shared/protocol.ts';
import type { GridItem } from '../../../shared/grid-inventory.ts';
import { noteMotion } from './move-motion.ts';

export interface MoveAnswer {
  readonly moveId: number;
  readonly ok: boolean;
}

type Viewed = NonNullable<SnapshotPacket['viewedContainers']>;

let viewed: Viewed = [];
const listeners = new Set<(answer: MoveAnswer) => void>();

/** The containers someone has open, from the latest snapshot. */
export function noteViewedContainers(next: Viewed | undefined): void {
  viewed = next ?? [];
}

/** What the host has in this container, or null when the latest snapshot did not carry it. */
export function viewedItems(id: number): readonly GridItem[] | null {
  return viewed.find((entry) => entry.id === id)?.items ?? null;
}

/** Hears every answer to this survivor's moves. Returns the call that stops listening. */
export function onMoveAnswer(listener: (answer: MoveAnswer) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** One snapshot event: an answer to one of this survivor's moves goes to the ledger, a pickup into the bag flies in. */
export function noteMoveEvent(event: GameEvent, localId: string): void {
  const isAnswer = event.type === 'move_ok' || event.type === 'move_no';
  if (isAnswer && event.playerId === localId) {
    const answer: MoveAnswer = { moveId: event.moveId, ok: event.type === 'move_ok' };
    for (const listener of listeners) listener(answer);
    return;
  }
  const isArrival = event.type === 'item_in' && event.playerId === localId;
  if (isArrival) noteMotion({ itemId: event.itemId, itemType: event.itemType, kind: 'fly', from: { world: { x: event.x, y: event.y } }, to: null });
}
