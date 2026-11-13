// How a trip ended for one player, written as state on their body so a slow client cannot lose it.

import { bagOf, candyBagWorth } from './candy.ts';
import { TICK_DT } from './constants.ts';
import { SALVAGE_TYPES } from './events.ts';
import type { TripReceipt } from './home-protocol.ts';
import { FINAL_LEVEL } from './levels.ts';
import { loadoutOf } from './loadout.ts';
import { noSalvage } from './salvage-data.ts';
import type { HomeRun, PlayerHome, PlayerState, SimState } from './sim-state.ts';
import { round2 } from './snapshot-build.ts';
import { hordesSurvivedHere } from './waves.ts';

/** What `dropCarried` left on them goes with the town: downed at the van, or a body nobody came back for. */
function forfeitCarried(home: PlayerHome): void {
  home.lost.silver += home.silver;
  home.lost.jewels.small += home.jewels.small;
  home.lost.jewels.large += home.jewels.large;
  for (const type of SALVAGE_TYPES) home.lost.salvage[type] += home.salvage[type];
  home.silver = 0;
  home.jewels = { small: 0, large: 0 };
  home.salvage = noSalvage();
}

/** The radios found this trip ride the receipt once, and the list starts again for the next trip. */
function radioFinds(p: PlayerState): { radioLevels?: number[] } {
  const found = p.home?.radioLevels ?? [];
  if (found.length === 0 || !p.home) return {};
  const radioLevels = [...found];
  p.home.radioLevels = [];
  return { radioLevels };
}

function tripFacts(sim: SimState, run: HomeRun, p: PlayerState, level: number): Omit<TripReceipt, 'outcome' | 'silver' | 'jewels' | 'salvage' | 'ending' | 'gear'> {
  const serial = run.nextReceipt;
  run.nextReceipt += 1;
  return {
    simId: run.simId,
    serial,
    level,
    difficulty: sim.difficulty,
    replay: run.tripReplay,
    score: p.score,
    kills: p.kills,
    hordes: sim.hordesBehind + hordesSurvivedHere(sim),
    seconds: round2((sim.tick - sim.runStartTick) * TICK_DT),
    ...radioFinds(p),
  };
}

/** Everything on them comes home, and reaching the van unlocks the next level. */
export function bankTrip(sim: SimState, run: HomeRun, p: PlayerState, home: PlayerHome, level: number): void {
  const ending = level === FINAL_LEVEL && !home.finished;
  const candyWorth = candyBagWorth(p.candy);
  home.receipt = {
    ...tripFacts(sim, run, p, level),
    outcome: 'banked',
    silver: home.silver,
    jewels: { ...home.jewels },
    salvage: { ...home.salvage },
    candy: candyWorth,
    candyBag: bagOf(p.candy),
    ending,
    gear: loadoutOf(p),
  };
  home.highest = Math.max(home.highest, Math.min(FINAL_LEVEL, level + 1));
  home.finished ||= ending;
}

/** Nothing comes home. The silver, jewels and salvage here are what was lost, and are never credited. */
export function loseTrip(sim: SimState, run: HomeRun, p: PlayerState, home: PlayerHome, level: number): void {
  forfeitCarried(home);
  const candyWorth = candyBagWorth(p.candy);
  const lostBag = bagOf(p.candy);
  home.receipt = {
    ...tripFacts(sim, run, p, level),
    outcome: 'died',
    silver: home.lost.silver,
    jewels: { ...home.lost.jewels },
    salvage: { ...home.lost.salvage },
    candy: candyWorth,
    candyBag: lostBag,
    ending: false,
    gear: null,
  };
}
