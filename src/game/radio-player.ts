
export type RepeatMode = 'off' | 'all' | 'one';

export const FAVORITES_KEY = 'outbreak.radio-favorites';

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

function browserStorage(): StorageLike | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** Loads user-favorited track files from storage. */
export function loadRadioFavorites(store: StorageLike | null = browserStorage()): Set<string> {
  try {
    const raw = store?.getItem(FAVORITES_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    const isArray = Array.isArray(parsed);
    if (!isArray) return new Set();
    const files = parsed.filter((item): item is string => typeof item === 'string');
    return new Set(files);
  } catch {
    return new Set();
  }
}

/** Saves user-favorited track files to storage. */
export function saveRadioFavorites(favorites: ReadonlySet<string>, store: StorageLike | null = browserStorage()): void {
  try {
    const list = [...favorites];
    store?.setItem(FAVORITES_KEY, JSON.stringify(list));
  } catch {
    // Non-blocking fallback for restricted storage environments
  }
}

/** Toggles a track favorite status and persists the change. */
export function toggleFavoriteTrack(file: string, favorites: ReadonlySet<string>, store: StorageLike | null = browserStorage()): Set<string> {
  const next = new Set(favorites);
  const isFav = next.has(file);
  if (isFav) next.delete(file);
  else next.add(file);
  saveRadioFavorites(next, store);
  return next;
}

/** Formats seconds into MM:SS display. */
export function formatTrackTime(seconds: number): string {
  const isInvalid = !Number.isFinite(seconds) || seconds < 0;
  if (isInvalid) return '00:00';
  const total = Math.floor(seconds);
  const minutes = Math.floor(total / 60);
  const remainder = total % 60;
  const padMin = String(minutes).padStart(2, '0');
  const padSec = String(remainder).padStart(2, '0');
  return `${padMin}:${padSec}`;
}

/** Computes the next repeat mode in sequence: off -> all -> one -> off. */
export function nextRepeatMode(current: RepeatMode): RepeatMode {
  if (current === 'off') return 'all';
  if (current === 'all') return 'one';
  return 'off';
}

/** Generates a shuffled copy of array indices. */
export function shuffleIndices(length: number, random: () => number = Math.random): number[] {
  const indices = Array.from({ length }, (_, i) => i);
  for (let i = length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const temp = indices[i];
    indices[i] = indices[j];
    indices[j] = temp;
  }
  return indices;
}

/** Determines the next track index when playback completes naturally. */
export function nextTrackOnEnd(
  currentIndex: number,
  totalTracks: number,
  repeat: RepeatMode,
  isShuffle: boolean,
  shuffleQueue: readonly number[],
): { readonly nextIndex: number | null; readonly nextQueue: readonly number[] } {
  const hasNoTracks = totalTracks <= 0;
  if (hasNoTracks) return { nextIndex: null, nextQueue: [] };

  const isRepeatOne = repeat === 'one';
  if (isRepeatOne) return { nextIndex: currentIndex, nextQueue: shuffleQueue };

  if (isShuffle) {
    const queueEmpty = shuffleQueue.length === 0;
    const pool = queueEmpty
      ? shuffleIndices(totalTracks).filter((idx) => idx !== currentIndex || totalTracks <= 1)
      : shuffleQueue;

    const [next = null, ...rest] = pool;
    const canPlay = next !== null;
    return {
      nextIndex: canPlay ? next : (repeat === 'all' ? 0 : null),
      nextQueue: rest,
    };
  }

  const isLastTrack = currentIndex >= totalTracks - 1;
  if (isLastTrack) {
    const shouldLoop = repeat === 'all';
    return {
      nextIndex: shouldLoop ? 0 : null,
      nextQueue: [],
    };
  }

  return {
    nextIndex: currentIndex + 1,
    nextQueue: [],
  };
}

/** Computes next index for manual Next button skip. */
export function nextTrackManual(
  currentIndex: number,
  totalTracks: number,
  isShuffle: boolean,
  shuffleQueue: readonly number[],
): { readonly nextIndex: number; readonly nextQueue: readonly number[] } {
  const hasNoTracks = totalTracks <= 0;
  if (hasNoTracks) return { nextIndex: 0, nextQueue: [] };

  if (isShuffle) {
    const queueEmpty = shuffleQueue.length === 0;
    const pool = queueEmpty
      ? shuffleIndices(totalTracks).filter((idx) => idx !== currentIndex || totalTracks <= 1)
      : shuffleQueue;

    const [next = 0, ...rest] = pool;
    return { nextIndex: next, nextQueue: rest };
  }

  const nextIndex = (currentIndex + 1) % totalTracks;
  return { nextIndex, nextQueue: [] };
}

/** Computes previous index for manual Prev button skip. */
export function prevTrackManual(
  currentIndex: number,
  totalTracks: number,
  currentTime: number,
): number {
  const hasNoTracks = totalTracks <= 0;
  if (hasNoTracks) return 0;

  // If track has been playing for more than 3 seconds, restart it first
  const hasPlayedPastIntro = currentTime > 3;
  if (hasPlayedPastIntro) return currentIndex;

  return (currentIndex - 1 + totalTracks) % totalTracks;
}
