// Stairs are taken by walking onto them: no key, so a survivor with a horde behind them just keeps going.
// Coming out at the far end puts them on that floor's stairs, which wait until they step off, or the
// two flights would bounce them back and forth.

import { stopSearch } from './container-search.ts';
import type { PlayerState, SimState } from './sim-state.ts';
import { emit } from './sim-state.ts';
import { flightAt } from './storeys.ts';

/** No stairs underfoot to wait on. */
export const OFF_STAIRS = -1;

/** Takes the stairs the player has just stepped onto. True if it did. */
export function takeStairs(sim: SimState, p: PlayerState): boolean {
  const flight = flightAt(sim.map, p.x, p.y);
  if (!flight) {
    p.stairsLanding = OFF_STAIRS;
    return false;
  }
  const justCameUp = flight.fromIndex === p.stairsLanding;
  if (justCameUp) return false;
  stopSearch(p);
  p.stairsLanding = flight.toIndex;
  p.x = flight.to.x;
  p.y = flight.to.y;
  emit(sim, { type: 'stairs_taken', playerId: p.id, x: p.x, y: p.y, to: flight.label });
  return true;
}
