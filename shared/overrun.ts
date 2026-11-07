// The overrun: a clock that starts each time the room comes home, a blast door that bursts when it runs out,
// and a horde through it. Sim state, advanced by `step()` in the bunker, so solo and co-op run the same code.
// The numbers are starting points for the soak (#7223). Nothing here runs while `sim.overrun` is null.

import { BLAST_DOOR_SPOT } from './bunker-map.ts';
import { HORDE_SPEED_SCALE, TICK_DT, ZOMBIES, ZOMBIE_CAP } from './constants.ts';
import { BASELINE_DIFFICULTY } from './difficulty.ts';
import type { DifficultyId } from './difficulty.ts';
import type { OverrunView } from './home-protocol.ts';
import { goneQuiet } from './level-exit.ts';
import { FIRST_LEVEL, levelDef } from './levels.ts';
import { countKills, diedHere, overrunHolds, standingHorde, writeDied } from './overrun-fight.ts';
import type { OverrunState, PlayerState, SimState } from './sim-state.ts';
import { alivePlayers, emit, openGroundNear } from './sim-state.ts';
import { closeEveryStation } from './stations.ts';
import { spawnZombie, waveRoster } from './waves.ts';

/**
 * Seconds from arrival to the breach at full speed, by difficulty: the harder the run, the shorter the clock.
 * The user cut the first 300 seconds as too long. The shortest still leaves each warning a clear gap (60, 30 and 12 seconds left).
 */
export const OVERRUN_CLOCK_BY_DIFFICULTY: Readonly<Record<DifficultyId, number>> = {
  night_light: 240,
  stay_close: 180,
  lights_out: 150,
  undead_tired: 120,
};
/** The clock length for a run's difficulty. */
export const overrunClockSec = (difficulty: DifficultyId): number => OVERRUN_CLOCK_BY_DIFFICULTY[difficulty];
/** The length a view without its own `spanSec` is read as: the baseline difficulty's. */
export const OVERRUN_CLOCK_SEC = OVERRUN_CLOCK_BY_DIFFICULTY[BASELINE_DIFFICULTY];
/** How fast the clock runs while everyone who counts has a station open. */
export const OVERRUN_MENU_RATE = 0.5;
/** Share of the clock left at each warning: 2:30, 1:15 and 0:30. */
export const OVERRUN_WARNINGS: readonly number[] = [0.5, 0.25, 0.1];
/** Guns are free from the last warning on. */
export const OVERRUN_ARM_FRACTION = 0.1;
/** No clock until someone in the room has reached this level, so a first visit is in peace. */
export const OVERRUN_FIRST_HIGHEST = 2;
/** Most zombies one breach sends, for the bunker's floor space. */
export const OVERRUN_HORDE_MAX = 40;
/** Gap between zombies coming through the door. */
export const OVERRUN_SPAWN_INTERVAL_SEC = 0.6;
/** Most merchants one flight kills, so one stall always survives. */
export const OVERRUN_MAX_KILLED = 3;
/** Banked trips until a closed stall reopens or a thin stock is full again. */
export const OVERRUN_RECOVERY_TRIPS = 3;
/** Ammo finds in a reward chest. */
export const OVERRUN_CHEST_FINDS = 3;
/** Silver stacks in a reward chest. */
export const OVERRUN_CHEST_STACKS = 6;

/** Seconds of slack for the sum of many small ticks, as the van's wait allows. */
const CLOCK_EPSILON = 1e-9;
/** How far from `BLAST_DOOR_SPOT` a zombie comes through, so a crowd does not stack on one point. Inside the hall either way. */
const DOOR_SCATTER = 12;

/** A fresh clock, as long as the run's difficulty says, for an arrival in the bunker, or none: the switch is off, or the room has not yet reached `OVERRUN_FIRST_HIGHEST`. The arrival clears the last overrun's receipts. */
export function startOverrunClock(sim: SimState): void {
  const homes = [...sim.players, ...sim.departed.values()].flatMap((p) => (p.home ? [p.home] : []));
  for (const home of homes) home.overrun = null;
  const peace = !sim.overrunOn || (sim.homeRun?.roomHighest ?? 0) < OVERRUN_FIRST_HIGHEST;
  const spanSec = overrunClockSec(sim.difficulty);
  sim.overrun = peace ? null : {
    phase: 'counting',
    spanSec,
    left: spanSec,
    slowed: false,
    warned: 0,
    queue: [],
    spawnTimer: 0,
    total: 0,
    kills: 0,
    startTick: sim.tick,
  };
}

/** The players the van would wait for. */
const standing = (sim: SimState): PlayerState[] => alivePlayers(sim).filter((p) => !goneQuiet(sim, p));

/** Half speed while everyone who counts has a station open. With nobody counting the clock runs full. */
function clockRate(sim: SimState): number {
  const counting = standing(sim);
  const inMenus = counting.length > 0 && counting.every((p) => p.home?.station != null);
  return inMenus ? OVERRUN_MENU_RATE : 1;
}

