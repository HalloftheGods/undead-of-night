<template><span hidden /></template>

<script setup lang="ts">
/**
 * The Radio drawn on the game canvas with the page kit instead of RadioPage (the "In-game menus" switch): the same
 * tape deck and the same tapes, as a deck panel (now playing, seek, transport, repeat, shuffle, favorite) over a
 * scrolling list of tapes. The player is the page's own (use-radio-player).
 */
import { computed, ref } from 'vue';
import type { PageItem, PageModel, PagePanel } from '../engine/page-ui.ts';
import { formatTrackTime } from '../game/radio-player.ts';
import type { RepeatMode } from '../game/radio-player.ts';
import { groupTracksIntoAlbums } from '../game/radio-albums.ts';
import { useCanvasPage } from './use-canvas-page.ts';
import { useRadioPlayer } from './use-radio-player.ts';

const emit = defineEmits<{ close: [] }>();
const radio = useRadioPlayer();

const REPEATS = [{ id: 'off', label: 'Off' }, { id: 'all', label: 'All' }, { id: 'one', label: 'One' }];
const TRACK_PREFIX = 'track:';

const isRunning = computed(() => radio.isPlaying.value && !radio.isPaused.value);
const ratio = computed(() => (radio.duration.value > 0 ? Math.min(1, radio.currentTime.value / radio.duration.value) : 0));

const deck = computed<PagePanel>(() => {
  const track = radio.currentTrack.value;
  const trackInfo = track ? { name: track.label, where: track.where, find: track.find } : null;
  return {
    heading: 'Tape deck',
    items: [
      {
        kind: 'radio',
        id: 'deck',
        track: trackInfo,
        isPlaying: radio.isPlaying.value,
        isPaused: radio.isPaused.value,
        currentTime: radio.currentTime.value,
        duration: radio.duration.value,
        position: ratio.value,
        repeatMode: radio.repeatMode.value,
        isShuffle: radio.isShuffle.value,
        isFavorite: radio.isCurrentFavorite.value,
      },
    ],
  };
});

const view = ref<'deck' | 'albums'>('deck');
const selectedAlbumIndex = ref(0);

const albumGroups = computed(() => groupTracksIntoAlbums(radio.tracks, radio.currentTrack.value?.id));

const albumPanels = computed<readonly PagePanel[]>(() =>
  albumGroups.value.map((group): PagePanel => ({
    heading: `${group.album.volume}: ${group.album.title}`,
    items: group.tracks.map((entry): PageItem => {
      const isCurrent = radio.currentTrack.value?.id === entry.id;
      const marks = `${isCurrent ? '> ' : ''}${radio.favorites.value.has(entry.file) ? '* ' : ''}`;
      return {
        kind: 'link',
        id: `${TRACK_PREFIX}${entry.id}`,
        label: `${marks}${entry.label}`,
        icon: group.album.art,
      };
    }),
  }))
);

const albumSliderPanel = computed<PagePanel>(() => {
  const currentGroup = albumGroups.value[selectedAlbumIndex.value] ?? albumGroups.value[0];
  const album = currentGroup.album;
  return {
    heading: 'Albums',
    items: [
      {
        kind: 'album_slider',
        id: 'slider',
        volume: album.volume,
        title: album.title,
        subtitle: album.subtitle,
        art: album.art,
        albumIndex: selectedAlbumIndex.value,
        totalAlbums: albumGroups.value.length,
        isHorde: album.isHorde ?? false,
        tracks: currentGroup.tracks.map((track) => ({
          id: track.id,
          name: track.label,
          where: track.where,
          file: track.file,
          isPlaying: radio.currentTrack.value?.id === track.id,
          isPaused: radio.isPaused.value,
          isFavorite: radio.favorites.value.has(track.file),
        })),
      },
    ],
  };
});

const model = computed<PageModel>(() => {
  if (view.value === 'albums') {
    return {
      heading: 'Albums',
      panels: [albumSliderPanel.value],
      buttons: [
        { id: 'to_deck', label: 'Tape Deck', enabled: true, primary: false },
        { id: 'back', label: 'Back', enabled: true, primary: false },
      ],
    };
  }

  return {
    heading: 'Radio',
    panels: [deck.value, ...albumPanels.value],
    buttons: [
      { id: 'to_albums', label: 'Albums', enabled: true, primary: true },
      { id: 'back', label: 'Back', enabled: true, primary: false },
    ],
  };
});

function onStepSeek(delta: number): void {
  const target = Math.max(0, Math.min(radio.duration.value, radio.currentTime.value + delta));
  radio.onSeek(target);
}

function onPlayPauseToggle(): void {
  if (isRunning.value) radio.onPause();
  else radio.onPlay();
}

function press(id: string): void {
  if (id === 'back') {
    emit('close');
    return;
  }
  if (id === 'to_albums') {
    view.value = 'albums';
    return;
  }
  if (id === 'to_deck') {
    view.value = 'deck';
    return;
  }
  const entry = radio.tracks.find((each) => `${TRACK_PREFIX}${each.id}` === id);
  if (entry?.unlocked) radio.onSelectTrack(entry);
}

function toggle(id: string): void {
  if (id === 'shuffle') radio.onToggleShuffle();
  else if (id === 'favorite') radio.onToggleCurrentFavorite();
}

function choose(id: string, option: string): void {
  if (id === 'deck') {
    if (option === 'prev') radio.onPrev();
    else if (option === 'rewind') onStepSeek(-5);
    else if (option === 'play') onPlayPauseToggle();
    else if (option === 'stop') radio.onStop();
    else if (option === 'forward') onStepSeek(5);
    else if (option === 'next') radio.onNext();
    else if (option === 'shuffle') radio.onToggleShuffle();
    else if (option === 'repeat') radio.onToggleRepeat();
    else if (option === 'favorite') radio.onToggleCurrentFavorite();
    return;
  }
  if (id === 'slider') {
    if (option === 'prev') {
      if (selectedAlbumIndex.value > 0) selectedAlbumIndex.value--;
    } else if (option === 'next') {
      if (selectedAlbumIndex.value < albumGroups.value.length - 1) selectedAlbumIndex.value++;
    } else if (option.startsWith('dot:')) {
      const idx = Number(option.slice(4));
      if (!Number.isNaN(idx)) selectedAlbumIndex.value = idx;
    } else if (option.startsWith('track:')) {
      const trackId = option.slice(6);
      const entry = radio.tracks.find((t) => t.id === trackId);
      if (entry) radio.onSelectTrack(entry);
    } else if (option.startsWith('fav:')) {
      const file = option.slice(4);
      radio.onToggleFavorite(file);
    }
  }
}

function slide(id: string, value: number): void {
  if (id === 'deck' && radio.duration.value > 0) {
    radio.onSeek(value * radio.duration.value);
  }
}

useCanvasPage(model, { press, toggle, choose, slide }, () => emit('close'));
</script>
