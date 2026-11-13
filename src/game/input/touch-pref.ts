/**
 * Touch control settings: swipe sensitivity and haptic feedback.
 * Follows the pattern of motion-pref.ts for localStorage persistence.
 */

/** Default swipe sensitivity (1.0 = normal). */
export const DEFAULT_SWIPE_SENSITIVITY = 1;
/** Default haptic feedback state. */
export const DEFAULT_HAPTICS_ENABLED = true;

const SWIPE_KEY = 'outbreak.swipe';
const HAPTICS_KEY = 'outbreak.haptics';

type Store = Pick<Storage, 'getItem' | 'setItem'>;

/** localStorage can throw on access alone in a private window or a locked-down frame. */
function browserStore(): Store | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** Clamps swipe sensitivity to valid range (0.5-2.0). */
export function clampSwipeSensitivity(value: unknown): number {
  const isNumber = typeof value === 'number' && Number.isFinite(value);
  if (!isNumber) return DEFAULT_SWIPE_SENSITIVITY;
  return Math.min(2, Math.max(0.5, value));
}

/** Loads swipe sensitivity from storage. */
export function loadSwipeSensitivity(store: Store | null = browserStore()): number {
  try {
    const saved = store?.getItem(SWIPE_KEY);
    const hasSaved = typeof saved === 'string' && saved.trim() !== '';
    if (!hasSaved) return DEFAULT_SWIPE_SENSITIVITY;
    return clampSwipeSensitivity(Number(saved));
  } catch {
    return DEFAULT_SWIPE_SENSITIVITY;
  }
}

/** Saves swipe sensitivity to storage. */
export function saveSwipeSensitivity(sensitivity: number, store: Store | null = browserStore()): void {
  try {
    store?.setItem(SWIPE_KEY, String(clampSwipeSensitivity(sensitivity)));
  } catch {
    // Best-effort: setting still applies for this visit
  }
}

/** Loads haptic feedback preference from storage. */
export function loadHapticsEnabled(store: Store | null = browserStore()): boolean {
  try {
    const saved = store?.getItem(HAPTICS_KEY);
    if (saved === null || saved === undefined) return DEFAULT_HAPTICS_ENABLED;
    return saved === 'true';
  } catch {
    return DEFAULT_HAPTICS_ENABLED;
  }
}

/** Saves haptic feedback preference to storage. */
export function saveHapticsEnabled(enabled: boolean, store: Store | null = browserStore()): void {
  try {
    store?.setItem(HAPTICS_KEY, String(enabled));
  } catch {
    // Best-effort: setting still applies for this visit
  }
}

/** Touch control preferences bundle. */
export interface TouchPrefs {
  swipeSensitivity: number;
  hapticsEnabled: boolean;
}

/** Loads all touch preferences from storage. */
export function loadTouchPrefs(store: Store | null = browserStore()): TouchPrefs {
  return {
    swipeSensitivity: loadSwipeSensitivity(store),
    hapticsEnabled: loadHapticsEnabled(store),
  };
}

/** Saves all touch preferences to storage. */
export function saveTouchPrefs(prefs: TouchPrefs, store: Store | null = browserStore()): void {
  saveSwipeSensitivity(prefs.swipeSensitivity, store);
  saveHapticsEnabled(prefs.hapticsEnabled, store);
}
