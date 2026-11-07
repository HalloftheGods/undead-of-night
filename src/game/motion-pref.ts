// The player's Motion setting: follow the system, or override it either way. Pure, so the specs need no window.

/** What the player picked on the Options page. */
export type MotionPref = 'system' | 'full' | 'reduced';
/** What the game actually does once the system has had its say. */
export type MotionLevel = 'full' | 'reduced';

export const MOTION_PREFS: readonly MotionPref[] = ['system', 'full', 'reduced'];
export const DEFAULT_MOTION_PREF: MotionPref = 'system';
/** Screen shake as a share of full strength. */
export const DEFAULT_SHAKE_LEVEL = 1;

const MOTION_KEY = 'outbreak.motion';
const SHAKE_KEY = 'outbreak.shake';

type Store = Pick<Storage, 'getItem' | 'setItem'>;

/** localStorage can throw on access alone in a private window or a locked-down frame. */
function browserStore(): Store | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function isMotionPref(value: unknown): value is MotionPref {
  return MOTION_PREFS.includes(value as MotionPref);
}

/** System follows prefers-reduced-motion; Full and Reduced ignore it. */
export function resolveMotion(pref: MotionPref, systemReduced: boolean): MotionLevel {
  const followsSystem = pref === 'system';
  if (followsSystem) return systemReduced ? 'reduced' : 'full';
  return pref;
}

/** Any number squeezed into 0..1; anything else falls back to full shake. */
export function clampShakeLevel(value: unknown): number {
  const isNumber = typeof value === 'number' && Number.isFinite(value);
  if (!isNumber) return DEFAULT_SHAKE_LEVEL;
  return Math.min(1, Math.max(0, value));
}

export function loadMotionPref(store: Store | null = browserStore()): MotionPref {
  try {
    const saved = store?.getItem(MOTION_KEY);
    return isMotionPref(saved) ? saved : DEFAULT_MOTION_PREF;
  } catch {
    return DEFAULT_MOTION_PREF;
  }
}

export function saveMotionPref(pref: MotionPref, store: Store | null = browserStore()): void {
  try {
    store?.setItem(MOTION_KEY, pref);
  } catch {
    // chemx-allow: best-effort a setting that does not persist still applies for this visit
  }
}

export function loadShakeLevel(store: Store | null = browserStore()): number {
  try {
    const saved = store?.getItem(SHAKE_KEY);
    const hasSaved = typeof saved === 'string' && saved.trim() !== '';
    if (!hasSaved) return DEFAULT_SHAKE_LEVEL;
    return clampShakeLevel(Number(saved));
  } catch {
    return DEFAULT_SHAKE_LEVEL;
  }
}

export function saveShakeLevel(level: number, store: Store | null = browserStore()): void {
  try {
    store?.setItem(SHAKE_KEY, String(clampShakeLevel(level)));
  } catch {
    // chemx-allow: best-effort the slider still holds for this visit
  }
}
