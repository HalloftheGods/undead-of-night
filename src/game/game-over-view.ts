/**
 * What the Game Over screen offers, worked out away from the component so it can be tested: the one big
 * button (try this town again where the mode allows it) and the quieter way back to the start.
 */
import { townName } from '../../shared/levels.ts';
import type { GameStyle } from '../../shared/game-style.ts';
import type { TransportKind } from '../network/transport.ts';
import { continuesAfterDeath } from './play-flow.ts';

export interface RetryPlan {
  /** The big button's words. */
  readonly label: string;
  /** The level the big button starts at; undefined lets the session pick (level 1, or a Daily's own town). */
  readonly fromLevel: number | undefined;
  /** A quieter second button that starts the run again from the first town, when the big one does not. */
  readonly startOver: boolean;
}

export interface RetryFacts {
  readonly mode: TransportKind;
  readonly runStyle: GameStyle | null;
  /** The level the run died on. */
  readonly level: number;
  readonly daily: boolean;
}

/**
 * Solo Arcade goes back to the town you died in, with Start over beside it once that is past the first.
 * A Daily Night replays its own town. Co-op always restarts the room at level 1, so it says only Play again.
 */
export function retryPlan(facts: RetryFacts): RetryPlan {
  const town = townName(facts.level);
  if (facts.daily) return { label: `Try again in ${town}`, fromLevel: undefined, startOver: false };
  const canRetryTown = continuesAfterDeath(facts.mode, facts.runStyle);
  const isPastFirst = facts.level > 1;
  if (canRetryTown) return { label: `Try again from ${town}`, fromLevel: facts.level, startOver: isPastFirst };
  return { label: 'Play again', fromLevel: undefined, startOver: false };
}
