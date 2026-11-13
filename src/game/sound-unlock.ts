/**
 * What this browser has found for the Sound Test, kept next to the level progress but apart from it,
 * so old saves load untouched. The simulation never reads this: it only reports the find.
 */
import type { GameEvent } from '../../shared/protocol.ts';

const UNLOCK_KEY = 'outbreak.sound-unlock';

export interface SoundUnlock {
  /** True once a Radio has been found in this browser, by this player or a teammate. */
  readonly radio: boolean;
  /** The files of the tracks the radios have given up, in the order they were found. */
  readonly tracks: readonly string[];
}

export const NO_SOUND_UNLOCK: SoundUnlock = { radio: false, tracks: [] };

type Store = Pick<Storage, 'getItem' | 'setItem'>;

function browserStore(): Store | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function loadSoundUnlock(store: Store | null = browserStore()): SoundUnlock {
  try {
    const raw = store?.getItem(UNLOCK_KEY);
    const value: unknown = raw ? JSON.parse(raw) : null;
    const isObject = typeof value === 'object' && value !== null;
    if (!isObject) return NO_SOUND_UNLOCK;
    const saved = value as Record<string, unknown>;
    const tracks = Array.isArray(saved.tracks) ? saved.tracks.filter((file): file is string => typeof file === 'string') : [];
    return { radio: saved.radio === true || tracks.length > 0, tracks };
  } catch {
    return NO_SOUND_UNLOCK;
  }
}

/** The files of the tracks found so far in this browser. */
export const foundTracks = (): ReadonlySet<string> => new Set(loadSoundUnlock().tracks);

/** Notes a Radio found, and the track it gave up if there was one left. It only ever unlocks. */
export function recordRadioFound(store: Store | null = browserStore(), track: string | null = null): SoundUnlock {
  const unlock = loadSoundUnlock(store);
  const isNew = track !== null && !unlock.tracks.includes(track);
  const nothingToNote = unlock.radio && !isNew;
  if (nothingToNote) return unlock;
  const next: SoundUnlock = { radio: true, tracks: isNew ? [...unlock.tracks, track] : unlock.tracks };
  try {
    store?.setItem(UNLOCK_KEY, JSON.stringify(next));
  } catch {
    // chemx-allow: best-effort unlock that does not persist is not worth interrupting a run for
  }
  return next;
}

/** Anyone's pickup of the Radio: the event reaches every connected client, so a whole party unlocks together. */
export function isRadioFound(event: GameEvent): boolean {
  return event.type === 'pickup' && event.pickup === 'radio';
}

/** The tracks the campaign save holds go where the Sound Test and the Radio screens read them, so every screen sees the save's finds. */
export function mirrorFoundTracks(tracks: readonly string[], store: Store | null = browserStore()): void {
  for (const track of tracks) recordRadioFound(store, track);
}
