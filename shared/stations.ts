// Walking up to something in the bunker and holding E. It borrows the search key: a per-player hold,
// so the input packet does not change. A shop, the locker and the rest are client screens over `p.home.station`.

import { CHEST_STATION } from './bunker-map.ts';
import { TICK_DT } from './constants.ts';
import { isMerchantId } from './home-protocol.ts';
import { openChest } from './overrun-chest.ts';
import type { OverrunPhase, Station } from './home-protocol.ts';
import type { WorldMap } from './protocol.ts';
import type { PlayerState, SimState } from './sim-state.ts';

/** Seconds of holding E before a station opens. */
export const STATION_HOLD_SEC = 0.5;

const NO_EXTRA_STATIONS: readonly Station[] = [];

/** The nearest station whose circle holds the point, or null in open floor. `extra` are stations the map leaves out, such as the chest. */
export function stationInReach(map: WorldMap, x: number, y: number, extra: readonly Station[] = NO_EXTRA_STATIONS): Station | null {
  let nearest: Station | null = null;
  let nearestGap = Infinity;
  for (const list of [map.stations ?? NO_EXTRA_STATIONS, extra]) {
    for (const station of list) {
      const gap = Math.hypot(x - station.x, y - station.y);
      const closer = gap <= station.radius && gap < nearestGap;
      if (closer) {
        nearest = station;
        nearestGap = gap;
      }
    }
  }
  return nearest;
}

/** The chest stands for a player whose chest, won by holding the room, is still unopened. */
const chestStands = (p: PlayerState): boolean => p.home?.chest === true;
const CHEST_ONLY: readonly Station[] = [CHEST_STATION];

/**
 * What can be opened from this point: the map's stations, the chest for someone who has one waiting, and no merchant's stall while the
 * horde is in. One rule for the sim and for the client's prompt. `phase` is the room's overrun phase, undefined with none.
 */
export function openableStation(map: WorldMap, x: number, y: number, hasChest: boolean, phase: OverrunPhase | undefined): Station | null {
  const target = stationInReach(map, x, y, hasChest ? CHEST_ONLY : NO_EXTRA_STATIONS);
  const shuttered = target !== null && isMerchantId(target.id) && phase === 'breached';
  return shuttered ? null : target;
}

/** What this player can open from where they stand. */
function stationHere(sim: SimState, p: PlayerState): Station | null {
  return openableStation(sim.map, p.x, p.y, chestStands(p), sim.overrun?.phase);
}

function closeStation(home: NonNullable<PlayerState['home']>): void {
  home.station = null;
  home.stationHold = 0;
}

/** The blast door bursts: every open station closes, once, so nobody is caught reading. */
export function closeEveryStation(sim: SimState): void {
  for (const p of sim.players) {
    if (p.home) closeStation(p.home);
  }
}

/** Walking off, or falling, puts the station away. */
function keepOpen(sim: SimState, p: PlayerState, home: NonNullable<PlayerState['home']>): void {
  const stillThere = p.status === 'alive' && stationHere(sim, p)?.id === home.station;
  if (!stillThere) closeStation(home);
  if (stillThere) home.lastActiveTick = sim.tick;
}

/** Holding E in reach of a station, still, for long enough. */
function holdToOpen(sim: SimState, p: PlayerState, home: NonNullable<PlayerState['home']>): void {
  const target = p.status === 'alive' ? stationHere(sim, p) : null;
  const holding = target !== null && p.searchHeld && !p.searchSpent && !p.moving;
  if (!holding) {
    home.stationHold = 0;
    return;
  }
  home.lastActiveTick = sim.tick;
  home.stationHold = Math.min(1, home.stationHold + TICK_DT / STATION_HOLD_SEC);
  const done = home.stationHold >= 1;
  const opensTheChest = done && target.id === 'chest';
  if (opensTheChest) {
    openChest(sim, p);
    p.searchSpent = true;
    return;
  }
  if (done) {
    home.station = target.id;
    home.stationHold = 0;
    // The press has done its work: nothing more until it is let go.
    p.searchSpent = true;
  }
}

/** Runs beside `updateSearch` on every tick. Only a home room has stations. */
export function updateStations(sim: SimState, p: PlayerState): void {
  const { home } = p;
  const hasNoStations = !sim.homeRun || !home;
  if (hasNoStations) return;
  const isAtStation = home.station !== null;
  if (isAtStation) keepOpen(sim, p, home);
  else holdToOpen(sim, p, home);
}
