import type { EntityId, GameEvent } from '../../shared/protocol.ts';

/** Kills by the same player this close together make a chain; the sim pays chains on the same window (CHAIN_WINDOW_SEC in shared/kill-chain.ts). */
export const CHAIN_WINDOW_MS = 1400;
/** A kill at or under this share of health is a close call. */
export const CLOSE_CALL_HEALTH = 0.2;
/** One close call in this long: being low is a state, the callout is a moment. */
export const CLOSE_CALL_REPEAT_MS = 8000;

/** How long each kind of kill holds the picture still, in milliseconds. */
export const FREEZE_MS = {
  headshot: 45,
  brute: 110,
  chain: 35,
  hordeWiped: 260,
  /** A boss down is the biggest moment in a town: hold it long enough to land. */
  boss: 420,
} as const;
/** The white wash when a boss falls. Reduced motion skips it in ScreenEffects. */
const BOSS_FLASH = 0.6;

/** The words a chain earns, by its length. Past the last row the count is printed. */
const CHAIN_WORDS: Readonly<Record<number, string>> = { 2: 'DOUBLE', 3: 'TRIPLE', 4: 'QUAD' };

export type CalloutTone = 'chain' | 'close' | 'stamp';

export interface CalloutWords {
  readonly text: string;
  readonly tone: CalloutTone;
}

/** What one snapshot's events add up to on screen: a held frame, a flash and a word or two. */
export interface JuiceBeat {
  readonly freezeMs: number;
  /** 0..1, a white wash that fades. */
  readonly flash: number;
  readonly callout: CalloutWords | null;
  /** The last of a horde fell, rather than the horde giving up: the banner says so instead of a callout. */
  readonly hordeWiped: boolean;
}

export function chainWords(count: number): string | null {
  const isNoChain = count < 2;
  if (isNoChain) return null;
  return CHAIN_WORDS[count] ?? `MASSACRE x${count}`;
}

/**
 * Reads the kills in each snapshot for the moments worth a beat: a headshot, a brute down, a chain
 * of kills, a kill on the edge of death, and the last of a horde. It only reads events, so play
 * is the same with it or without it.
 */
export class KillJuice {
  private chain = 0;
  private lastKillMs = Number.NEGATIVE_INFINITY;
  private lastCloseCallMs = Number.NEGATIVE_INFINITY;

  reset(): void {
    this.chain = 0;
    this.lastKillMs = Number.NEGATIVE_INFINITY;
    this.lastCloseCallMs = Number.NEGATIVE_INFINITY;
  }

  /** `health` is the local player's share of health after the snapshot, 0 when not on their feet. */
  read(events: readonly GameEvent[], localId: EntityId | null, health: number, now: number): JuiceBeat | null {
    let freezeMs = 0;
    let kills = 0;
    let anyKill = false;
    let cleared = false;
    let bossDown = false;
    for (const event of events) {
      if (event.type === 'zombie_die') {
        anyKill = true;
        const isNotMine = event.killerId === null || event.killerId !== localId;
        if (isNotMine) continue;
        kills += 1;
        const isBrute = event.zombieType === 'brute';
        if (isBrute) freezeMs = Math.max(freezeMs, FREEZE_MS.brute);
      } else if (event.type === 'headshot' && event.playerId === localId) {
        freezeMs = Math.max(freezeMs, FREEZE_MS.headshot);
      } else if (event.type === 'wave_clear') {
        cleared = true;
      } else if (event.type === 'boss_down') {
        // Whoever landed it: the boss is the whole town's fight, so everyone gets the beat.
        bossDown = true;
      }
    }
    if (bossDown) freezeMs = Math.max(freezeMs, FREEZE_MS.boss);
    const flash = bossDown ? BOSS_FLASH : 0;
    const hordeWiped = cleared && anyKill;
    if (hordeWiped) {
      return { freezeMs: Math.max(freezeMs, FREEZE_MS.hordeWiped), flash: Math.max(flash, 0.45), callout: null, hordeWiped };
    }
    const hasNoKills = kills === 0;
    if (hasNoKills) return freezeMs > 0 ? { freezeMs, flash, callout: null, hordeWiped } : null;

    const chained = now - this.lastKillMs <= CHAIN_WINDOW_MS;
    this.chain = (chained ? this.chain : 0) + kills;
    this.lastKillMs = now;
    const chain = chainWords(this.chain);
    if (chain) freezeMs = Math.max(freezeMs, FREEZE_MS.chain);

    const onTheEdge = health > 0 && health <= CLOSE_CALL_HEALTH && now - this.lastCloseCallMs > CLOSE_CALL_REPEAT_MS;
    const isCloseCall = onTheEdge && !chain;
    if (isCloseCall) {
      this.lastCloseCallMs = now;
      return { freezeMs: Math.max(freezeMs, FREEZE_MS.chain), flash, callout: { text: 'CLOSE CALL', tone: 'close' }, hordeWiped };
    }
    const callout: CalloutWords | null = chain ? { text: chain, tone: 'chain' } : null;
    const nothing = freezeMs === 0 && callout === null;
    return nothing ? null : { freezeMs, flash, callout, hordeWiped };
  }
}
