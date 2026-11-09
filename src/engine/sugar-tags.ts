// The candy timer over a survivor's head: one line per candy working, the stat it boosts and the
// seconds left, over a bar that drains for the whole boost. Shown over teammates too, so a team can
// see who is fast, armoured or hitting hard right now.

import { CANDIES, candySeconds } from '../../shared/candy.ts';
import type { PlayerEntity } from '../../shared/protocol.ts';
import { FONT_HEIGHT, textWidth } from './bitmap-font.ts';

/** Seconds left at which the line starts blinking: the boost is about to wear off. */
export const SUGAR_WARN_SEC = 5;
const SUGAR_BLINKS_PER_SEC = 3;
/** The bar under each line. */
export const SUGAR_BAR_WIDTH = 20;
/** Glyphs, their outline, and the bar's outline under them. */
export const SUGAR_LINE_GAP = FONT_HEIGHT + 2;
/** One whole line: words, bar and a clear pixel before the next. */
export const SUGAR_ROW_HEIGHT = SUGAR_LINE_GAP + 5;

export interface SugarTag {
  /** "SPEED 42": the stat and the whole seconds left. */
  readonly label: string;
  /** How much of the boost is left, 1 just eaten to 0 worn off. */
  readonly fraction: number;
  /** False on the dark beat of the last seconds' blink. */
  readonly lit: boolean;
}

/** What each candy working on this survivor shows, in the order they were eaten. None unless alive. */
export function sugarTags(player: Pick<PlayerEntity, 'status' | 'sugar'>, time: number): SugarTag[] {
  const isAlive = player.status === 'alive';
  if (!isAlive) return [];
  const blinkOn = Math.floor(time * SUGAR_BLINKS_PER_SEC * 2) % 2 === 0;
  return (player.sugar ?? []).map((sugar) => {
    const seconds = Math.max(0, Math.ceil(sugar.left));
    const wearingOff = sugar.left <= SUGAR_WARN_SEC;
    return {
      label: `${CANDIES[sugar.id].stat} ${seconds}`,
      fraction: Math.max(0, Math.min(1, sugar.left / Math.max(sugar.total ?? candySeconds(sugar.id), 1e-9))),
      lit: !wearingOff || blinkOn,
    };
  });
}

/** How wide the block of lines is, so pickup notes can keep clear of it. */
export function sugarTagsWidth(tags: readonly SugarTag[]): number {
  return tags.reduce((widest, tag) => Math.max(widest, textWidth(tag.label) + 2), SUGAR_BAR_WIDTH + 2);
}

/** A patch of the world, in world pixels, that pickup notes must not be drawn over. */
export interface KeepOut {
  /** Centre x. */
  readonly x: number;
  readonly top: number;
  readonly bottom: number;
  readonly width: number;
}
