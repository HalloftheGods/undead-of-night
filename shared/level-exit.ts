import { EXIT_HOLD_SEC, EXIT_RADIUS, TICK_DT, TICK_RATE } from './constants.ts';
import { exitSpotOf } from './exit-van.ts';
import type { Point } from './flow-field.ts';
import { isBunkerMap } from './home-protocol.ts';
import type { ExitEntity } from './protocol.ts';
import type { PlayerState, SimState } from './sim-state.ts';
import { alivePlayers, emit } from './sim-state.ts';

/** Someone this long with no key down and no station open stops holding the room at the van. */
const IDLE_TICKS = 60 * TICK_RATE;

/** Where the van parks: the same spot on the server and every client, and its body is solid from the start. */
export const chooseExitSpot = exitSpotOf;

/** The level's last horde is behind them: the van is there from now on, hordes or no hordes. */
export function openExit(sim: SimState): void {
  if (sim.exit || sim.testDrive) return;
  const { x, y } = chooseExitSpot(sim.map);
  sim.exit = { x, y, hold: 0 };
  emit(sim, { type: 'exit_open', level: sim.level, x, y });
}

/** The bunker's van is parked from the start, so nothing announces it the way `openExit` does in a town. */
export function parkBunkerVan(sim: SimState): void {
  const { x, y } = chooseExitSpot(sim.map);
  sim.exit = { x, y, hold: 0 };
}

const atTheVan = (p: PlayerState, spot: Point): boolean => Math.hypot(p.x - spot.x, p.y - spot.y) <= EXIT_RADIUS;

/** The downed cannot walk to it, so everyone on their feet is everyone who counts. */
function allAtTheVan(sim: SimState, spot: Point): boolean {
  const riders = alivePlayers(sim);
  return riders.length > 0 && riders.every((p) => atTheVan(p, spot));
}

export const goneQuiet = (sim: SimState, p: PlayerState): boolean => sim.tick - (p.home?.lastActiveTick ?? sim.tick) >= IDLE_TICKS;

/** A level is picked, and everyone it waits for is at the van and ready. Anyone else gone quiet rides along. */
function roomBoarded(sim: SimState, spot: Point): boolean {
  const boarded = (p: PlayerState): boolean => p.home?.ready === true && atTheVan(p, spot);
  const levelPicked = (sim.homeRun?.pickedLevel ?? null) !== null;
  const waitingFor = alivePlayers(sim).filter((p) => boarded(p) || !goneQuiet(sim, p));
  return levelPicked && waitingFor.length > 0 && waitingFor.every(boarded);
}

/** Counts the wait at the van, which anyone stepping away starts over. True once it has run out. */
export function exitBoarded(sim: SimState): boolean {
  const exit = sim.exit;
  if (!exit) return false;
  const aboard = isBunkerMap(sim.map) ? roomBoarded(sim, exit) : allAtTheVan(sim, exit);
  exit.hold = aboard ? exit.hold + TICK_DT : 0;
  return exit.hold >= EXIT_HOLD_SEC - 1e-9;
}

export function exitEntity(sim: SimState): ExitEntity | null {
  const exit = sim.exit;
  if (!exit) return null;
  return { x: exit.x, y: exit.y, progress: Math.min(1, exit.hold / EXIT_HOLD_SEC) };
}
