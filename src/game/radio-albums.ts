import { cardOf } from '../art/difficulty-card.ts';
import { UNDEAD_TIRED_CARD } from '../art/difficulty/undead-tired.ts';
import { buildLevelCards } from '../art/level-cards.ts';
import type { PixelSprite } from '../art/types.ts';
import type { MusicEntry } from './sound-test.ts';

export interface TapeAlbumDef {
  readonly id: string;
  readonly volume: string;
  readonly title: string;
  readonly subtitle: string;
  readonly level?: number;
  readonly isHorde?: boolean;
  readonly art: PixelSprite;
  readonly trackFiles: readonly string[];
}

export interface TapeAlbumGroup {
  readonly album: TapeAlbumDef;
  readonly tracks: readonly MusicEntry[];
  readonly hasCurrentTrack: boolean;
}

let cachedAlbums: readonly TapeAlbumDef[] | null = null;

export function getTapeAlbums(): readonly TapeAlbumDef[] {
  if (cachedAlbums) return cachedAlbums;

  const levelCards = buildLevelCards();
  const hordeCard = cardOf(UNDEAD_TIRED_CARD);

  cachedAlbums = [
    {
      id: 'album-01',
      volume: 'VOL. 01',
      title: 'SILENT RUINS',
      subtitle: 'TOWN 01 // SOUNDTRACK',
      level: 1,
      art: levelCards[0],
      trackFiles: [
        'silent-ruins.mp3',
        'silent-ruins-variation.mp3',
        'level-01-abandoned-streets.mp3',
        'level-01-whispering-shadows.mp3',
        'level-01-sunken-tomb.mp3',
      ],
    },
    {
      id: 'album-02',
      volume: 'VOL. 02',
      title: 'ESCALATION',
      subtitle: 'TOWN 02 // SOUNDTRACK',
      level: 2,
      art: levelCards[1],
      trackFiles: [
        'escalation.mp3',
        'escalation-hard.mp3',
        'level-02-metro-tunnels.mp3',
        'level-02-the-abattoir.mp3',
        'level-02-catacombs-of-anubis.mp3',
      ],
    },
    {
      id: 'album-03',
      volume: 'VOL. 03',
      title: 'INTO THE BREACH',
      subtitle: 'TOWN 03 // SOUNDTRACK',
      level: 3,
      art: levelCards[2],
      trackFiles: [
        'level-03-into-the-breach.mp3',
        'level-03-factory-raid.mp3',
        'level-03-crawlspace.mp3',
        'level-03-hide-your-kids.mp3',
        'level-03-chamber-of-mummies.mp3',
      ],
    },
    {
      id: 'album-04',
      volume: 'VOL. 04',
      title: 'ABYSSAL DEPTHS',
      subtitle: 'TOWN 04 // SOUNDTRACK',
      level: 4,
      art: levelCards[3],
      trackFiles: [
        'level-04-abyssal-depths.mp3',
        'level-04-overgrown-hospital.mp3',
        'level-04-infested-lab.mp3',
        'level-04-forgotten-oasis.mp3',
      ],
    },
    {
      id: 'album-05',
      volume: 'VOL. 05',
      title: 'CONTAMINATION ZONE',
      subtitle: 'TOWN 05 // SOUNDTRACK',
      level: 5,
      art: levelCards[4],
      trackFiles: [
        'level-05-contamination-zone.mp3',
        'level-05-highway-escape.mp3',
        'level-05-static-corridor.mp3',
        'level-05-valley-of-shadows.mp3',
      ],
    },
    {
      id: 'album-06',
      volume: 'VOL. 06',
      title: 'UNDERGROUND BUNKER',
      subtitle: 'TOWN 06 // SOUNDTRACK',
      level: 6,
      art: levelCards[5],
      trackFiles: [
        'level-06-underground-bunker.mp3',
        'level-06-toxic-silo.mp3',
        'level-06-steel-works.mp3',
        'level-06-underground-temple.mp3',
      ],
    },
    {
      id: 'album-07',
      volume: 'VOL. 07',
      title: 'QUARANTINE BREACH',
      subtitle: 'TOWN 07 // SOUNDTRACK',
      level: 7,
      art: levelCards[6],
      trackFiles: [
        'level-07-quarantine-breach.mp3',
        'level-07-quarantine-breach-alt.mp3',
        'level-07-outpost-siege.mp3',
        'level-07-containment-breach.mp3',
        'level-07-swarm-of-the-scarabs.mp3',
      ],
    },
    {
      id: 'album-08',
      volume: 'VOL. 08',
      title: 'FROZEN WASTELAND',
      subtitle: 'TOWN 08 // SOUNDTRACK',
      level: 8,
      art: levelCards[7],
      trackFiles: [
        'level-08-frozen-wasteland.mp3',
        'level-08-frozen-military-base.mp3',
        'level-08-the-morgue.mp3',
        'level-08-the-necropolis.mp3',
      ],
    },
    {
      id: 'album-09',
      volume: 'VOL. 09',
      title: 'THE HIVE',
      subtitle: 'TOWN 09 // SOUNDTRACK',
      level: 9,
      art: levelCards[8],
      trackFiles: [
        'level-09-the-hive.mp3',
        'level-09-the-hive-alt.mp3',
        'level-09-nesting-grounds.mp3',
        'level-09-mutation-core.mp3',
        'level-09-inner-sanctum.mp3',
      ],
    },
    {
      id: 'album-10',
      volume: 'VOL. 10',
      title: 'FINAL STAND',
      subtitle: 'TOWN 10 & EPILOGUE',
      level: 10,
      art: levelCards[9],
      trackFiles: [
        'level-10-final-stand.mp3',
        'level-10-final-evacuation.mp3',
        'level-10-point-zero.mp3',
        'level-10-point-zero-point-one.mp3',
        'level-10-awakening-of-the-curse.mp3',
        'victory-dark-salvation.mp3',
        'end-credits-surviving-the-night.mp3',
      ],
    },
    {
      id: 'album-horde',
      volume: 'HORDE',
      title: "LET'S GO! // HORDE",
      subtitle: 'SURVIVAL INVASION TAPES',
      isHorde: true,
      art: hordeCard,
      trackFiles: [
        'horde-attack.mp3',
        'horde-attack-alt.mp3',
      ],
    },
  ];

  return cachedAlbums;
}

