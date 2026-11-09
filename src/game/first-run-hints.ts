// Contextual first-run hints: each one said once, at the moment it matters, then never again.
// Pure decisions and wording here; run-hud.ts feeds the facts and publishes the line, HudOverlay draws it.

import { BUNKER_LEVEL } from '../../shared/home-protocol.ts';
import type { GamePhase } from '../../shared/protocol.ts';
import { browserStore, readJson, writeJson } from './storage.ts';
import type { Store } from './storage.ts';
import { fireGlyph, keyGlyph } from './hud-keys.ts';
import type { ControlDevice } from './hud-keys.ts';
import { padFamily, padLabel } from './pad-glyphs.ts';
import { PAD } from './gamepad-input.ts';

export type HintId = 'controls' | 'search' | 'bowl' | 'van' | 'horde';

export const HINT_IDS: readonly HintId[] = ['controls', 'search', 'bowl', 'van', 'horde'];

const HINTS_KEY = 'outbreak.hints';

/** How long a hint stays up. */
export const HINT_MS = 6000;
/** The horde line comes this many seconds before the horde. */
export const HORDE_WARNING_SEC = 10;

/** What a hint is told about the moment. */
export interface HintFacts {
  readonly level: number;
  readonly phase: GamePhase;
  readonly wave: number;
  /** Seconds to the next horde while the town is quiet. */
  readonly intermission: number;
  /** Hordes this town sends before the van. */
  readonly hordes: number;
  readonly exitOpen: boolean;
  /** On their feet with nothing over the game. */
  readonly free: boolean;
  /** The nearest thing in reach: a shut piece of furniture, a candy bowl, or nothing. */
  readonly near: 'container' | 'bowl' | null;
}

/** What to say, and which of the player's inputs to say it for. */
export interface HintWords {
  readonly device: ControlDevice;
  readonly padId?: string | null;
}

/** The line a hint says. Touch has no keys, a pad has its own buttons. */
export function hintText(id: HintId, facts: Pick<HintFacts, 'hordes'>, words: HintWords): string {
  const { device } = words;
  const padId = words.padId ?? null;
  const family = padFamily(padId);
  switch (id) {
    case 'controls':
      if (device === 'touch') return 'Left thumb: move. Touch to aim and fire.';
      if (device === 'pad') return `Left stick: move. Right stick: aim. ${fireGlyph(padId)}: fire.`;
      return 'WASD: move. Mouse: aim. Click: fire.';
    case 'search': {
      if (device === 'touch') return 'Hold the Search button to loot this.';
      const glyph = keyGlyph('KeyE', device, padId) ?? 'E';
      return `Hold ${glyph} to search.`;
    }
    case 'bowl':
      return device === 'touch' ? 'A candy bowl by the door. Hold Search to take candy.' : `A candy bowl by the door. Hold ${keyGlyph('KeyE', device, padId) ?? 'E'} for candy.`;
    case 'van':
      return `The van comes after ${facts.hordes} hordes.`;
    case 'horde':
      return `Horde in ${HORDE_WARNING_SEC} seconds. ${device === 'touch' ? 'Get ready.' : `Reload (${keyGlyph('KeyR', device, padId) ?? padLabel(family, PAD.x)}) and find cover.`}`;
  }
}

/**
 * The hint this moment calls for, or null. Priority is urgency: the horde, then what is underfoot,
 * then the van, then the controls. The bunker has its own teaching, so only the controls show there.
 */
export function pickHint(facts: HintFacts, seen: ReadonlySet<HintId>): HintId | null {
  if (!facts.free) return null;
  const home = facts.level === BUNKER_LEVEL;
  const want = (id: HintId): boolean => !seen.has(id);
  if (home) return want('controls') ? 'controls' : null;
  const quiet = facts.phase === 'intermission';
  const soon = quiet && facts.intermission > 0 && facts.intermission <= HORDE_WARNING_SEC;
  if (soon && want('horde')) return 'horde';
  if (facts.near === 'bowl' && want('bowl')) return 'bowl';
  if (facts.near === 'container' && want('search')) return 'search';
  const firstHordeDown = quiet && facts.wave >= 1 && !facts.exitOpen;
  if (firstHordeDown && want('van')) return 'van';
  return want('controls') ? 'controls' : null;
}

/** Hints already shown, from storage. */
export function loadSeenHints(store: Store | null = browserStore()): Set<HintId> {
  const saved = readJson(store, HINTS_KEY);
  const list = Array.isArray(saved) ? saved : [];
  return new Set(HINT_IDS.filter((id) => list.includes(id)));
}

export function saveSeenHints(seen: ReadonlySet<HintId>, store: Store | null = browserStore()): void {
  writeJson(store, HINTS_KEY, [...seen]);
}

let resets = 0;

/**
 * The Options "Reset hints" switch calls this: every hint will be said once more, from the next
 * moment it applies (a run in progress picks it up on its next beat).
 */
export function resetFirstRunHints(store: Store | null = browserStore()): void {
  resets += 1;
  writeJson(store, HINTS_KEY, []);
}

/** How many hints have been shown, for a label such as "Reset hints (3 of 5 seen)". */
export function seenHintCount(store: Store | null = browserStore()): number {
  return loadSeenHints(store).size;
}

/** The hint on screen: which one, and a key that changes so the entrance replays. */
export interface HintLine {
  readonly key: number;
  readonly id: HintId;
  /** The facts-dependent part of the words, resolved when it was chosen. */
  readonly hordes: number;
}

/** Decides when a hint goes up and down, and remembers what has been said. */
export class HintTracker {
  private seen: Set<HintId>;
  private readonly store: Store | null;
  private key = 0;
  private untilMs = 0;
  private resetsSeen = resets;

  constructor(store: Store | null = browserStore()) {
    this.store = store;
    this.seen = loadSeenHints(store);
  }

  /** A new run keeps what has been said; only a Reset hints starts the lessons over. */
  private sync(): void {
    if (this.resetsSeen === resets) return;
    this.resetsSeen = resets;
    this.seen = loadSeenHints(this.store);
  }

  /** What to show now: a new line, 'clear' once one has run its time, or null for no change. */
  step(facts: HintFacts, now: number, showing: boolean): HintLine | 'clear' | null {
    this.sync();
    if (showing && now > this.untilMs) return 'clear';
    if (showing) return null;
    const id = pickHint(facts, this.seen);
    if (id === null) return null;
    this.seen.add(id);
    saveSeenHints(this.seen, this.store);
    this.key += 1;
    this.untilMs = now + HINT_MS;
    return { key: this.key, id, hordes: facts.hordes };
  }

  /** A hint met its moment elsewhere (the horde came before the warning fired): count it as said. */
  skip(id: HintId): void {
    if (this.seen.has(id)) return;
    this.seen.add(id);
    saveSeenHints(this.seen, this.store);
  }
}
