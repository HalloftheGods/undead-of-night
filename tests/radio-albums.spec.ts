import { describe, expect, it } from 'vitest';
import { allTracks } from '../src/audio/playlists.ts';
import { getTapeAlbums, groupTracksIntoAlbums } from '../src/game/radio-albums.ts';
import type { MusicEntry } from '../src/game/sound-test.ts';

describe('radio-albums', () => {
  it('defines 11 tape albums covering all 10 levels and horde mode', () => {
    const albums = getTapeAlbums();
    expect(albums).toHaveLength(11);

    // Levels 1 to 10
    for (let level = 1; level <= 10; level++) {
      const album = albums.find((a) => a.level === level);
      expect(album).toBeDefined();
      expect(album?.volume).toBe(`VOL. ${level < 10 ? '0' : ''}${level}`);
      expect(album?.art.w).toBe(56);
      expect(album?.art.h).toBe(40);
      expect(album?.trackFiles.length).toBeGreaterThanOrEqual(4);
    }

    // Horde mode album
    const hordeAlbum = albums.find((a) => a.isHorde);
    expect(hordeAlbum).toBeDefined();
    expect(hordeAlbum?.volume).toBe('HORDE');
    expect(hordeAlbum?.title).toContain('HORDE');
    expect(hordeAlbum?.art.w).toBe(56);
    expect(hordeAlbum?.art.h).toBe(40);
    expect(hordeAlbum?.trackFiles).toContain('horde-attack.mp3');
    expect(hordeAlbum?.trackFiles).toContain('horde-attack-alt.mp3');
  });

  it('maps all recorded tracks into albums without duplicates or omissions', () => {
    const albums = getTapeAlbums();
    const allAlbumFiles = albums.flatMap((a) => a.trackFiles);
    const uniqueFiles = new Set(allAlbumFiles);

    // No duplicates across albums
    expect(allAlbumFiles.length).toBe(uniqueFiles.size);

    // Every recorded track from playlists is accounted for
    const recordedFiles = allTracks('arcade').map((t) => t.file);
    for (const file of recordedFiles) {
      expect(uniqueFiles.has(file)).toBe(true);
    }
  });

  it('groups music entries into populated albums and flags current track', () => {
    const sampleEntries: MusicEntry[] = [
      { id: 'music:silent-ruins.mp3', kind: 'music', file: 'silent-ruins.mp3', name: 'Silent Ruins', label: 'Silent Ruins', where: 'TOWN 01', unlocked: true, find: false },
      { id: 'music:horde-attack.mp3', kind: 'music', file: 'horde-attack.mp3', name: 'Horde Attack', label: 'Horde Attack', where: 'HORDE', unlocked: true, find: false },
    ];

    const groups = groupTracksIntoAlbums(sampleEntries, 'music:silent-ruins.mp3');

    // Only albums with matching tracks are included
    expect(groups).toHaveLength(2);
    expect(groups[0].album.level).toBe(1);
    expect(groups[0].tracks).toHaveLength(1);
    expect(groups[0].hasCurrentTrack).toBe(true);

    expect(groups[1].album.isHorde).toBe(true);
    expect(groups[1].tracks).toHaveLength(1);
    expect(groups[1].hasCurrentTrack).toBe(false);
  });
});
