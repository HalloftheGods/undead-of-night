// Who is in a home room: how far the room can go, and what happens to a body left behind.

import { TICK_RATE } from './constants.ts';
import { FIRST_LEVEL } from './levels.ts';
import { startOverrunClock } from './overrun.ts';
import type { HomeRun, PlayerState, SimState } from './sim-state.ts';
import { dropCarried } from './treasure.ts';

/** Time a refresh gets to take a body back before its carried treasure falls where it stands. */
const GRACE_TICKS = 60 * TICK_RATE;

/** The room reaches as far as whoever is in it has, and a pick past that goes with them. */
export function syncRoomHighest(sim: SimState): void {
  const run = sim.homeRun;
  if (!run) return;
  const reached = sim.players.map((p) => p.home?.highest ?? FIRST_LEVEL);
  run.roomHighest = Math.max(FIRST_LEVEL, ...reached);
  const pickOutOfReach = run.pickedLevel !== null && run.pickedLevel > run.roomHighest;
  if (pickOutOfReach) run.pickedLevel = null;
}

/** The most unapplied receipts a room keeps for players who are not in it. */
const UNCLAIMED_LIMIT = 16;

/** A banked receipt the next trip would clear is kept for its token, so a slow or dropped client still gets to apply it. */
export function stashReceipt(run: HomeRun, p: PlayerState): void {
  const receipt = p.home?.receipt ?? null;
  const unappliable = receipt === null || p.token === null;
  if (unappliable) return;
  run.unclaimed.delete(p.token);
  run.unclaimed.set(p.token, receipt);
  const [oldest] = run.unclaimed.keys();
  const isOverUnclaimedLimit = run.unclaimed.size > UNCLAIMED_LIMIT;
  if (isOverUnclaimedLimit) run.unclaimed.delete(oldest);
}

function claimStashedReceipt(sim: SimState, p: PlayerState): void {
  const { home } = p;
  const kept = p.token === null ? undefined : sim.homeRun?.unclaimed.get(p.token);
  const hasNoReceiptToRestore = !home || !kept || home.receipt;
  if (hasNoReceiptToRestore) return;
  home.receipt = kept;
  sim.homeRun?.unclaimed.delete(p.token as string);
}

/** A body the player has just walked back into, or a newcomer. */
export function arriveInRoom(sim: SimState, p: PlayerState): void {
  const { home } = p;
  if (!home) return;
  claimStashedReceipt(sim, p);
  home.leftTick = null;
  home.lastActiveTick = sim.tick;
  syncRoomHighest(sim);
  startFreshRoomClock(sim);
}

/** The first player into a fresh home room starts its clock. Later arrivals, and rooms already under way, share what stands. */
function startFreshRoomClock(sim: SimState): void {
  const firstIntoFreshRoom = sim.tick === 0 && sim.players.length === 1 && sim.homeRun?.tripLevel === null;
  const clockAlreadyRunning = sim.overrun !== null;
  const shouldStartClock = firstIntoFreshRoom && !clockAlreadyRunning;
  if (shouldStartClock) startOverrunClock(sim);
}

/**
 * Whether the room holds this body for its token to come back to. In the bunker with nothing at stake (not ready for the van, no result left to credit) the
 * save is the newer word on the gear and the level, since a solo run can have changed both while the tab was away, so the body goes and a rejoin is a newcomer.
 * An overrun receipt still on the body is at stake too: a chest or a flight not yet credited, and a died receipt not yet applied, would be thrown away with it.
 */
export function keepsBodyOnLeaving(sim: SimState, p: PlayerState): boolean {
  const { home } = p;
  const inBunker = sim.homeRun !== null && sim.homeRun.tripLevel === null;
  const nothingAtStake = home !== null && !home.ready && home.receipt === null && home.overrun === null;
  return !(inBunker && nothingAtStake);
}

/** Closing the tab is never an escape: a downed body or one nobody can reclaim drops at once, and the rest get the grace period. */
export function leaveRoom(sim: SimState, p: PlayerState): void {
  const { home } = p;
  if (!home) return;
  syncRoomHighest(sim);
  const outOnATrip = (sim.homeRun?.tripLevel ?? null) !== null;
  if (!outOnATrip) return;
  home.leftTick = sim.tick;
  const noWayBack = p.status === 'downed' || p.token === null;
  if (noWayBack) dropCarried(sim, p);
}

/** Bodies whose grace period has run out let go of what they carry. Their gear stays on them until the van leaves. */
export function updateLeftBodies(sim: SimState): void {
  if (!sim.homeRun) return;
  for (const p of sim.departed.values()) {
    const left = p.home?.leftTick ?? null;
    const graceOver = left !== null && sim.tick - left >= GRACE_TICKS;
    if (graceOver) {
      dropCarried(sim, p);
      (p.home as NonNullable<PlayerState['home']>).leftTick = null;
    }
  }
}
