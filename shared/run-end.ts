import { TICK_DT } from './constants.ts';
import { enterTown, moveToNextTown, placeAtEntry } from './level-change.ts';
import { FINAL_LEVEL, FIRST_LEVEL } from './levels.ts';
import { giveReturnKit, giveStartingLoadout } from './player-health.ts';
import type { GameOverStats, RunOutcome } from './protocol.ts';
import type { SimState } from './sim-state.ts';
import { overrunFalls } from './overrun-fight.ts';
import { emit, standingPlayers } from './sim-state.ts';
import { announceRunStart, clampLevel } from './sim-factory.ts';
import { round2 } from './snapshot-build.ts';
import { resetHomeRoom, vanLeaves, wipeToBunker } from './trip.ts';
import { hordesSurvivedHere } from './waves.ts';
import { openBench } from './workbench.ts';

/** The one way out of `exitBoarded`. In a home room the van runs between the bunker and a town, so no run ends here. */
export function leaveTown(sim: SimState): void {
  if (sim.homeRun) {
    vanLeaves(sim);
    return;
  }
  const lastTown = sim.level >= FINAL_LEVEL;
  if (lastTown) endRun(sim, 'victory');
  else if (!openBench(sim)) moveToNextTown(sim);
}

/** In a home room a body on its feet inside its grace period is a refresh that may come back, so it still counts. A downed one has no one to lift it. */
function anyoneCouldStillStand(sim: SimState): boolean {
  const hasStandingPlayers = standingPlayers(sim).length > 0;
  if (hasStandingPlayers) return true;
  if (!sim.homeRun) return false;
  return [...sim.departed.values()].some((p) => p.home?.leftTick != null && p.status === 'alive');
}

/** Nobody standing ends a town run, wakes a home room in the bunker, or, in the bunker against an overrun, lets the bunker fall. */
export function checkGameOver(sim: SimState): void {
  const runActive = sim.phase !== 'gameover' && sim.players.length > 0;
  const everyoneGone = runActive && !anyoneCouldStillStand(sim);
  if (!everyoneGone) return;
  const bunkerFalls = sim.overrun?.phase === 'breached';
  if (bunkerFalls) overrunFalls(sim);
  else if (sim.homeRun) wipeToBunker(sim);
  else endRun(sim, 'defeat');
}

export function endRun(sim: SimState, outcome: RunOutcome): void {
  const players = [...sim.players]
    .sort((a, b) => b.score - a.score)
    .map(({ id, name, skin, kills, score }) => ({ id, name, skin, kills, score }));
  const stats: GameOverStats = {
    outcome,
    difficulty: sim.difficulty,
    level: sim.level,
    wave: sim.hordesBehind + hordesSurvivedHere(sim),
    durationSec: round2((sim.tick - sim.runStartTick) * TICK_DT),
    players,
  };
  sim.phase = 'gameover';
  sim.gameOver = stats;
  emit(sim, { type: 'game_over', stats });
}

/**
 * Starts a new run with everyone still connected, from level 1 unless told otherwise.
 * Ticks keep counting up. Starting past level 1 hands out the return kit, as for anyone arriving mid-run.
 * A home room has no run to restart, and goes back to the bunker.
 */
export function restartRun(sim: SimState, fromLevel?: number): void {
  if (sim.homeRun) {
    resetHomeRoom(sim);
    return;
  }
  const level = clampLevel(fromLevel);
  sim.runStartTick = sim.tick;
  sim.hordesBehind = 0;
  sim.gameOver = null;
  sim.departed.clear();
  enterTown(sim, level);

  for (const p of sim.players) {
    placeAtEntry(sim, p);
    p.status = 'alive';
    p.health = p.maxHealth;
    p.score = 0;
    p.kills = 0;
    p.keepsakes = [];
    p.keepsakeOffer = null;
    p.dryFireCooldown = 0;
    const isPastFirstLevel = level > FIRST_LEVEL;
    if (isPastFirstLevel) giveReturnKit(p);
    else giveStartingLoadout(p);
  }
  announceRunStart(sim);
}
