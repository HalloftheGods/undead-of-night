/** The Sound Test's lists and what is unlocked in them. Everything comes from the real playlists and sound table. */
import { allTracks } from '../audio/playlists.ts';
import type { TrackGroup, TrackInfo } from '../audio/playlists.ts';
import { foundTracks } from './sound-unlock.ts';
import { SFX_NAMES } from '../audio/sfx-registry.ts';
import type { SfxName } from '../audio/sfx-registry.ts';
import type { GameStyle } from '../../shared/game-style.ts';
import { townName } from '../../shared/levels.ts';
import { isLevelUnlocked } from './level-progress.ts';
import type { LevelProgress } from './level-progress.ts';

/** Said under the music list: the finds are the tracks only a Radio gives up. */
export const FINDS_HINT = 'Radios in the towns give up the rest of each level\'s music.';
export const HIDDEN_LABEL = '???';

interface EntryBase {
  readonly id: string;
  readonly name: string;
  /** Where it is heard, which stays readable while the name is hidden. */
  readonly where: string;
  readonly unlocked: boolean;
  /** The name, or ??? while locked. */
  readonly label: string;
}

export interface MusicEntry extends EntryBase {
  readonly kind: 'music';
  readonly file: string;
  /** A radio find: named only once a Radio has given it up. */
  readonly find: boolean;
}

export interface SfxEntry extends EntryBase {
  readonly kind: 'sfx';
  readonly sfx: SfxName;
}

export type SoundEntry = MusicEntry | SfxEntry;

const SMALL_WORDS: ReadonlySet<string> = new Set(['a', 'in', 'into', 'of', 'the', 'to']);
const NAME_PREFIX = /^(?:level-\d+|victory|end-credits)-/;

function titleCase(slug: string, separator: RegExp): string {
  return slug
    .split(separator)
    .filter((word) => word.length > 0)
    .map((word, index) => {
      const small = index > 0 && SMALL_WORDS.has(word);
      return small ? word : word[0].toUpperCase() + word.slice(1);
    })
    .join(' ');
}

/** A track's name, read from its file: level-02-metro-tunnels.mp3 is Metro Tunnels. */
export function trackName(file: string): string {
  return titleCase(file.replace(/\.[a-z0-9]+$/i, '').replace(NAME_PREFIX, ''), /-/);
}

/** A sound's name, read from its key: dry_click is Dry Click. */
export function sfxName(name: string): string {
  return titleCase(name, /_/);
}

const GROUP_WHERE: Readonly<Record<TrackGroup, string>> = {
  title: 'TITLE',
  horde: 'HORDE',
  level: 'LEVEL',
  bunker: 'BUNKER',
  victory: 'VICTORY',
  credits: 'CREDITS',
};

/** Victory and credits are heard on finishing the game; the rest need their level reached, and the finds a Radio too. */
function trackUnlocked(info: TrackInfo, progress: LevelProgress, found: ReadonlySet<string>): boolean {
  const { group, level } = info;
  if (info.find) return found.has(info.file);
  const isEnding = group === 'victory' || group === 'credits';
  const isHome = group === 'bunker';
  if (isHome) return true;
  return isEnding ? progress.finished : isLevelUnlocked(level, progress);
}

function entryOf(base: Omit<EntryBase, 'label'>): EntryBase {
  return { ...base, label: base.unlocked ? base.name : HIDDEN_LABEL };
}



/** Every recorded track, named once the level it plays in has been reached, and for a find once a Radio gave it up. */
export function musicEntries(progress: LevelProgress, style: GameStyle = 'arcade', found: ReadonlySet<string> = foundTracks()): readonly MusicEntry[] {
  return allTracks(style).map((info) => {
    const { file, group, level } = info;
    const where = group === 'level' ? townName(level).toUpperCase() : GROUP_WHERE[group];
    const unlocked = trackUnlocked(info, progress, found);
    return { ...entryOf({ id: `music:${file}`, name: trackName(file), where, unlocked }), kind: 'music', file, find: info.find };
  });
}

/** What the bunker's jukebox can play: only the tracks already heard or found, none of the ??? the Sound Test keeps. */
export function jukeboxEntries(progress: LevelProgress, found: ReadonlySet<string> = foundTracks()): readonly MusicEntry[] {
  return musicEntries(progress, 'campaign', found).filter((entry) => entry.unlocked);
}

/** How many of the radio finds are in hand, for the page to say what is still missing. */
export function findCount(entries: readonly MusicEntry[]): { readonly found: number; readonly total: number } {
  const finds = entries.filter((entry) => entry.find);
  return { found: finds.filter((entry) => entry.unlocked).length, total: finds.length };
}

/** Every sound effect. */
export function sfxEntries(): readonly SfxEntry[] {
  return SFX_NAMES.map((sfx) => ({
    ...entryOf({ id: `sfx:${sfx}`, name: sfxName(sfx), where: 'SOUND', unlocked: true }),
    kind: 'sfx',
    sfx,
  }));
}

/** The part of the audio engine the page plays through. */
export interface Previewer {
  previewTrack(file: string, onEnd: () => void): boolean;
  previewSfx(name: SfxName, onEnd: () => void): boolean;
}

/** Starts an entry, if it is unlocked and the audio could start it. Returns whether something is now playing. */
export function playEntry(entry: SoundEntry, audio: Previewer, onEnd: () => void): boolean {
  if (!entry.unlocked) return false;
  return entry.kind === 'music' ? audio.previewTrack(entry.file, onEnd) : audio.previewSfx(entry.sfx, onEnd);
}
