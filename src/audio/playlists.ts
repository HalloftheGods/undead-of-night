import { playsFromHome } from '../../shared/game-style.ts';
import type { GameStyle } from '../../shared/game-style.ts';
import { FINAL_LEVEL, FIRST_LEVEL } from '../../shared/levels.ts';
import { foundTracks } from '../game/sound-unlock.ts';
import type { Scene } from './music.ts';

export interface Playlist {
  readonly files: readonly string[];
  /** A horde starts its track from the top; the quiet scenes pick up where they stopped. */
  readonly fromTop: boolean;
}

const quiet = (): Playlist => ({ files: [], fromTop: false });
const lull = (...files: string[]): Playlist => ({ files, fromTop: false });

const RUINS = lull('silent-ruins-variation.mp3');
const HORDE: Playlist = { files: ['horde-attack.mp3', 'horde-attack-alt.mp3'], fromTop: true };
const QUIET = quiet();
const VICTORY: Playlist = { files: ['victory-dark-salvation.mp3'], fromTop: true };
const CREDITS: Playlist = { files: ['end-credits-surviving-the-night.mp3'], fromTop: true };

const BUNKER_TRACK = 'level-06-underground-bunker.mp3';
/** The bunker's own music in Campaign, where level 6 gives the track up to it. Arcade's level 6 keeps it. */
const BUNKER = lull(BUNKER_TRACK);
const BUNKER_LEVEL_INDEX = 5;

/**
 * The music between hordes in each town, in the order of LEVELS. The first take is the level's own and plays from the
 * start; each take after it is a find, played only once a Radio in that level has given it up. A level plays its takes in turn.
 */
export const LULLS: readonly Playlist[] = [
  lull('silent-ruins.mp3', 'level-01-abandoned-streets.mp3', 'level-01-whispering-shadows.mp3', 'level-01-sunken-tomb.mp3'),
  lull('escalation.mp3', 'escalation-hard.mp3', 'level-02-metro-tunnels.mp3', 'level-02-the-abattoir.mp3', 'level-02-catacombs-of-anubis.mp3'),
  lull('level-03-into-the-breach.mp3', 'level-03-factory-raid.mp3', 'level-03-crawlspace.mp3', 'level-03-hide-your-kids.mp3', 'level-03-chamber-of-mummies.mp3'),
  lull('level-04-abyssal-depths.mp3', 'level-04-overgrown-hospital.mp3', 'level-04-infested-lab.mp3', 'level-04-forgotten-oasis.mp3'),
  lull('level-05-contamination-zone.mp3', 'level-05-highway-escape.mp3', 'level-05-static-corridor.mp3', 'level-05-valley-of-shadows.mp3'),
  lull('level-06-underground-bunker.mp3', 'level-06-toxic-silo.mp3', 'level-06-steel-works.mp3', 'level-06-underground-temple.mp3'),
  lull('level-07-quarantine-breach.mp3', 'level-07-quarantine-breach-alt.mp3', 'level-07-outpost-siege.mp3', 'level-07-containment-breach.mp3', 'level-07-swarm-of-the-scarabs.mp3'),
  lull('level-08-frozen-wasteland.mp3', 'level-08-frozen-military-base.mp3', 'level-08-the-morgue.mp3', 'level-08-the-necropolis.mp3'),
  lull('level-09-the-hive.mp3', 'level-09-the-hive-alt.mp3', 'level-09-nesting-grounds.mp3', 'level-09-mutation-core.mp3', 'level-09-inner-sanctum.mp3'),
  lull('level-10-final-stand.mp3', 'level-10-final-evacuation.mp3', 'level-10-point-zero.mp3', 'level-10-point-zero-point-one.mp3', 'level-10-awakening-of-the-curse.mp3'),
];

export type TrackGroup = 'title' | 'horde' | 'level' | 'bunker' | 'victory' | 'credits';

export interface TrackInfo {
  readonly file: string;
  readonly group: TrackGroup;
  /** The level that has to be reached to hear it in a run. The title and the first horde belong to the first. */
  readonly level: number;
  /** A level's take after the first: heard in runs and listed by name only once a Radio has given it up. */
  readonly find: boolean;
}

const tracksOf = (playlist: Playlist, group: TrackGroup, level: number, finds = false): TrackInfo[] =>
  playlist.files.map((file, index) => ({ file, group, level, find: finds && index > 0 }));

/** Built once, so a scene keeps the same playlist object and the soundtrack does not restart it. */
const HOME_LULLS: readonly Playlist[] = LULLS.map((playlist, index) =>
  index === BUNKER_LEVEL_INDEX ? lull(...playlist.files.filter((file) => file !== BUNKER_TRACK)) : playlist,
);

const lullsFor = (style: GameStyle): readonly Playlist[] => (playsFromHome(style) ? HOME_LULLS : LULLS);

/** Every recorded track, read from the playlists above so the Sound Test keeps no list of its own. */
export function allTracks(style: GameStyle = 'arcade'): readonly TrackInfo[] {
  const bunker = playsFromHome(style) ? tracksOf(BUNKER, 'bunker', FIRST_LEVEL) : [];
  return [
    ...tracksOf(RUINS, 'title', FIRST_LEVEL),
    ...tracksOf(HORDE, 'horde', FIRST_LEVEL),
    ...bunker,
    ...lullsFor(style).flatMap((playlist, index) => tracksOf(playlist, 'level', FIRST_LEVEL + index, true)),
    ...tracksOf(VICTORY, 'victory', FINAL_LEVEL),
    ...tracksOf(CREDITS, 'credits', FINAL_LEVEL),
  ];
}

const levelIndex = (level: number): number => Math.min(FINAL_LEVEL, Math.max(FIRST_LEVEL, Math.floor(level))) - FIRST_LEVEL;

/** The tracks of a level a Radio has not yet given up, in the order they are handed out. */
export function lockedTracksOf(level: number, found: ReadonlySet<string>, style: GameStyle = 'arcade'): readonly string[] {
  const [, ...finds] = lullsFor(style)[levelIndex(level)].files;
  return finds.filter((file) => !found.has(file));
}

/** What a level plays: its own take and the finds so far. Kept by what it holds, so a scene keeps the same list object. */
const HEARD = new Map<string, Playlist>();

function heardOn(index: number, style: GameStyle, found: ReadonlySet<string>): Playlist {
  const files = lullsFor(style)[index].files.filter((file, at) => at === 0 || found.has(file));
  const key = `${style}:${index}:${files.join()}`;
  const kept = HEARD.get(key);
  if (kept) return kept;
  const made = lull(...files);
  HEARD.set(key, made);
  return made;
}



/** Scenes that play the same thing on every level. */
const SCENE_PLAYLISTS: Partial<Record<Scene, Playlist>> = { menu: RUINS, wave: HORDE, victory: VICTORY, credits: CREDITS, gameover: QUIET };

/** What plays in a scene on a level. Levels past either end of the run hold to the nearest. */
export function playlistFor(scene: Scene, level: number, style: GameStyle = 'arcade', found: ReadonlySet<string> = foundTracks()): Playlist {
  const fixed = SCENE_PLAYLISTS[scene];
  if (fixed) return fixed;
  const isHomeBunker = scene === 'bunker' && playsFromHome(style);
  if (isHomeBunker) return BUNKER;
  return heardOn(levelIndex(level), style, found);
}