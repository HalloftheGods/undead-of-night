// The local survivor saying something on their own: a line on picking an item up or dropping one, in their voice
// (inventory/survivor-voices.ts). Plain state: the snapshot handler and the bag say what happened, and the emote
// overlay (engine/emote-overlay.ts) draws the line over the survivor while it lasts.

import { voiceOf, type SpeechKind } from './inventory/survivor-voices.ts';

/** How long a line stays up, in ms. */
export const SPEECH_MS = 2200;
/** A pickup line waits this long after the last line, so walking over a pile is not a monologue. Drops always speak. */
export const PICKUP_QUIET_MS = 4000;

interface Said {
  readonly kind: SpeechKind;
  readonly at: number;
  /** Which of the voice's lines: each new line takes the next, so the same one does not come twice in a row. */
  readonly turn: number;
}

let said: Said | null = null;
let turns = 0;

/** The survivor says a `kind` line now, unless a pickup comes too soon after the last line. True when they spoke. */
export function speak(kind: SpeechKind, at: number): boolean {
  const tooSoon = kind === 'pickup' && said !== null && at - said.at < PICKUP_QUIET_MS;
  if (tooSoon) return false;
  turns += 1;
  said = { kind, at, turn: turns };
  return true;
}

/** The line up now, in this survivor's voice, or null when they are quiet. */
export function speechNow(skin: number, at: number): { readonly line: string; readonly kind: SpeechKind } | null {
  if (said === null || at - said.at >= SPEECH_MS || at < said.at) return null;
  const lines = voiceOf(skin)[said.kind];
  return { line: lines[said.turn % lines.length], kind: said.kind };
}

/** A new run, or a test: nobody is talking. */
export function hush(): void {
  said = null;
}
