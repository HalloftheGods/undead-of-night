// What the overrun clock shows, worded from the room's `OverrunView`. No drawing.

import type { OverrunView } from '../../shared/home-protocol.ts';
import { formatDuration } from './hud-state.ts';

export interface OverrunClockLine {
  /** Counting down to the door, or the horde still to kill once it has burst. */
  readonly label: string;
  readonly value: string;
  /** The clock is running at the menu rate. Only while it counts down. */
  readonly slowed: boolean;
  /** The last stretch, with the guns free. */
  readonly urgent: boolean;
}

/** The clock's line, or null when it has nothing to say: no overrun, or one already settled. */
export function overrunClockLine(overrun: OverrunView | null): OverrunClockLine | null {
  if (!overrun) return null;
  switch (overrun.phase) {
    case 'counting':
    case 'armed':
      return { label: 'FENCE', value: formatDuration(Math.ceil(overrun.left)), slowed: overrun.slowed, urgent: overrun.phase === 'armed' };
    case 'breached':
      return { label: 'HOSTILES', value: String(overrun.hostiles), slowed: false, urgent: true };
    default:
      return null;
  }
}
