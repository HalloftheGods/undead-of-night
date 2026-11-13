// How big the camp is, decided when the room comes home and held for the whole visit, so nobody joining or leaving moves a fence mid-fight.
// The breach reads the level latched here too (#7547). Camp project 2 replaces `campSizeFor` with "people brought home".

import type { SimState } from '../sim-state.ts';
import { clampCampSize } from './camp-ring.ts';
import type { CampSize } from './camp-ring.ts';

/** One size a level reached, from 1 to 5. */
export const campSizeFor = (level: number): CampSize => clampCampSize(level);

/** Fixes the camp's size and level from the furthest the room has been, as it arrives home or as its first player walks in. */
export function latchCamp(sim: SimState): void {
  const run = sim.homeRun;
  if (!run) return;
  run.campLevel = run.roomHighest;
  run.campSize = campSizeFor(run.roomHighest);
}

/** The latched size, or the smallest camp outside a home run. */
export const campSizeOf = (sim: SimState): CampSize => sim.homeRun?.campSize ?? 1;
