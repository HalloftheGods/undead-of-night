import { BACKPACK, HORN, PAUSE, SEARCH, SHOVE, SPRINT } from './touch-pad.ts';
import type { PadGlyph } from './touch-pad.ts';

/** Held to sprint, the same key the keyboard holds (game/input-manager.ts). */
export const SPRINT_CODE = 'ShiftLeft';

/**
 * One tab on the phone's bottom bar. A `hold` tab presses its key for as long as the finger is
 * down; a `tap` tab does its one thing on the press.
 */
export type TouchTab =
  | { readonly id: 'search' | 'shove' | 'sprint' | 'horn'; readonly label: string; readonly glyph: PadGlyph; readonly kind: 'hold'; readonly code: string }
  | { readonly id: 'pause' | 'backpack'; readonly label: string; readonly glyph: PadGlyph; readonly kind: 'tap' };

/**
 * Left to right across the foot of the screen. Pause sits under the left thumb, which is busy
 * walking and only lifts to stop; Sprint takes the right end, where the right thumb rests and can
 * hold it down a whole street between shots.
 */
export const TOUCH_TABS: readonly TouchTab[] = [
  { id: 'pause', label: 'Pause', glyph: PAUSE, kind: 'tap' },
  { id: 'backpack', label: 'Pack', glyph: BACKPACK, kind: 'tap' },
  { id: 'search', label: 'Search', glyph: SEARCH, kind: 'hold', code: 'KeyE' },
  { id: 'shove', label: 'Shove', glyph: SHOVE, kind: 'hold', code: 'KeyF' },
  { id: 'sprint', label: 'Sprint', glyph: SPRINT, kind: 'hold', code: SPRINT_CODE },
];

/** Held to honk: the keyboard's default horn key (game/controls-prefs.ts). */
export const HORN_CODE = 'Space';

/** The bar's tabs; the horn joins it, ahead of Sprint, only while the player sits in a car. */
export function touchTabsFor(seated: boolean): readonly TouchTab[] {
  if (!seated) return TOUCH_TABS;
  const horn: TouchTab = { id: 'horn', label: 'Horn', glyph: HORN, kind: 'hold', code: HORN_CODE };
  const sprintAt = TOUCH_TABS.findIndex((tab) => tab.id === 'sprint');
  return [...TOUCH_TABS.slice(0, sprintAt), horn, ...TOUCH_TABS.slice(sprintAt)];
}

/** The Shove tab says Stab once a knife is carried, as the empty-gun hint does. */
export function tabLabel(tab: TouchTab, hasKnife: boolean): string {
  const isStab = tab.id === 'shove' && hasKnife;
  return isStab ? 'Stab' : tab.label;
}
