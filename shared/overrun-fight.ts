// Who goes down when the blast door bursts, and how the room gets back up: the died receipt, the bunker falling,
// and everyone standing at the spawn once the overrun is over. Only an overrun under way reaches any of this.

import { TICK_DT } from './constants.ts';
import type { OverrunReceipt } from './home-protocol.ts';
import { placeAtEntry } from './level-change.ts';
import { applyLoadout, emptyLoadout, loadoutOf } from './loadout.ts';
import type { HomeRun, OverrunState, PlayerHome, PlayerState, SimState } from './sim-state.ts';
import { emit } from './sim-state.ts';
import { round2 } from './snapshot-build.ts';

type ReceiptFacts = Pick<OverrunReceipt, 'simId' | 'serial' | 'kills' | 'seconds'>;

/** What every overrun receipt says, with the room's serial so `${simId}:${serial}` never matches a trip receipt's. */
export function overrunFacts(sim: SimState, run: HomeRun, overrun: OverrunState): ReceiptFacts {
  const serial = run.nextReceipt;
  run.nextReceipt += 1;
  return { simId: run.simId, serial, kills: overrun.kills, seconds: round2((sim.tick - overrun.startTick) * TICK_DT) };
}

/** Horde zombies on their feet. */
export const standingHorde = (sim: SimState): number => sim.zombies.filter((z) => z.horde && z.health > 0).length;

/** The horde killed so far: the roster less what is still to come and what still stands. */
export function countKills(sim: SimState, overrun: OverrunState): void {
  overrun.kills = Math.max(0, overrun.total - overrun.queue.length - standingHorde(sim));
}

/** Their died receipt is written. The next arrival clears it, so one on the body is this overrun's. */
export const diedHere = (p: PlayerState): boolean => p.home?.overrun?.outcome === 'died';

/** The gear in hand goes down with the body, and the receipt says what it was. The locker, the bank and the stock are the client's, and untouched. */
export function writeDied(sim: SimState, p: PlayerState, overrun: OverrunState): void {
  const run = sim.homeRun;
  const { home } = p;
  const outsideAHomeRoom = !run || !home;
  if (outsideAHomeRoom) return;
  home.overrun = {
    ...overrunFacts(sim, run, overrun),
    outcome: 'died',
    share: 0,
    chest: null,
    silver: 0,
    jewels: { small: 0, large: 0 },
    lost: loadoutOf(p),
  };
  applyLoadout(p, emptyLoadout());
  home.station = null;
  home.stationHold = 0;
}

/**
 * Leaving the room mid-horde, by a closed tab or a dropped line, is dying in it: the gear in hand goes down with the body. Only for a body
 * the room keeps (ready at the van, or holding a receipt): one it lets go has the client's open breach, which resolves as a death on the
 * next load. A body already written off keeps its receipt.
 */
export function diedOnLeaving(sim: SimState, p: PlayerState): void {
  const { overrun } = sim;
  const inTheBreach = overrun !== null && overrun.phase === 'breached';
  const nothingToWrite = !inTheBreach || diedHere(p);
  if (nothingToWrite) return;
  countKills(sim, overrun);
  writeDied(sim, p, overrun);
}

/** On their feet and healed, wherever they lie. */
function getUp(p: PlayerState): void {
  p.status = 'alive';
  p.health = p.maxHealth;
}

/** Back on their feet at the spawn, healed, holding whatever the overrun left them. */
function standUp(sim: SimState, p: PlayerState): void {
  placeAtEntry(sim, p);
  getUp(p);
  if (p.home) p.home.lastActiveTick = sim.tick;
}

/** Nobody is standing. Every body not yet written off gets its died receipt, the horde goes back out through the door, and the room stands up at the spawn. No merchant dies. */
export function overrunFalls(sim: SimState): void {
  const overrun = sim.overrun;
  if (!overrun) return;
  countKills(sim, overrun);
  const notYetWrittenOff = sim.players.filter((p) => !diedHere(p));
  for (const p of notYetWrittenOff) writeDied(sim, p, overrun);
  sim.zombies = sim.zombies.filter((z) => !z.horde);
  overrun.queue = [];
  overrun.phase = 'lost';
  for (const p of sim.players) standUp(sim, p);
  emit(sim, { type: 'overrun_end', outcome: 'lost' });
}

/**
 * The van leaves mid-horde. A body down or dead gets its died receipt and loses its gear in hand. Every other body gets a fled receipt
 * carrying the share of the horde still to come or standing. Every body written off rides along, as a gone-quiet one does, and lands
 * on its feet: `setOut` puts it at the entry with the free pistol, so it can never die a second time in town.
 * Only bodies in the room are written: one that left during the breach already has its died receipt (`diedOnLeaving`), and one that
 * left before it, ready at the van, was never in the fight, and quitting before the breach costs nothing.
 */
export function writeFlight(sim: SimState): void {
  const { overrun } = sim;
  const run = sim.homeRun;
  const notBreached = !overrun || overrun.phase !== 'breached';
  const isFightOff = notBreached || !run;
  if (isFightOff) return;
  countKills(sim, overrun);
  const share = overrun.total > 0 ? Math.min(1, (overrun.queue.length + standingHorde(sim)) / overrun.total) : 0;
  const bodies = [...sim.players, ...sim.departed.values()];
  const stillToWrite = sim.players.filter((p) => p.home && !diedHere(p));
  const down = stillToWrite.filter((p) => p.status !== 'alive');
  const onTheirFeet = stillToWrite.filter((p) => p.status === 'alive');
  for (const p of down) writeDied(sim, p, overrun);
  for (const p of onTheirFeet) {
    const fled: OverrunReceipt = { ...overrunFacts(sim, run, overrun), outcome: 'fled', share, chest: null, silver: 0, jewels: { small: 0, large: 0 }, lost: null };
    (p.home as PlayerHome).overrun = fled;
  }
  const writtenOff = bodies.filter((p) => p.status !== 'alive');
  for (const p of writtenOff) getUp(p);
}

/** The horde is dead. The fallen stand back up at the spawn, the dead holding nothing. Everyone in the room, the dead included, has a chest waiting. */
export function overrunHolds(sim: SimState, overrun: OverrunState): void {
  overrun.phase = 'held';
  const fallen = sim.players.filter((p) => p.status !== 'alive');
  for (const p of fallen) standUp(sim, p);
  for (const p of sim.players) {
    if (p.home) p.home.chest = true;
  }
  emit(sim, { type: 'overrun_end', outcome: 'held' });
}
