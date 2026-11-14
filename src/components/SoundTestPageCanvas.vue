<template><span hidden /></template>

<script setup lang="ts">
/**
 * The Sound Test drawn on the game canvas with the page kit instead of SoundTestPage (the "In-game menus" switch):
 * what is playing and a Stop row, the volume sliders, a filter, and one row per sound to press to hear it.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import type { PageItem, PageModel, PagePanel } from '../engine/page-ui.ts';
import { trackTitlePage } from '../game/analytics/index.ts';
import type { UiState } from '../game/hud-state.ts';
import { loadFurthestProgress } from '../game/level-progress.ts';
import { FINDS_HINT, findCount, musicEntries, playEntry, sfxEntries } from '../game/sound-test.ts';
import type { SoundEntry } from '../game/sound-test.ts';
import { useOptionsPanels } from './options-page-model.ts';
import { useCanvasPage } from './use-canvas-page.ts';
import { useGame } from './use-game.ts';

const { ui } = defineProps<{ ui?: UiState }>();
const emit = defineEmits<{ close: [] }>();
const game = useGame();
trackTitlePage('sound');

const levels = useOptionsPanels(() => ui ?? game.ui.value, 'audio');

const music = musicEntries(loadFurthestProgress(), game.ui.value.style);
const sfx = sfxEntries();
const finds = findCount(music);

type Tab = 'all' | 'music' | 'sfx' | 'finds';
const tab = ref<Tab>('all');
const playing = ref<SoundEntry | null>(null);
const ENTRY_PREFIX = 'entry:';

const TABS = [
  { id: 'all', label: 'All' },
  { id: 'music', label: 'Music' },
  { id: 'sfx', label: 'FX' },
  { id: 'finds', label: 'Finds' },
];

const shown = computed<readonly SoundEntry[]>(() => {
  if (tab.value === 'music') return music;
  if (tab.value === 'sfx') return sfx;
  if (tab.value === 'finds') return music.filter((entry) => entry.find);
  return [...music, ...sfx];
});

const monitor = computed<PagePanel>(() => {
  const current = playing.value;
  const items: PageItem[] = [
    { kind: 'text', text: current ? current.name : 'Pick a sound below', tone: 'accent' },
    { kind: 'text', text: current ? `${current.kind === 'music' ? 'Music' : 'Sound FX'} - ${current.where}` : 'Standing by', tone: 'dim' },
    { kind: 'text', text: `Radio finds: ${finds.found} of ${finds.total}. ${FINDS_HINT}`, tone: 'dim' },
  ];
  if (current) items.push({ kind: 'link', id: 'stop', label: 'Stop playback' });
  return { heading: 'Monitor', items };
});

const sounds = computed<PagePanel>(() => ({
  heading: 'Sounds',
  items: [
    { kind: 'choice', id: 'tab', label: 'Show', options: TABS, value: tab.value },
    ...shown.value.map((entry): PageItem => {
      const mark = playing.value?.id === entry.id ? '> ' : '';
      return { kind: 'link', id: `${ENTRY_PREFIX}${entry.id}`, label: `${mark}${entry.label} - ${entry.where}` };
    }),
  ],
}));

const model = computed<PageModel>(() => ({
  heading: 'Sound Test',
  panels: [monitor.value, ...levels.panels.value, sounds.value],
  buttons: [{ id: 'back', label: 'Back', enabled: true, primary: false }],
}));

let isOpen = true;

function stop(): void {
  game.audio.stopPreview();
  playing.value = null;
}

async function toggle(entry: SoundEntry): Promise<void> {
  if (playing.value?.id === entry.id) {
    stop();
    return;
  }
  await game.audio.unlock();
  const started =
    isOpen &&
    playEntry(entry, game.audio, () => {
      if (playing.value?.id === entry.id) playing.value = null;
    });
  playing.value = started ? entry : null;
}

function press(id: string): void {
  if (id === 'back') emit('close');
  else if (id === 'stop') stop();
  else if (id.startsWith(ENTRY_PREFIX)) {
    const entry = shown.value.find((each) => `${ENTRY_PREFIX}${each.id}` === id);
    if (entry?.unlocked) void toggle(entry);
  } else levels.link(id);
}

function choose(id: string, option: string): void {
  if (id === 'tab') tab.value = option as Tab;
}

useCanvasPage(model, { press, choose, slide: levels.slide }, () => emit('close'));

onMounted(async () => {
  await game.audio.unlock();
  if (isOpen) game.audio.enterPreview();
});

onBeforeUnmount(() => {
  isOpen = false;
  game.audio.leavePreview();
});
</script>