/**
 * Groups a collection of music entries into thematic tape albums.
 */
export function groupTracksIntoAlbums(
  tracks: readonly MusicEntry[],
  currentTrackId?: string,
): readonly TapeAlbumGroup[] {
  const albums = getTapeAlbums();
  const trackMap = new Map<string, MusicEntry>();
  for (const track of tracks) {
    trackMap.set(track.file, track);
  }

  const groups: TapeAlbumGroup[] = [];

  for (const album of albums) {
    const albumTracks: MusicEntry[] = [];
    for (const file of album.trackFiles) {
      const match = trackMap.get(file);
      if (match) {
        albumTracks.push(match);
      }
    }

    if (albumTracks.length > 0) {
      const hasCurrentTrack = Boolean(currentTrackId && albumTracks.some((t) => t.id === currentTrackId));
      groups.push({
        album,
        tracks: albumTracks,
        hasCurrentTrack,
      });
    }
  }

  const assignedFiles = new Set(albums.flatMap((a) => a.trackFiles));
  const remaining = tracks.filter((track) => !assignedFiles.has(track.file));
  if (remaining.length > 0) {
    const firstAlbum = albums[0];
    const fallbackArt = firstAlbum ? firstAlbum.art : cardOf(UNDEAD_TIRED_CARD);
    groups.push({
      album: {
        id: 'album-misc',
        volume: 'EXTRA',
        title: 'RADIO FINDS & SINGLES',
        subtitle: 'MISCELLANEOUS TAPES',
        art: fallbackArt,
        trackFiles: remaining.map((t) => t.file),
      },
      tracks: remaining,
      hasCurrentTrack: Boolean(currentTrackId && remaining.some((t) => t.id === currentTrackId)),
    });
  }

  return groups;
}
