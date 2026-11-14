// The save in this browser. Read, compare and write are one step, so a second tab cannot slip between them.

import { loadSoundUnlock } from '../sound-unlock.ts';
import { CAMP_RESET_KEY, isReset, markReset } from '../settings-reset.ts';
import { migrateCamp, resetCamp } from './camp-migrate.ts';
import { reviveSave } from './home-save-revive.ts';
import { emptySave } from './home-store.ts';
import type { HomeSave, HomeStore, SaveResult } from './home-store.ts';

const HOME_KEY = 'outbreak.home';
const HOME_LOCK = 'outbreak.home';
const SHOP_SEED_RANGE = 0x7fffffff;

type Store = Pick<Storage, 'getItem' | 'setItem'>;

function browserStore(): Store | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

const freshSave = (): HomeSave => emptySave(Math.floor(Math.random() * SHOP_SEED_RANGE));

function parsed(raw: string | null | undefined): HomeSave | null {
  if (!raw) return null;
  try {
    return reviveSave(JSON.parse(raw), freshSave());
  } catch {
    return null;
  }
}

/**
 * `navigator.locks` is missing on a plain http LAN address. The step it guards never yields, so
 * there the version check stands alone, which beats refusing every save on such a page.
 */
function underLock<T>(step: () => T): Promise<T> {
  const locks = globalThis.navigator?.locks;
  return locks ? locks.request(HOME_LOCK, step) : Promise.resolve().then(step);
}

const reasonOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));

function compareAndWrite(store: Store, next: HomeSave): SaveResult {
  const stored = parsed(store.getItem(HOME_KEY))?.version ?? 0;
  const isStale = stored !== next.version;
  if (isStale) return { kind: 'conflict' };
  const version = next.version + 1;
  store.setItem(HOME_KEY, JSON.stringify({ ...next, version }));
  // A save written by this build is not an older one, so it never needs the camp reset.
  markReset(store, CAMP_RESET_KEY);
  return { kind: 'saved', version };
}

/** An older save's camp starts over, written back at once so the reset is not undone by the next load. */
function resetOlderCamp(store: Store, found: HomeSave): HomeSave {
  const next = resetCamp(migrateCamp(found, loadSoundUnlock()));
  try {
    store.setItem(HOME_KEY, JSON.stringify(next));
    markReset(store, CAMP_RESET_KEY);
  } catch {
    // The reset stands in memory and is tried again on the next load; the save below reports a failed write itself.
  }
  return next;
}

/** Not `writeJson`: that hides failures, and here a failed write must reach the player. */
export function createBrowserHomeStore(store: Store | null = browserStore()): HomeStore {
  return {
    async load(): Promise<HomeSave> {
      try {
        const found = parsed(store?.getItem(HOME_KEY));
        if (found && store && !isReset(store, CAMP_RESET_KEY)) return resetOlderCamp(store, found);
        if (store && !found) markReset(store, CAMP_RESET_KEY);
        return found ? migrateCamp(found, loadSoundUnlock()) : migrateCamp(freshSave(), loadSoundUnlock());
      } catch {
        return freshSave();
      }
    },
    async save(next: HomeSave): Promise<SaveResult> {
      if (!store) return { kind: 'failed', reason: 'This browser is not letting the game save.' };
      try {
        return await underLock(() => compareAndWrite(store, next));
      } catch (error) {
        return { kind: 'failed', reason: reasonOf(error) };
      }
    },
  };
}
