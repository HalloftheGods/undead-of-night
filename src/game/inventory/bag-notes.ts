// The run log's lines for what the inventory did, read off each item move as it is sent: an item dropped, used, or
// taken from a container. Pickups from the ground are logged from their own event (event-log.ts).

import type { ItemMove } from '../../../shared/item-move.ts';
import type { LogLine } from '../event-log.ts';
import { formatItemName } from './dual-loot-modal.ts';
import { heldActionVerb } from './held-actions.ts';

/** The past tense of the USE button's verb. */
const DONE: Readonly<Record<string, string>> = { LOAD: 'LOADED', EAT: 'ATE', DRINK: 'DRANK', APPLY: 'APPLIED', TAKE: 'TOOK', HEAL: 'HEALED WITH', USE: 'USED' };

const upperName = (type: string): string => formatItemName(type).toUpperCase();

/** The loot line for one move: a drop, a use, or a take from a container. A move inside the bag logs nothing. */
export function moveLines(move: ItemMove): readonly LogLine[] {
  const { from, to, type } = move;
  if (to.kind === 'ground') return [{ text: `DROPPED ${upperName(type)}`, tone: 'plain', kind: 'loot' }];
  if (to.kind === 'use') return [{ text: `${DONE[heldActionVerb(type)] ?? 'USED'} ${upperName(type)}`, tone: 'plain', kind: 'loot' }];
  const fromContainer = from.kind === 'cell' && from.grid === 'container';
  const intoBag = to.kind === 'cell' && to.grid !== 'container';
  if (fromContainer && intoBag) return [{ text: `+1 ${upperName(type)}`, detail: 'FROM A CONTAINER', tone: 'plain', kind: 'loot' }];
  return [];
}
