<template>
  <TitlePage heading="Sound Test" size="wide" class="sound-screen" @close="emit('close')">
    <p class="sound-status px-label" role="status" aria-live="polite">{{ status }}</p>
    <p class="sound-finds px-label">{{ findsLine }}</p>

      <section v-for="section in sections" :key="section.heading" class="sound-section">
        <h3 class="px-label">{{ section.heading }}</h3>
        <ul class="sound-list" @keydown="onListKey">
          <li v-for="entry in section.entries" :key="entry.id" class="sound-row">
            <button
              class="sound-item px-frame"
              :class="{ 'is-playing': entry.id === playing?.id, 'is-locked': !entry.unlocked }"
              type="button"
              :disabled="!entry.unlocked"
              :aria-pressed="entry.id === playing?.id"
              :aria-label="entry.unlocked ? entry.name : `${entry.where}, locked`"
              @click="toggle(entry)"
            >
              <span class="sound-name">{{ entry.label }}</span>
              <span class="sound-where">{{ entry.id === playing?.id ? 'PLAYING' : entry.where }}</span>
            </button>
          </li>
        </ul>
      </section>
    <template #actions>
      <PixelButton class="sound-stop" :disabled="playing === null" @press="stop">Stop</PixelButton>
    </template>
  </TitlePage>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { trackTitlePage } from '../game/analytics/index.ts';
import { loadFurthestProgress } from '../game/level-progress.ts';
import { FINDS_HINT, findCount, musicEntries, playEntry, sfxEntries } from '../game/sound-test.ts';
import type { SoundEntry } from '../game/sound-test.ts';
import PixelButton from './PixelButton.vue';
import TitlePage from './TitlePage.vue';
import { useGame } from './use-game.ts';

const emit = defineEmits<{ close: [] }>();
const game = useGame();
trackTitlePage('sound');
const music = musicEntries(loadFurthestProgress(), game.ui.value.style);
const sections = [
  { heading: 'Music', entries: music },
  { heading: 'Sound effects', entries: sfxEntries() },
];
const finds = findCount(music);
const findsLine = `Radio finds: ${finds.found} of ${finds.total}. ${FINDS_HINT}`;
const playing = ref<SoundEntry | null>(null);
const status = computed(() => (playing.value ? `Playing: ${playing.value.name}` : 'Choose a sound. Choose it again to stop.'));
let isOpen = true;

function stop(): void {
  game.audio.stopPreview();
  playing.value = null;
}

async function toggle(entry: SoundEntry): Promise<void> {
  const stopping = playing.value?.id === entry.id;
  if (stopping) return stop();
  await game.audio.unlock();
  const started = isOpen && playEntry(entry, game.audio, () => {
    const stillThis = playing.value?.id === entry.id;
    if (stillThis) playing.value = null;
  });
  playing.value = started ? entry : null;
}

/** Arrows walk the list, so a keyboard gets through sixty sounds without sixty Tabs. */
function onListKey(event: KeyboardEvent): void {
  const forward = event.code === 'ArrowDown' || event.code === 'ArrowRight';
  const back = event.code === 'ArrowUp' || event.code === 'ArrowLeft';
  const isNotArrow = !forward && !back;
  if (isNotArrow) return;
  const buttons = [...document.querySelectorAll<HTMLButtonElement>('.sound-item:not(:disabled)')];
  const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
  const onAnItem = at >= 0;
  if (!onAnItem) return;
  event.preventDefault();
  buttons[(at + (forward ? 1 : -1) + buttons.length) % buttons.length]?.focus();
}

/** The page opens quiet, and the title's music comes back when it closes. */
onMounted(async () => {
  await game.audio.unlock();
  if (isOpen) game.audio.enterPreview();
});

onBeforeUnmount(() => {
  isOpen = false;
  game.audio.leavePreview();
});
</script>

<style scoped>
.sound-finds {
  margin: 0;
  color: var(--bone-dim);
}

.sound-status {
  margin: 0;
  min-height: 1.25em;
}

.sound-section {
  display: flex;
  flex-direction: column;
}

.sound-list {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: calc(var(--u) * 4);
  margin: 0;
  padding: calc(var(--u) * 2);
  list-style: none;
}

:deep(.px-sheet-body) {
  overflow-x: hidden;
}

.sound-item {
  --edge: var(--ink-line);
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: var(--u);
  width: 100%;
  min-height: 44px;
  border: 0;
  padding: calc(var(--u) * 2) calc(var(--u) * 4);
  background: rgba(23, 24, 31, 0.72);
  color: var(--bone);
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.sound-item:hover:not(:disabled),
.sound-item:focus-visible {
  --edge: var(--amber);
  outline: none;
}

.sound-item.is-playing {
  --edge: var(--amber);
  color: var(--amber);
}

.sound-item.is-locked {
  color: var(--bone-dim);
  cursor: default;
}

.sound-where {
  color: var(--bone-dim);
  font-size: 0.75em;
}

.sound-item.is-playing .sound-where {
  color: var(--amber);
}

.sound-stop {
  min-height: 44px;
}

:deep(.px-sheet-foot .px-link) {
  min-height: 44px;
}
</style>
