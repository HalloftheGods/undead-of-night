/**
 * What got you, for the Game Over screen: the kind of zombie whose swing landed the blow that put you down,
 * and how many shots you fired in the ten seconds before. Built only from events the run already sends; when
 * nothing names the killer the line is left out rather than guessed.
 *
 * A swing is announced (`zombie_attack`, at the zombie) when it winds up and lands later as `player_hurt`
 * (at the survivor), so a hurt is matched to the nearest swing that started shortly before it.
 */
import type { EntityId, GameEvent, ZombieType } from '../../shared/protocol.ts';

/** A swing winds up for well under this before it lands. */
const SWING_MEMORY_MS = 2500;
/** A swing that started further than this from where the blow landed was meant for someone else. */
const SWING_REACH = 96;
/** A burst and the hurt it causes arrive together; this allows for them landing a frame apart. */
const BURST_SAME_BEAT_MS = 150;
/** The window the shot count covers. */
export const SHOTS_WINDOW_MS = 10_000;

export type Killer = ZombieType | 'burst';

export interface DeathCause {
  /** What landed the last blow before you went down, or null when nothing in the events says. */
  readonly killer: Killer | null;
  /** Your shots in the SHOTS_WINDOW_MS before you went down. */
  readonly shots: number;
}

interface Swing {
  readonly type: ZombieType;
  readonly x: number;
  readonly y: number;
  readonly ms: number;
}

interface Burst {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly ms: number;
}

export class DeathWitness {
  private swings: Swing[] = [];
  private burst: Burst | null = null;
  private shotTimes: number[] = [];
  private lastBlow: Killer | null = null;
  private fallen: DeathCause | null = null;
  /** Down and not yet back up: dying from there keeps the cause of the fall. */
  private down = false;

  /** A new run: nothing from the last one carries over. */
  reset(): void {
    this.swings = [];
    this.burst = null;
    this.shotTimes = [];
    this.lastBlow = null;
    this.fallen = null;
    this.down = false;
  }

  /** One event, as the run hands it over; `localId` is this player. */
  see(event: GameEvent, localId: EntityId | null, nowMs: number): void {
    const isMine = localId !== null && 'playerId' in event && event.playerId === localId;
    switch (event.type) {
      case 'zombie_attack':
        this.swings = [...this.recentSwings(nowMs), { type: event.zombieType, x: event.x, y: event.y, ms: nowMs }];
        break;
      case 'bloater_burst':
        this.burst = { x: event.x, y: event.y, radius: event.radius, ms: nowMs };
        break;
      case 'shot':
        if (isMine) this.shotTimes = [...this.shotTimes.filter((ms) => nowMs - ms <= SHOTS_WINDOW_MS), nowMs];
        break;
      case 'player_hurt':
        if (isMine) this.lastBlow = this.blowAt(event.x, event.y, nowMs);
        break;
      case 'player_downed':
        if (isMine) this.fall(nowMs);
        break;
      case 'player_dead':
        if (isMine && !this.down) this.fall(nowMs);
        if (isMine) this.down = false;
        break;
      case 'player_revived':
        if (isMine) this.down = false;
        break;
      default:
        break;
    }
  }

  /** Each fall replaces the last: a Campaign survivor can die again after waking in the bunker. */
  private fall(nowMs: number): void {
    this.fallen = { killer: this.lastBlow, shots: this.shotsBefore(nowMs) };
    this.lastBlow = null;
    this.down = true;
  }

  /** How the last fall happened, or null if this player never went down. */
  cause(): DeathCause | null {
    return this.fallen;
  }

  private recentSwings(nowMs: number): Swing[] {
    return this.swings.filter((swing) => nowMs - swing.ms <= SWING_MEMORY_MS);
  }

  private shotsBefore(nowMs: number): number {
    return this.shotTimes.filter((ms) => nowMs - ms <= SHOTS_WINDOW_MS).length;
  }

  /** The burst that just went off around this spot, else the nearest recent swing in reach, else nothing known. */
  private blowAt(x: number, y: number, nowMs: number): Killer | null {
    const burst = this.burst;
    const caughtInBurst = burst !== null && nowMs - burst.ms <= BURST_SAME_BEAT_MS && Math.hypot(burst.x - x, burst.y - y) <= burst.radius + SWING_REACH;
    if (caughtInBurst) return 'burst';
    const inReach = this.recentSwings(nowMs)
      .map((swing) => ({ swing, gap: Math.hypot(swing.x - x, swing.y - y) }))
      .filter((each) => each.gap <= SWING_REACH)
      .sort((a, b) => a.gap - b.gap || b.swing.ms - a.swing.ms);
    return inReach[0]?.swing.type ?? null;
  }
}

const KILLER_WORDS: Readonly<Record<Killer, string>> = {
  walker: 'A walker got you.',
  runner: 'A runner got you.',
  bloater: 'A bloater got you.',
  brute: 'A brute got you.',
  screamer: 'A screamer got you.',
  burst: 'A bloater burst on you.',
};

/** "A runner got you. 6 shots in the last 10 seconds." Null when the killer is not known. */
export function deathLine(cause: DeathCause | null): string | null {
  const killer = cause?.killer ?? null;
  if (cause === null || killer === null) return null;
  const seconds = SHOTS_WINDOW_MS / 1000;
  const shots = cause.shots === 0 ? 'No shots fired' : `${cause.shots} ${cause.shots === 1 ? 'shot' : 'shots'}`;
  return `${KILLER_WORDS[killer]} ${shots} in the last ${seconds} seconds.`;
}

/** The run's one witness. The run's event feed fills it; the Game Over screen reads it. */
export const deathWitness = new DeathWitness();