/** Guns are free from the last warning until the horde is dead or the room has fallen. */
export const gunsFree = (sim: SimState): boolean => sim.overrun?.phase === 'armed' || sim.overrun?.phase === 'breached';

/** One tick of the overrun, from the bunker branch of `step()`: the clock, then the breach at zero, then the fight. */
export function updateOverrun(sim: SimState): void {
  const overrun = sim.overrun;
  if (!overrun) return;
  const beforeTheBreach = overrun.phase === 'counting' || overrun.phase === 'armed';
  if (beforeTheBreach) tickClock(sim, overrun);
  const doorGives = beforeTheBreach && overrun.left === 0;
  if (doorGives) breach(sim, overrun);
  const hordeIn = overrun.phase === 'breached';
  if (hordeIn) fight(sim, overrun);
}

/** Runs the clock down by one tick, gives each warning once and arms the guns for the last stretch. */
function tickClock(sim: SimState, overrun: OverrunState): void {
  const rate = clockRate(sim);
  overrun.slowed = rate < 1;
  overrun.left = Math.max(0, overrun.left - TICK_DT * rate);
  const isClockOut = overrun.left < CLOCK_EPSILON;
  if (isClockOut) overrun.left = 0;
  const share = overrun.left / overrun.spanSec;
  while (overrun.warned < OVERRUN_WARNINGS.length && share <= OVERRUN_WARNINGS[overrun.warned] + CLOCK_EPSILON) {
    emit(sim, { type: 'overrun_warning', step: overrun.warned, left: Math.round(overrun.left) });
    overrun.warned += 1;
  }
  const shouldArm = overrun.phase === 'counting' && share <= OVERRUN_ARM_FRACTION + CLOCK_EPSILON;
  if (shouldArm) overrun.phase = 'armed';
}

/**
 * The door bursts: the hardest horde of the furthest town the room has reached, cut to what the bunker has room for.
 * `sim.wave` is set to match so `spawnZombie` scales health and speed as that town does, and `emptyWorld` puts it back when the van leaves.
 */
function breach(sim: SimState, overrun: OverrunState): void {
  const level = levelDef(sim.homeRun?.roomHighest ?? FIRST_LEVEL);
  const room = Math.max(0, Math.min(ZOMBIE_CAP - sim.zombies.length, OVERRUN_HORDE_MAX));
  const roster = waveRoster(level.hordes, sim.rng, level, sim.difficulty).slice(0, room);
  sim.wave = level.hordes;
  overrun.phase = 'breached';
  overrun.queue = roster.reverse();
  overrun.total = roster.length;
  overrun.spawnTimer = 0;
  closeEveryStation(sim);
  emit(sim, { type: 'overrun_breach', hostiles: overrun.total });
}

/** One a gap through the door, hunting from the moment it is in, with no give-up timer. */
function trickle(sim: SimState, overrun: OverrunState): void {
  overrun.spawnTimer -= TICK_DT;
  while (overrun.spawnTimer <= 0 && overrun.queue.length > 0 && sim.zombies.length < ZOMBIE_CAP) {
    const type = overrun.queue.pop() as OverrunState['queue'][number];
    const spot = openGroundNear(sim, BLAST_DOOR_SPOT.x, BLAST_DOOR_SPOT.y, 0, DOOR_SCATTER, ZOMBIES[type].radius + 1);
    spawnZombie(sim, type, spot.x, spot.y);
    const zombie = sim.zombies[sim.zombies.length - 1];
    zombie.horde = true;
    zombie.mode = 'hunt';
    zombie.speed *= HORDE_SPEED_SCALE;
    overrun.spawnTimer += OVERRUN_SPAWN_INTERVAL_SEC;
  }
  overrun.spawnTimer = Math.max(0, overrun.spawnTimer);
}

/** The horde comes in, a body that dies is written off at once and stays down, and the room holds once nothing is left to come or standing. */
function fight(sim: SimState, overrun: OverrunState): void {
  trickle(sim, overrun);
  countKills(sim, overrun);
  const newlyDead = sim.players.filter((p) => p.status === 'dead' && !diedHere(p));
  for (const p of newlyDead) writeDied(sim, p, overrun);
  const cleared = overrun.queue.length === 0 && standingHorde(sim) === 0;
  if (cleared) overrunHolds(sim, overrun);
}

/** The room's overrun for the snapshot, or null while there is none. Tenths of a second, as the clock is drawn. */
export function overrunView(sim: SimState): OverrunView | null {
  const overrun = sim.overrun;
  if (!overrun) return null;
  const breached = overrun.total > 0;
  return {
    phase: overrun.phase,
    spanSec: overrun.spanSec,
    left: Math.round(overrun.left * 10) / 10 + 0,
    slowed: overrun.slowed,
    hostiles: breached ? overrun.queue.length + standingHorde(sim) : 0,
    total: overrun.total,
  };
}
