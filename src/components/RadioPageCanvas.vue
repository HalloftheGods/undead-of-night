<template></template>

<script setup lang="ts">
/**
 * The Radio drawn on the game canvas with the page kit instead of RadioPage (the "In-game menus" switch): the same
 * tape deck and the same tapes, as a deck panel (now playing, seek, transport, repeat, shuffle, favorite) over a
 * scrolling list of tapes. The player is the page's own (use-radio-player).
 */
import { computed } from 'vue';
import type { PageItem, PageModel, PagePanel } from '../engine/page-ui.ts';
import { formatTrackTime } from '../game/radio-player.ts';
import type { RepeatMode } from '../game/radio-player.ts';
import { useCanvasPage } from './use-canvas-page.ts';
import { useRadioPlayer } from './use-radio-player.ts';

const emit = defineEmits<{ close: [] }>();
const radio = useRadioPlayer();

const REPEATS = [{ id: 'off', label: 'Off' }, { id: 'all', label: 'All' }, { id: 'one', label: 'One' }];
const TRACK_PREFIX = 'track:';

const isRunning = computed(() => radio.isPlaying.value && !radio.isPaused.value);
const ratio = computed(() => (radio.duration.value > 0 ? Math.min(1, radio.currentTime.value / radio.duration.value) : 0));
const clock = computed(() => `${formatTrackTime(radio.currentTime.value)} / ${formatTrackTime(radio.duration.value)}`);

const deck = computed<PagePanel>(() => {
  const track = radio.currentTrack.value;
  return {
    heading: 'Tape deck',
    items: [
      { kind: 'text', text: track ? track.label : 'No tape', tone: 'accent' },
      { kind: 'text', text: track ? track.where : '', tone: 'dim' },
      { kind: 'slider', id: 'seek', label: 'Position', value: ratio.value, readout: clock.value },
      {
        kind: 'choice',
        id: 'transport',
        label: 'Transport',
        options: [{ id: 'prev', label: 'Prev' }, { id: 'play', label: isRunning.value ? 'Pause' : 'Play' }, { id: 'stop', label: 'Stop' }, { id: 'next', label: 'Next' }],
        value: '',
      },
      { kind: 'choice', id: 'repeat', label: 'Repeat', options: REPEATS, value: radio.repeatMode.value },
      { kind: 'switch', id: 'shuffle', label: 'Shuffle', on: radio.isShuffle.value, enabled: true },
      { kind: 'switch', id: 'favorite', label: 'Favorite', on: radio.isCurrentFavorite.value, enabled: track !== null },
    ],
  };
});

const tapes = computed<PagePanel>(() => ({
  heading: 'Tapes',
  items: radio.tracks.map((entry): PageItem => {
    const isCurrent = radio.currentTrack.value?.id === entry.id;
    const marks = `${isCurrent ? '> ' : ''}${radio.favorites.value.has(entry.file) ? '* ' : ''}`;
    return { kind: 'link', id: `${TRACK_PREFIX}${entry.id}`, label: `${marks}${entry.label}` };
  }),
}));

const model = computed<PageModel>(() => ({
  heading: 'Radio',
  panels: [deck.value, tapes.value],
  buttons: [{ id: 'back', label: 'Back', enabled: true, primary: false }],
}));

const TRANSPORT: Readonly<Record<string, () => void>> = {
  prev: radio.onPrev,
  play: () => (isRunning.value ? radio.onPause() : radio.onPlay()),
  stop: radio.onStop,
  next: radio.onNext,
};

function press(id: string): void {
  if (id === 'back') {
    emit('close');
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
  if (id === 'transport') TRANSPORT[option]?.();
  if (id !== 'repeat') return;
  // Repeat only steps off, all, one; stepping to the one asked for takes at most two presses.
  let steps = 0;
  while (radio.repeatMode.value !== (option as RepeatMode) && steps < REPEATS.length) {
    radio.onToggleRepeat();
    steps += 1;
  }
}

function slide(id: string, value: number): void {
  if (id === 'seek' && radio.duration.value > 0) radio.onSeek(value * radio.duration.value);
}

useCanvasPage(model, { press, toggle, choose, slide }, () => emit('close'));
</script>
