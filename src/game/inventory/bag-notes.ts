// The run log's lines for what the inventory did, read off the bag commit it sends: items dropped, used, and taken
// from a container. Pickups from the ground are logged from their own event (event-log.ts).

import type { BagCommit } from '../../../shared/bag.ts';
import type { LogLine } from '../event-log.ts';
import { formatItemName } from './dual-loot-modal.ts';
import { heldActionVerb } from './held-actions.ts';

/** The past tense of the USE button's verb. */
const DONE: Readonly<Record<string, string>> = { LOAD: 'LOADED', EAT: 'ATE', DRINK: 'DRANK', APPLY: 'APPLIED', TAKE: 'TOOK', HEAL: 'HEALED WITH', USE: 'USED' };

function name(type: string, count: number): string {
  const label = formatItemName(type).toUpperCase();
  return count > 1 ? `${count} ${label}` : label;
}

/** One loot line per kind of thing dropped, used or taken, in that order. */
export function bagLines(commit: BagCommit): readonly LogLine[] {
  const dropped = commit.drop.map((row): LogLine => ({ text: `DROPPED ${name(row.type, row.count)}`, tone: 'plain', kind: 'loot' }));
  const used = (commit.use ?? []).map((row): LogLine => ({ text: `${DONE[heldActionVerb(row.type)] ?? 'USED'} ${name(row.type, row.count)}`, tone: 'plain', kind: 'loot' }));
  const takenCounts = new Map<string, number>();
  for (const item of commit.container?.taken ?? []) takenCounts.set(item.type, (takenCounts.get(item.type) ?? 0) + (item.count ?? 1));
  const taken = [...takenCounts].map(([type, count]): LogLine => ({ text: `+${count} ${formatItemName(type).toUpperCase()}`, detail: 'FROM A CONTAINER', tone: 'plain', kind: 'loot' }));
  return [...dropped, ...used, ...taken];
}
