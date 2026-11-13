// What the overrun looks like on the bunker floor, read from the room's view and this player's own receipt.

import { fallenOf } from '../../shared/camp/fence-fall.ts';
import { OVERRUN_CLOCK_SEC, OVERRUN_WARNINGS } from '../../shared/overrun.ts';
import type { OverrunView } from '../../shared/home-protocol.ts';
import type { PlayerEntity } from '../../shared/protocol.ts';

export type DoorState = 'shut' | 'buckling' | 'burst';

/** The warning that sets the door buckling: the second, a quarter of the clock left. */
const BUCKLING_WARNING = 1;

/** The blast door is drawn only while the overrun is switched on, so a bunker without it looks as it always has. */
export function hiddenProp(kind: string, overrunOn: boolean): boolean {
  return kind === 'blast_door' && !overrunOn;
}

/** Shut until the second warning, buckling until the breach, then burst for as long as the overrun is on show. */
export function doorState(overrun: OverrunView | undefined): DoorState {
  if (!overrun) return 'shut';
  const breached = overrun.phase === 'breached' || overrun.phase === 'held' || overrun.phase === 'lost';
  if (breached) return 'burst';
  const buckleAt = (overrun.spanSec ?? OVERRUN_CLOCK_SEC) * OVERRUN_WARNINGS[BUCKLING_WARNING];
  return overrun.left <= buckleAt ? 'buckling' : 'shut';
}

export type FenceState = 'whole' | 'rattling' | 'down';

/** A camp fence section: rattling while the clock is armed if it is one that will give, then down from the breach to the next arrival. */
export function fenceState(overrun: OverrunView | undefined, index: number): FenceState {
  const gives = overrun?.gaps?.includes(index) === true;
  if (!gives) return 'whole';
  if (fallenOf(overrun).includes(index)) return 'down';
  return overrun?.phase === 'armed' ? 'rattling' : 'whole';
}

/** The chest stands from the hold until this player opens theirs, and only for a player who has one: their own view says so, nobody else's. */
export function chestPending(overrun: OverrunView | undefined, local: PlayerEntity | null): boolean {
  return overrun?.phase === 'held' && local?.home?.chest === true;
}
