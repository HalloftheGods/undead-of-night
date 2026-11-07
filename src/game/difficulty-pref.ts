import { DEFAULT_DIFFICULTY, isDifficultyId } from '../../shared/difficulty.ts';
import type { DifficultyId } from '../../shared/difficulty.ts';

const DIFFICULTY_KEY = 'outbreak.difficulty';

type Store = Pick<Storage, 'getItem' | 'setItem'>;

function browserStore(): Store | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** The difficulty the player last chose, or the default when nothing valid is saved. */
export function loadDifficulty(store: Store | null = browserStore()): DifficultyId {
  try {
    const saved = store?.getItem(DIFFICULTY_KEY);
    return isDifficultyId(saved) ? saved : DEFAULT_DIFFICULTY;
  } catch {
    return DEFAULT_DIFFICULTY;
  }
}

export function saveDifficulty(id: DifficultyId, store: Store | null = browserStore()): void {
  try {
    store?.setItem(DIFFICULTY_KEY, id);
  } catch {
    // chemx-allow: best-effort a choice that does not persist is not worth interrupting the menu for
  }
}
