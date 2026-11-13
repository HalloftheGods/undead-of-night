// Manholes and sewer ladders are taken by pressing the search key (E, or the touch button) within reach of
// one, never by walking over it: a survivor running past a cover does not fall in. Zombies have no key, so
// they cross these flights on the flow field like stairs (see zombies.ts).
//
// The press shares the search key's latch, `searchSpent`: it is set on crossing and clears only when the key
// is let go, so holding E at the foot of a ladder does not carry a player straight back up, and does not
// start a search of a crate beside the cover either.

import { stopSearch } from './container-search.ts';
import type { ManholeFlight } from './sewers.ts';
import type { PlayerState, SimState } from './sim-state.ts';
import { emit } from './sim-state.ts';

/** How close, in pixels, a player has to stand to the middle of the cover or the foot of the ladder. */
export const MANHOLE_REACH = 28;

/** The manhole flight within reach of this spot, the nearest if there are two, or null. */
export function manholeFlightNear(sim: Pick<SimState, 'map'>, x: number, y: number): ManholeFlight | null {
  let best: ManholeFlight | null = null;
  let bestDistance = MANHOLE_REACH;
  for (const flight of sim.map.flights ?? []) {
    const distance = Math.hypot(flight.from.x - x, flight.from.y - y);
    const isNearer = distance <= bestDistance;
    if (isNearer) {
      bestDistance = distance;
      best = flight;
    }
  }
  return best;
}

/** What the prompt says over a head at a manhole or a ladder: the way it goes, as `E: CLIMB DOWN` or `E: CLIMB UP`. */
export function climbPrompt(flight: Pick<ManholeFlight, 'down'>, touch: boolean, hold = 'E'): string {
  return `${touch ? '' : `${hold}: `}${flight.down ? 'CLIMB DOWN' : 'CLIMB UP'}`;
}

/** Crosses the flight the player is pressing search at. True if it did. */
export function takeManhole(sim: SimState, p: PlayerState): boolean {
  const pressing = p.searchHeld && !p.searchSpent;
  if (!pressing) return false;
  const flight = manholeFlightNear(sim, p.x, p.y);
  if (!flight) return false;
  stopSearch(p);
  p.searchSpent = true;
  p.x = flight.to.x;
  p.y = flight.to.y;
  emit(sim, { type: 'stairs_taken', playerId: p.id, x: p.x, y: p.y, to: flight.label });
  return true;
}
