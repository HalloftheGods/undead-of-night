// The progression save: reading it out of browser storage, writing it back, and the between-runs upkeep
// check that does both. Each survivor has their own level, XP and AP, kept side by side in one book.
// The rules themselves are in progression.ts.

import {
  applyApDecay,
  createInitialBook,
  createInitialProgression,
  MAX_CHARACTER_LEVEL,
  PROGRESSION_VERSION,
  SURVIVOR_COUNT,
  type CharacterAllocation,
  type ProgressionBook,
  type ProgressionState,
} from './progression.ts';

/** Saves from before per-survivor levels sit under older keys. They are not read: everyone starts over. */
export const PROGRESSION_STORAGE_KEY = 'outbreak.progression.v3';

export type ProgressStorage = Pick<Storage, 'getItem' | 'setItem'>;

export interface ApUpkeepResult {
  readonly book: ProgressionBook;
  /** Pips taken across every survivor. */
  readonly decayedAp: number;
  readonly newlyRustySkins: readonly number[];
}

function browserStorage(): ProgressStorage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

const count = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : fallback;

function readAllocation(value: unknown): CharacterAllocation {
  const spent: Partial<CharacterAllocation['spentAp']> =
    (typeof value === 'object' && value !== null ? (value as CharacterAllocation).spentAp : undefined) ?? {};
  const pips = (key: keyof CharacterAllocation['spentAp']): number => Math.min(5, count(spent[key], 0));
  return { spentAp: { stealth: pips('stealth'), reload: pips('reload'), speed: pips('speed'), strength: pips('strength'), search: pips('search') } };
}

/** One survivor's progress as saved, with anything missing or out of range put right. */
function readSurvivor(value: unknown, skin: number, now: number): ProgressionState {
  const initial = createInitialProgression(now);
  const isObject = typeof value === 'object' && value !== null;
  if (!isObject) return initial;

  const saved = value as Partial<ProgressionState>;
  const level = Math.min(MAX_CHARACTER_LEVEL, Math.max(1, count(saved.level, initial.level)));
  const hasSavedTimer = typeof saved.lastApEarnedAt === 'number' && Number.isFinite(saved.lastApEarnedAt);
  // A clock set forward and back again must not buy a timer that never runs out.
  const lastApEarnedAt = hasSavedTimer ? Math.min(now, saved.lastApEarnedAt as number) : now;
  const savedAllocation = saved.allocations && typeof saved.allocations === 'object' ? saved.allocations[skin] : undefined;
  const isRusty = Array.isArray(saved.rustySkins) && saved.rustySkins.includes(skin);

  return {
    version: PROGRESSION_VERSION,
    level,
    xp: count(saved.xp, initial.xp),
    ap: count(saved.ap, initial.ap),
    owedAp: count(saved.owedAp, 0),
    gp: count(saved.gp, initial.gp),
    allocations: { ...initial.allocations, [skin]: readAllocation(savedAllocation) },
    lastApEarnedAt,
    rustySkins: isRusty ? [skin] : [],
  };
}

/** Every survivor as saved, or a fresh book when there is none. It never decays and never writes. */
export function loadProgressionBook(store: ProgressStorage | null = browserStorage(), now = Date.now()): ProgressionBook {
  try {
    const raw = store?.getItem(PROGRESSION_STORAGE_KEY);
    const value: unknown = raw ? JSON.parse(raw) : null;
    const isObject = typeof value === 'object' && value !== null;
    if (!isObject) return createInitialBook(now);

    const saved = (value as { survivors?: Record<string, unknown> }).survivors ?? {};
    const survivors: Record<number, ProgressionState> = {};
    for (let skin = 0; skin < SURVIVOR_COUNT; skin++) survivors[skin] = readSurvivor(saved[skin], skin, now);
    return { version: PROGRESSION_VERSION, survivors };
  } catch {
    return createInitialBook(now);
  }
}

/** One survivor's progress. */
export function loadProgression(skin: number, store: ProgressStorage | null = browserStorage(), now = Date.now()): ProgressionState {
  return loadProgressionBook(store, now).survivors[skin] ?? createInitialProgression(now);
}

export function saveProgressionBook(book: ProgressionBook, store: ProgressStorage | null = browserStorage()): void {
  try {
    store?.setItem(PROGRESSION_STORAGE_KEY, JSON.stringify(book));
  } catch {
    // Ignore storage quota or disabled storage errors
  }
}

/** Saves one survivor's progress and leaves the others as they are. */
export function saveProgression(skin: number, state: ProgressionState, store: ProgressStorage | null = browserStorage()): void {
  const book = loadProgressionBook(store);
  saveProgressionBook({ ...book, survivors: { ...book.survivors, [skin]: state } }, store);
}

/**
 * Charges each survivor the weeks they missed since their own last level-up and saves the result. Called where a
 * player is between runs (title, setup, run start), never on a kill, so pips do not vanish mid-run.
 */
export function checkApUpkeep(store: ProgressStorage | null = browserStorage(), now = Date.now()): ApUpkeepResult {
  const loaded = loadProgressionBook(store, now);
  const survivors: Record<number, ProgressionState> = {};
  let decayedAp = 0;
  const newlyRustySkins: number[] = [];
  for (let skin = 0; skin < SURVIVOR_COUNT; skin++) {
    const result = applyApDecay(loaded.survivors[skin], now);
    survivors[skin] = result.state;
    decayedAp += result.decayedAp;
    newlyRustySkins.push(...result.newlyRustySkins);
  }
  const book: ProgressionBook = { version: PROGRESSION_VERSION, survivors };
  saveProgressionBook(book, store);
  return { book, decayedAp, newlyRustySkins };
}
