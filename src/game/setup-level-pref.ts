// The town each style's Level card set. Remembered like the difficulty and survivor, so the next visit opens on it.
// Arcade starts there (the first town is no jump). Campaign drives its van there by default, and the garage map can still change it.

import { FIRST_LEVEL, LEVELS } from '../../shared/levels.ts';
import type { GameStyle } from '../../shared/game-style.ts';

type Store = Pick<Storage, 'getItem' | 'setItem'>;

/** Campaign and Arcade keep their own choice: their unlocks differ. Daily Night has no Level card. */
const KEYS: Partial<Record<GameStyle, string>> = {
  arcade: 'outbreak.setupLevel',
  campaign: 'outbreak.setupLevel.campaign',
};

function browserStore(): Store | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function isKnownLevel(value: number): boolean {
  return Number.isInteger(value) && LEVELS.some((entry) => entry.number === value);
}

/** The town last set for a style, or null when nothing valid is saved. */
export function loadSetupLevel(style: GameStyle, store: Store | null = browserStore()): number | null {
  const key = KEYS[style];
  if (key === undefined) return null;
  try {
    const raw = store?.getItem(key);
    const isBlank = raw === null || raw === undefined || raw === '';
    const saved = Number(raw);
    return !isBlank && isKnownLevel(saved) ? saved : null;
  } catch {
    return null;
  }
}

export function saveSetupLevel(style: GameStyle, level: number, store: Store | null = browserStore()): void {
  const key = KEYS[style];
  if (key === undefined) return;
  try {
    store?.setItem(key, String(level));
  } catch {
    // chemx-allow: best-effort a choice that does not persist is not worth interrupting the menu for
  }
}

/** The start a Play page asks for. Only Arcade starts at a set town, and the first town is no jump at all. */
export function setupLevelRequest(saved: number | null, style: GameStyle): number | null {
  const isArcade = style === 'arcade';
  const isJump = saved !== null && saved > FIRST_LEVEL;
  return isArcade && isJump ? saved : null;
}
