// The title's controller hint: nothing without a pad, a ready line once the browser has shown one,
// a warning for a pad it cannot map. Browsers only show a pad after a button press, so a pad pressed
// during the studio splash is seen here before the player has done anything on the title.

import { fillPadPrompt } from './pad-glyphs.ts';

export interface PadSeen {
  /** The first pad on the standard layout, or null. */
  readonly id: string | null;
  /** The first pad the browser could not map, or null. */
  readonly unsupportedId: string | null;
}

export const PAD_READY_LINE = 'Controller ready. Press any button.';
/** Shown in the pad's own words: Cross and Circle on a PlayStation pad, B and A on a Switch one. */
export const PAD_KEYS_LINE = '{a}: confirm   {b}: back   {start}: pause';
export const PAD_UNSUPPORTED_LINE = 'Controller not recognised. Try Chrome or Edge, or set the pad to X-input mode.';

/** Reduces `getGamepads()` to what the hint needs. */
export function summarisePads(pads: readonly { readonly id: string; readonly mapping: string }[]): PadSeen {
  return {
    id: pads.find((pad) => pad.mapping === 'standard')?.id ?? null,
    unsupportedId: pads.find((pad) => pad.mapping !== 'standard')?.id ?? null,
  };
}

/** The lines under the title prompt. Empty with no pad at all, so a keyboard player sees nothing extra. */
export function padHintLines(seen: PadSeen): string[] {
  if (seen.id !== null) return [PAD_READY_LINE, fillPadPrompt(PAD_KEYS_LINE, seen.id)];
  if (seen.unsupportedId !== null) return [PAD_UNSUPPORTED_LINE];
  return [];
}
