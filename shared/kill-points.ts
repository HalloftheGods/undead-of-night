import { BUNKER_LEVEL } from './home-protocol.ts';
import { FIRST_LEVEL } from './levels.ts';
import type { SimState } from './sim-state.ts';

/** A zombie's listed worth is ten times what it pays in the first town. */
const WORTH_PER_POINT = 10;

/** What a kill pays: its worth times the town, the kill chain and the night event, over ten, to the nearest point. */
export function killPoints(points: number, town: number, chain: number, event: number): number {
  return Math.round((points * town * chain * event) / WORTH_PER_POINT);
}

/** The town a kill is paid at. The bunker has no number of its own, so it pays as the furthest town reached. */
export function townOf(sim: Pick<SimState, 'level' | 'homeRun'>): number {
  return sim.level === BUNKER_LEVEL ? (sim.homeRun?.roomHighest ?? FIRST_LEVEL) : sim.level;
}
