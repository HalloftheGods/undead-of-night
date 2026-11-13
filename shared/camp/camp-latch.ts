// How big the camp is, decided when the room comes home and held for the whole visit, so nobody joining or leaving moves a fence mid-fight.
// The breach reads the level latched here too (#7547). Camp project 2 replaces `campSizeFor` with "people brought home".

import { MERCHANT_IDS } from '../home-protocol.ts';
import type { MerchantId } from '../home-protocol.ts';
import type { SimState } from '../sim-state.ts';
import { clampCampSize } from './camp-ring.ts';
import type { CampSize } from './camp-ring.ts';

/** The camp grows with the people brought home: 1 to 5. */
export const campSizeFor = (people: number): CampSize => clampCampSize(1 + people);

/** Everyone any player in the room has rescued, in the merchants' order. A player who brought no list (an older client) has met them all. */
export function unionRescued(sim: SimState): MerchantId[] {
  const lists = sim.players.map((p) => p.home?.rescued ?? MERCHANT_IDS);
  return MERCHANT_IDS.filter((id) => lists.some((list) => list.includes(id)));
}

/** The people standing in this visit's camp, as latched. */
export const campRescued = (sim: SimState): readonly MerchantId[] => sim.homeRun?.campRescued ?? MERCHANT_IDS;

/** Fixes the camp's size and level from the furthest the room has been, as it arrives home or as its first player walks in. */
export function latchCamp(sim: SimState): void {
  const run = sim.homeRun;
  if (!run) return;
  run.campLevel = run.roomHighest;
  run.campRescued = unionRescued(sim);
  run.campSize = campSizeFor(run.campRescued.length);
}

/** The latched size, or the smallest camp outside a home run. */
export const campSizeOf = (sim: SimState): CampSize => sim.homeRun?.campSize ?? 1;
