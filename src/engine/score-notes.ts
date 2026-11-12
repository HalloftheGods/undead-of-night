import { chainMultiplier } from '../../shared/kill-chain.ts';
import type { GameEvent } from '../../shared/protocol.ts';

/** The text over a kill: what it paid, and the chain's multiplier when the chain changed that. */
export function killNote(event: Extract<GameEvent, { type: 'zombie_die' }>): string {
  const bonus = event.chainPaid ? ` x${chainMultiplier(event.chain ?? 1)}` : '';
  return `+${event.points} XP${bonus}`;
}

/** The text over a head hit: the bonus when the shot paid, and the streak count past the first. */
export function headshotNote(event: Extract<GameEvent, { type: 'headshot' }>): string {
  const paid = event.points > 0 ? ` +${event.points} XP` : '';
  const chain = event.chain ?? 1;
  const streak = chain > 1 ? ` x${chain}` : '';
  return `HEADSHOT${paid}${streak}`;
}
