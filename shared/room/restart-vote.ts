import type { GameSimulation } from '../simulation.ts';
import type { HostClock } from './peer.ts';

export interface Voter {
  wantsRestart: boolean;
}

export interface RestartVote<C extends Voter> {
  /** Cancels a pending wait. */
  end(): void;
  /** Restarts the run if everyone still here has asked. */
  restartIfAgreed(): void;
  /** Records a Play Again and starts the wait if it is the first. */
  ask(client: C): void;
}

export function createRestartVote<C extends Voter>(sim: GameSimulation, joined: () => C[], voteMs: number, clock: HostClock): RestartVote<C> {
  let timer: unknown = null;

  function end(): void {
    const isVoteRunning = timer !== null;
    if (isVoteRunning) clock.cancel(timer);
    timer = null;
  }

  function restartRun(): void {
    end();
    for (const client of joined()) client.wantsRestart = false;
    sim.restart();
  }

  /** The run restarts once everyone still here has asked, or when the first asker's wait runs out. */
  function restartIfAgreed(): void {
    const room = joined();
    const agreed = sim.phase === 'gameover' && room.length > 0 && room.every((client) => client.wantsRestart);
    if (agreed) restartRun();
  }

  function restartAfterWaiting(): void {
    timer = null;
    const stillWanted = sim.phase === 'gameover' && joined().some((client) => client.wantsRestart);
    if (stillWanted) restartRun();
  }

  function ask(client: C): void {
    const isRunStillGoing = sim.phase !== 'gameover';
    if (isRunStillGoing) return;
    client.wantsRestart = true;
    restartIfAgreed();
    const waiting = sim.phase === 'gameover' && timer === null;
    if (waiting) timer = clock.after(voteMs, restartAfterWaiting);
  }

  return { end, restartIfAgreed, ask };
}
