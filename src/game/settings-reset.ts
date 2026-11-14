// Runs first, before any setting is read: a browser that has not been reset for the original release starts again.
// Settings and controls go back to their defaults, once. Saves, records and consent are left alone.

import { ORIGINAL_RELEASE_DATE } from './release.ts';

export const SETTINGS_RESET_KEY = 'outbreak.settings-reset';
export const CAMP_RESET_KEY = 'outbreak.camp-reset';

/** Every preference and binding. Not progress (home, progression, records, daily, stamps) and not analytics consent. */
export const SETTINGS_KEYS: readonly string[] = [
  'outbreak.controls.keys',
  'outbreak.controls.pad',
  'outbreak.display',
  'outbreak.style',
  'outbreak.motion',
  'outbreak.shake',
  'outbreak.prefs',
  'outbreak.difficulty',
  'outbreak.menuInfo',
  'outbreak.hints',
  'outbreak.swipe',
  'outbreak.haptics',
  'outbreak_canvas_menus',
  'outbreak_canvas_loot',
  'outbreak_autoclose_empty_loot',
  'outbreak-zero.audio',
];

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** True when this browser has been reset for the original release (or has nothing older to reset). */
export function isReset(store: Pick<Storage, 'getItem'>, key: string): boolean {
  return store.getItem(key) === ORIGINAL_RELEASE_DATE;
}

export function markReset(store: Pick<Storage, 'setItem'>, key: string): void {
  store.setItem(key, ORIGINAL_RELEASE_DATE);
}

/** Returns whether it cleared anything. Safe to call every boot. */
export function resetOlderSettings(store: Store | null): boolean {
  if (!store) return false;
  try {
    if (isReset(store, SETTINGS_RESET_KEY)) return false;
    for (const key of SETTINGS_KEYS) store.removeItem(key);
    markReset(store, SETTINGS_RESET_KEY);
    return true;
  } catch {
    return false;
  }
}

function browserStore(): Store | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

resetOlderSettings(browserStore());
