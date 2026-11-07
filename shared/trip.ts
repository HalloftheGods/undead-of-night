// Out to a town and back: the room's side of a trip, and everything a player can ask of the bunker.

import type { HomeAction, JoinHome } from './home-protocol.ts';
import { enterBunker, enterTown, placeAtEntry } from './level-change.ts';
import { FIRST_LEVEL } from './levels.ts';
import { applyLoadout, emptyLoadout, issueFreePistol, validateLoadout } from './loadout.ts';
import { openPendingChests } from './overrun-chest.ts';
import { writeFlight } from './overrun-fight.ts';
import { startOverrunClock } from './overrun.ts';
import { announceRunStart, clampLevel } from './sim-factory.ts';
import type { HomeRun, PlayerHome, PlayerState, SimState } from './sim-state.ts';
import { emit } from './sim-state.ts';
import { bankTrip, loseTrip } from './trip-receipt.ts';
import { stashReceipt, syncRoomHighest } from './trip-roster.ts';

const SIM_ID_BYTES = 8;

/** Off `sim.rng`, so it moves no roll. Not randomUUID: that only exists on https, and a LAN server is plain http. */
function newSimId(seed: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(SIM_ID_BYTES));
  const noise = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${seed.toString(36)}-${noise}`;
}

export function newHomeRun(seed: number): HomeRun {
  return { simId: newSimId(seed), tripLevel: null, tripReplay: false, pickedLevel: null, attempt: 0, roomHighest: FIRST_LEVEL, nextTreasure: 0, nextReceipt: 1, unclaimed: new Map() };
}

/** A newcomer to a home room, with the gear and highest level they brought. Anyone joining a trip lands in it armed. Does nothing with home off. */
export function enterHome(sim: SimState, p: PlayerState, join?: JoinHome): void {
  const run = sim.homeRun;
  if (!run) return;
  p.home = {
    silver: 0,
    jewels: { small: 0, large: 0 },
    station: null,
    stationHold: 0,
    ready: false,
    receipt: null,
    overrun: null,
    highest: clampLevel(join?.highest),
    finished: join?.finished === true,
    lost: { silver: 0, jewels: { small: 0, large: 0 } },
    chest: false,
    lastActiveTick: sim.tick,
    leftTick: null,
  };
  if (join) applyLoadout(p, validateLoadout(join.loadout) ?? emptyLoadout());
  const joiningATrip = run.tripLevel !== null;
  if (joiningATrip) issueFreePistol(p);
}

const everyBody = (sim: SimState): PlayerState[] => [...sim.players, ...sim.departed.values()];

function leaveStation(home: PlayerHome): void {
  home.station = null;
  home.stationHold = 0;
}

/** A body that left the bunker before the van did has nothing at stake, and comes back as a newcomer. One that was ready is on the trip. */
function forgetStayedBehind(sim: SimState): void {
  for (const [token, p] of sim.departed) {
    const onTheTrip = p.home?.ready === true;
    if (!onTheTrip) sim.departed.delete(token);
  }
}

function setOut(sim: SimState, p: PlayerState): void {
  const { home } = p;
  if (!home) return;
  placeAtEntry(sim, p);
  leaveStation(home);
  home.ready = false;
  home.receipt = null;
  home.lost = { silver: 0, jewels: { small: 0, large: 0 } };
  home.lastActiveTick = sim.tick;
  p.score = 0;
  p.kills = 0;
  issueFreePistol(p);
}

/** The van leaves the bunker: a fresh town, and a clean slate for this trip's result. */
export function startTrip(sim: SimState, level: number): void {
  const run = sim.homeRun;
  if (!run) return;
  const attempt = run.attempt;
  run.tripLevel = level;
  run.tripReplay = level < run.roomHighest;
  run.pickedLevel = null;
  openPendingChests(sim);
  writeFlight(sim);
  sim.overrun = null;
  sim.runStartTick = sim.tick;
  sim.hordesBehind = 0;
  enterTown(sim, level);
  run.attempt += 1;
  for (const p of everyBody(sim)) stashReceipt(run, p);
  forgetStayedBehind(sim);
  for (const p of everyBody(sim)) setOut(sim, p);
  emit(sim, { type: 'trip_start', level, attempt });
  announceRunStart(sim);
}

/** Home and healed, holding nothing: what came back is on the receipt, and what did not is gone. */
function settleInBunker(sim: SimState, p: PlayerState): void {
  const { home } = p;
  if (!home) return;
  placeAtEntry(sim, p);
  p.status = 'alive';
  p.health = p.maxHealth;
  applyLoadout(p, emptyLoadout());
  leaveStation(home);
  home.silver = 0;
  home.jewels = { small: 0, large: 0 };
  home.ready = false;
  home.lastActiveTick = sim.tick;
  home.leftTick = null;
}

/** Writes everyone's result while the town still stands, then brings the whole room home, bodies left behind included. */
function endTrip(sim: SimState, banks: (p: PlayerState) => boolean): void {
  const run = sim.homeRun;
  const level = run?.tripLevel ?? null;
  const noTrip = !run || level === null;
  if (noTrip) return;
  const close = (p: PlayerState, banked: boolean): void => {
    const write = banked ? bankTrip : loseTrip;
    write(sim, run, p, p.home as PlayerHome, level);
    const hasToken = p.token !== null;
    if (hasToken) run.unclaimed.delete(p.token);
  };
  for (const p of sim.players) close(p, banks(p));
  for (const p of sim.departed.values()) close(p, false);
  run.tripLevel = null;
  enterBunker(sim);
  for (const p of everyBody(sim)) settleInBunker(sim, p);
  syncRoomHighest(sim);
  startOverrunClock(sim);
}

/** The party reached the van. Only those on their feet and still connected bank: the downed, the dead and the departed lose it all. */
export function returnToBunker(sim: SimState): void {
  endTrip(sim, (p) => p.status === 'alive');
}

/** Nobody is left standing in town. The sim runs on, and everyone wakes in the bunker. */
export function wipeToBunker(sim: SimState): void {
  endTrip(sim, () => false);
}

/** The van's wait has run out, wherever it is parked. */
export function vanLeaves(sim: SimState): void {
  const run = sim.homeRun;
  if (!run) return;
  const outOnATrip = run.tripLevel !== null;
  if (outOnATrip) {
    returnToBunker(sim);
  } else {
    const { pickedLevel } = run;
    const hasPickedLevel = pickedLevel !== null;
    if (hasPickedLevel) startTrip(sim, pickedLevel);
  }
}

/** A home room restarts by going back to the bunker. Any trip under way counts as lost, and every body not in the room lets go. */
export function resetHomeRoom(sim: SimState): void {
  const run = sim.homeRun;
  if (!run) return;
  wipeToBunker(sim);
  sim.departed.clear();
  run.pickedLevel = null;
  syncRoomHighest(sim);
}

function raiseHighest(sim: SimState, home: PlayerHome, highest: number): void {
  home.highest = Math.max(home.highest, clampLevel(highest));
  syncRoomHighest(sim);
}

function equip(p: PlayerState, home: PlayerHome, gear: unknown): void {
  const committed = home.ready;
  const legal = committed ? null : validateLoadout(gear);
  if (legal) applyLoadout(p, legal);
}

/** Every HomeAction lands here. Picking a level, gear and ready are for the bunker, and refused anywhere else. */
export function homeCommand(sim: SimState, p: PlayerState, action: HomeAction): void {
  const run = sim.homeRun;
  const { home } = p;
  const notInHomeRoom = !run || !home;
  if (notInHomeRoom) return;
  const inBunker = run.tripLevel === null;
  switch (action.kind) {
    case 'highest':
      raiseHighest(sim, home, action.highest);
      break;
    case 'leave_station':
      leaveStation(home);
      break;
    case 'pick_level':
      if (inBunker) run.pickedLevel = Math.min(clampLevel(action.level), run.roomHighest);
      break;
    case 'equip':
      if (inBunker) equip(p, home, action.loadout);
      break;
    case 'ready':
      if (inBunker) home.ready = action.ready;
      break;
  }
}
