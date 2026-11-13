// The candy bag, as the candy bag screen and the backpack show it: one stack per kind carried.
// The sim keeps the bag as a list (shared/candy.ts) and snapshots send it counted by kind.

import { CANDIES, CANDY_ORDER } from '@shared/candy.ts';
import type { CandyBag, CandyId } from '@shared/candy.ts';
import type { SugarView } from '@shared/protocol.ts';

/** One kind of candy in the bag. */
export interface CandyStack {
  readonly id: CandyId;
  readonly name: string;
  /** The stat it boosts, in a word. */
  readonly stat: string;
  readonly blurb: string;
  readonly count: number;
  /** Whole seconds its boost has left, 0 when it is not working: eating another adds to it. */
  readonly left: number;
}

/**
 * The bag as the candy bag screen lays it out: every kind carried, in the order the game lists
 * candy, so a kind keeps its place however the bag fills. A kind the client does not know is left out.
 */
export function candyBag(bag: CandyBag | undefined, sugar: readonly SugarView[] | undefined): CandyStack[] {
  const stacks: CandyStack[] = [];
  for (const id of CANDY_ORDER) {
    const count = bag?.[id] ?? 0;
    const notCarried = count <= 0;
    if (notCarried) continue;
    const working = sugar?.find((each) => each.id === id);
    const { name, stat, blurb } = CANDIES[id];
    stacks.push({ id, name, stat, blurb, count, left: working ? Math.ceil(working.left) : 0 });
  }
  return stacks;
}
