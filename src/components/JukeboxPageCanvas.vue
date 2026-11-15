<template><span hidden /></template>

<script setup lang="ts">
/**
 * Bunker Jukebox drawn on the game canvas with the page kit instead of JukeboxScreen:
 * music playback, track switching, cassette discovery metrics, and live audio volume sliders.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import type { ArtBook } from '../art/types.ts';
import { getBunkerTrack } from '../audio/playlists.ts';
import type { PageItem, PageModel, PagePanel } from '../engine/page-ui.ts';
import type { HomeUi } from '../game/home-hud.ts';
import { loadFurthestProgress } from '../game/level-progress.ts';
import { findCount, jukeboxEntries, musicEntries, playEntry, type MusicEntry } from '../game/sound-test.ts';
import { useCanvasPage } from './use-canvas-page.ts';
import { useGame } from './use-game.ts';

const { home = null, art = null } = defineProps<{ home?: HomeUi | null; art?: ArtBook | null }>();
const game = useGame();

const progress = loadFurthestProgress();
const every = musicEntries(progress, 'campaign');
const tracks = jukeboxEntries(progress);
const finds = findCount(every);
const counts = { unlocked: tracks.length, total: every.length, found: finds.found, finds: finds.total };

const activeTrackFile = computed(() => home?.jukeboxTrack ?? getBunkerTrack());
const playing = ref<MusicEntry | null>(
  tracks.find((t) => t.file === activeTrackFile.value) ?? null
);

const musicVolume = ref(game.audio.musicVolume);
const isMuted = ref(game.audio.muted);

function changeVolume(val: number): void {
  musicVolume.value = val;
  game.audio.musicVolume = val;
  if (game.audio.muted && val > 0) {
    game.audio.muted = false;
    isMuted.value = false;
  }
}

function toggleMute(): void {
  game.audio.muted = !game.audio.muted;
  isMuted.value = game.audio.muted;
  game.playUi('click');
}

function stop(): void {
  game.home.setJukeboxTrack(null);
  game.audio.setBunkerMusic(null);
  game.audio.stopPreview();
  playing.value = null;
}

async function toggleTrack(entry: MusicEntry): Promise<void> {
  const isCurrentlyPlaying = playing.value?.id === entry.id;
  if (isCurrentlyPlaying) {
    stop();
    return;
  }
  await game.audio.unlock();
  game.home.setJukeboxTrack(entry.file);
  game.audio.setBunkerMusic(entry.file);
  const started = playEntry(entry, game.audio, () => {
    if (playing.value?.id === entry.id) {
      playing.value = null;
    }
  });
  playing.value = started ? entry : null;
}

const model = computed<PageModel>(() => {
  const panels: PagePanel[] = [];

  const controlItems: PageItem[] = [
    {
      kind: 'text',
      text: playing.value ? `NOW PLAYING: ${playing.value.name}` : 'NO TRACK PLAYING. SELECT A TAPE BELOW.',
      tone: playing.value ? 'accent' : 'dim',
    },
    {
      kind: 'slider',
      id: 'volume',
      label: 'MUSIC VOLUME',
      value: musicVolume.value,
      readout: `${Math.round(musicVolume.value * 100)}%`,
    },
    {
      kind: 'switch',
      id: 'mute',
      label: 'AUDIO MUTE',
      on: isMuted.value,
      enabled: true,
    },
    {
      kind: 'link',
      id: 'stop',
      label: 'STOP JUKEBOX PLAYBACK',
      value: playing.value ? 'ACTIVE' : 'IDLE',
      sub: 'STOPS CURRENT PREVIEW AND RESUMES BUNKER AMBIENCE',
      disabled: playing.value === null,
    },
  ];

  panels.push({
    heading: 'JUKEBOX AUDIO CONTROLS',
    items: controlItems,
  });

  panels.push({
    heading: 'COLLECTION PROGRESS',
    items: [
      {
        kind: 'stat',
        label: 'TRACKS UNLOCKED',
        value: `${counts.unlocked} OF ${counts.total}`,
      },
      {
        kind: 'stat',
        label: 'RADIO CASSETTES FOUND',
        value: `${counts.found} OF ${counts.finds}`,
      },
      {
        kind: 'text',
        text: 'SEARCH BOOMBOXES AND RADIOS IN TOWNS TO DISCOVER MORE TAPES.',
        tone: 'dim',
      },
    ],
  });

  const radioSprite = art?.ui?.pickupIcons?.radio;
  const trackItems: PageItem[] = tracks.map((track) => {
    const isPlaying = playing.value?.id === track.id;
    return {
      kind: 'link',
      id: `track:${track.id}`,
      label: `${isPlaying ? '> ' : ''}${track.name}`,
      icon: radioSprite,
      value: isPlaying ? 'PLAYING' : 'READY',
      sub: `${track.where} [CLICK TO ${isPlaying ? 'STOP' : 'PLAY'}]`,
    };
  });

  panels.push({
    heading: 'CAMP TAPE COLLECTION',
    items: trackItems,
  });

  return {
    heading: 'BUNKER JUKEBOX',
    width: 420,
    panels,
    buttons: [{ id: 'close', label: 'CLOSE', enabled: true, primary: true }],
  };
});

function press(id: string): void {
  if (id === 'close') {
    game.home.closeStation();
    return;
  }
  if (id === 'stop') {
    stop();
    return;
  }
  const isTrack = id.startsWith('track:');
  if (isTrack) {
    const trackId = id.slice(6);
    const target = tracks.find((t) => t.id === trackId);
    if (target) {
      void toggleTrack(target);
    }
  }
}

function slide(id: string, value: number): void {
  if (id === 'volume') {
    changeVolume(value);
  }
}

function toggle(id: string): void {
  if (id === 'mute') {
    toggleMute();
  }
}

onMounted(async () => {
  await game.audio.unlock();
  const initial = tracks.find((t) => t.file === activeTrackFile.value);
  if (initial) playing.value = initial;
});

onBeforeUnmount(() => {
  game.audio.stopPreview();
});

useCanvasPage(model, { press, slide, toggle }, () => game.home.closeStation());
</script>
