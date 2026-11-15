import { describe, expect, it } from 'vitest';
import { clearTitlePlaylistsCache, titlePlaylist, playlistFor } from '../src/audio/playlists.ts';
import { loadSoundUnlock, recordRadioFound } from '../src/game/sound-unlock.ts';
import { loadRadioFavorites, toggleFavoriteTrack } from '../src/game/radio-player.ts';

function memoryStore(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
}

describe('pause menu radio unlock condition', () => {
  it('detects radio unlocked from sound unlock store', () => {
    const store = memoryStore();
    expect(loadSoundUnlock(store).radio).toBe(false);

    recordRadioFound(store);
    expect(loadSoundUnlock(store).radio).toBe(true);
  });

  it('detects radio unlocked from camp save state', () => {
    const campNoRadio = { radio: false, rescued: [], tracks: [] };
    const campWithRadio = { radio: true, rescued: [], tracks: [] };

    const hasRadio = (saveRadio: boolean, soundUnlockRadio: boolean) =>
      soundUnlockRadio || saveRadio;

    expect(hasRadio(campNoRadio.radio, false)).toBe(false);
    expect(hasRadio(campWithRadio.radio, false)).toBe(true);
    expect(hasRadio(campNoRadio.radio, true)).toBe(true);
  });
});

describe('title screen favorites playlist behavior', () => {
  it('uses default ruins playlist when radio favorites are empty', () => {
    clearTitlePlaylistsCache();
    const playlist = titlePlaylist(new Set());
    expect(playlist.files).toEqual(['silent-ruins-variation.mp3']);
    expect(playlistFor('menu', 1).files).toEqual(['silent-ruins-variation.mp3']);
  });

  it('uses favorited tracks as title playlist when favorites exist', () => {
    clearTitlePlaylistsCache();
    const favs = new Set(['level-01-sunken-tomb.mp3', 'level-02-the-abattoir.mp3']);
    const playlist = titlePlaylist(favs);
    expect(playlist.files).toEqual(['level-01-sunken-tomb.mp3', 'level-02-the-abattoir.mp3']);
  });

  it('persists favorites and reloads them for title screen', () => {
    clearTitlePlaylistsCache();
    const store = memoryStore();
    const favorites = new Set<string>();

    toggleFavoriteTrack('level-05-valley-of-shadows.mp3', favorites, store);
    expect(loadRadioFavorites(store)).toEqual(new Set(['level-05-valley-of-shadows.mp3']));

    const playlist = titlePlaylist(loadRadioFavorites(store));
    expect(playlist.files).toEqual(['level-05-valley-of-shadows.mp3']);
  });
});
