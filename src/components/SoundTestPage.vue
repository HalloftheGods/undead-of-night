<template>
  <TitlePage heading="Sound Test" size="wide" class="sound-screen" @close="emit('close')">
    <div class="sound-layout">
      <!-- Top Deck: Audio Rack Console -->
      <section class="sound-deck px-frame" aria-label="Audio Console">
        <div class="sound-deck-levels">
          <h3 class="sound-deck-head">Audio Levels</h3>
          <SoundOptions :ui="uiState" />
        </div>

        <div class="sound-deck-monitor">
          <div class="sound-crt px-frame" :class="{ 'is-active': playing !== null }">
            <div class="crt-header">
              <span class="crt-tag">{{ playing ? 'NOW MONITORING' : 'AUDIO RACK STANDBY' }}</span>
              <span class="crt-rate">44.1 kHz</span>
            </div>

            <div class="crt-title">
              {{ playing ? playing.name : 'Select a sound cartridge below' }}
            </div>

            <div class="crt-meta">
              {{ monitorMeta }}
            </div>

            <div class="crt-vu-meter" aria-hidden="true">
              <span
                v-for="bar in 12"
                :key="bar"
                class="vu-bar"
                :class="{ 'is-active': playing !== null }"
                :style="{ animationDelay: `${(bar % 4) * 120}ms` }"
              />
            </div>
          </div>

          <div class="monitor-controls">
            <p class="sound-finds px-label">{{ findsLine }}</p>
            <PixelButton class="sound-stop-btn" :disabled="playing === null" @press="stop">
              Stop Playback
            </PixelButton>
          </div>
        </div>
      </section>

      <!-- Category Filter Tabs -->
      <nav class="sound-tabs" aria-label="Sound categories">
        <PixelButton
          class="sound-tab"
          :class="{ 'is-chosen': activeTab === 'all' }"
          @press="activeTab = 'all'"
        >
          All ({{ allEntries.length }})
        </PixelButton>
        <PixelButton
          class="sound-tab"
          :class="{ 'is-chosen': activeTab === 'music' }"
          @press="activeTab = 'music'"
        >
          Music ({{ music.length }})
        </PixelButton>
        <PixelButton
          class="sound-tab"
          :class="{ 'is-chosen': activeTab === 'sfx' }"
          @press="activeTab = 'sfx'"
        >
          Sound FX ({{ sfx.length }})
        </PixelButton>
        <PixelButton
          class="sound-tab"
          :class="{ 'is-chosen': activeTab === 'finds' }"
          @press="activeTab = 'finds'"
        >
          Radio Finds ({{ finds.total }})
        </PixelButton>
      </nav>

      <!-- Sound Cartridge Grid -->
      <section class="sound-browser" aria-label="Sound Cartridges">
        <ul class="sound-grid" @keydown="onListKey">
          <li v-for="entry in filteredEntries" :key="entry.id" class="sound-grid-cell">
            <SoundChip
              :entry
              :is-playing="entry.id === playing?.id"
              @toggle="toggle"
            />
          </li>
        </ul>
      </section>
    </div>
  </TitlePage>
</template>

<script setup lang="ts">
/**
 * Redesigned Sound Test page: retro-modern audio rack housing sound level controls,
 * real-time VU monitor screen, category cartridge filters, and sound browser.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { trackTitlePage } from '../game/analytics/index.ts';
import type { UiState } from '../game/hud-state.ts';
import { loadFurthestProgress } from '../game/level-progress.ts';
import { FINDS_HINT, findCount, musicEntries, playEntry, sfxEntries } from '../game/sound-test.ts';
import type { SoundEntry } from '../game/sound-test.ts';
import PixelButton from './PixelButton.vue';
import SoundChip from './SoundChip.vue';
import SoundOptions from './SoundOptions.vue';
import TitlePage from './TitlePage.vue';
import { useGame } from './use-game.ts';

const { ui } = defineProps<{ ui?: UiState }>();
const emit = defineEmits<{ close: [] }>();
const game = useGame();
trackTitlePage('sound');

const uiState = computed(() => ui ?? game.ui.value);

const progress = loadFurthestProgress();
const music = musicEntries(progress, game.ui.value.style);
const sfx = sfxEntries();
const allEntries = [...music, ...sfx];

const finds = findCount(music);
const findsLine = `Radio finds: ${finds.found} of ${finds.total}. ${FINDS_HINT}`;

type TabKind = 'all' | 'music' | 'sfx' | 'finds';
const activeTab = ref<TabKind>('all');

const filteredEntries = computed(() => {
  const currentTab = activeTab.value;
  if (currentTab === 'music') return music;
  if (currentTab === 'sfx') return sfx;
  if (currentTab === 'finds') return music.filter((entry) => entry.find);
  return allEntries;
});

const playing = ref<SoundEntry | null>(null);

const monitorMeta = computed(() => {
  const current = playing.value;
  if (!current) return 'SOURCE: IDLE';
  const prefix = current.kind === 'music' ? 'MUSIC' : 'SFX';
  return `${prefix} // ${current.where}`;
});

let isOpen = true;

function stop(): void {
  game.audio.stopPreview();
  playing.value = null;
}

async function toggle(entry: SoundEntry): Promise<void> {
  const isStopping = playing.value?.id === entry.id;
  if (isStopping) {
    stop();
    return;
  }

  await game.audio.unlock();
  const started = isOpen && playEntry(entry, game.audio, () => {
    const isSameEntry = playing.value?.id === entry.id;
    if (isSameEntry) playing.value = null;
  });

  playing.value = started ? entry : null;
}

function onListKey(event: KeyboardEvent): void {
  const forward = event.code === 'ArrowDown' || event.code === 'ArrowRight';
  const back = event.code === 'ArrowUp' || event.code === 'ArrowLeft';
  const isNotArrow = !forward && !back;
  if (isNotArrow) return;

  const buttons = [...document.querySelectorAll<HTMLButtonElement>('.sound-chip:not(:disabled)')];
  const activeElement = document.activeElement as HTMLButtonElement;
  const currentIndex = buttons.indexOf(activeElement);
  const isFocusedOnButton = currentIndex >= 0;
  if (!isFocusedOnButton) return;

  event.preventDefault();
  const nextIndex = (currentIndex + (forward ? 1 : -1) + buttons.length) % buttons.length;
  buttons[nextIndex]?.focus();
}

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
.sound-screen {
  --sound-deck-bg: rgba(23, 24, 31, 0.94);
}

.sound-layout {
  display: flex;
  flex-direction: column;
  gap: calc(var(--u) * 5);
}

/* Audio Rack Console (Top Deck) */
.sound-deck {
  --edge: var(--ink-line);
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: calc(var(--u) * 6);
  padding: calc(var(--u) * 5);
  background: var(--sound-deck-bg);
}

.sound-deck-levels {
  display: flex;
  flex-direction: column;
  gap: calc(var(--u) * 3);
}

.sound-deck-head {
  margin: 0;
  color: var(--amber);
  font-size: calc(var(--u) * 7);
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.sound-deck-monitor {
  display: flex;
  flex-direction: column;
  gap: calc(var(--u) * 3);
  justify-content: space-between;
}

/* Retro CRT / LCD Monitor Box */
.sound-crt {
  --edge: #252830;
  display: flex;
  flex-direction: column;
  gap: calc(var(--u) * 2);
  padding: calc(var(--u) * 4);
  background: #090b0e;
  color: var(--bone);
  border: 1px solid #1c1e24;
}

.sound-crt.is-active {
  --edge: var(--amber);
  background: #0c0f14;
}

.crt-header {
  display: flex;
  justify-content: space-between;
  font-size: calc(var(--u) * 5);
  color: var(--amber);
  letter-spacing: 0.08em;
  font-weight: 700;
}

.crt-rate {
  color: var(--bone-dim);
}

.crt-title {
  font-size: calc(var(--u) * 8);
  font-weight: 700;
  color: var(--bone);
  text-transform: uppercase;
  min-height: calc(var(--u) * 10);
  line-height: 1.25;
}

.sound-crt.is-active .crt-title {
  color: var(--amber);
}

.crt-meta {
  font-size: calc(var(--u) * 5);
  color: var(--bone-dim);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* Equalizer VU Bar Graph */
.crt-vu-meter {
  display: flex;
  align-items: flex-end;
  gap: calc(var(--u) * 2);
  height: calc(var(--u) * 10);
  padding-top: calc(var(--u) * 2);
  border-top: 1px dashed #22252c;
}

.vu-bar {
  flex: 1;
  height: calc(var(--u) * 2);
  background: #252830;
  transition: height 80ms ease, background 80ms ease;
}

.vu-bar.is-active {
  background: var(--amber);
  animation: vu-pulse 400ms ease infinite alternate;
}

@keyframes vu-pulse {
  0% { height: calc(var(--u) * 2); opacity: 0.5; }
  50% { height: calc(var(--u) * 8); opacity: 1; }
  100% { height: calc(var(--u) * 5); opacity: 0.8; }
}

.monitor-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: calc(var(--u) * 3);
}

.sound-finds {
  margin: 0;
  color: var(--bone-dim);
  font-size: calc(var(--u) * 5);
  flex: 1;
}

.sound-stop-btn {
  min-width: calc(var(--u) * 44);
}

/* Category Filter Tabs */
.sound-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: calc(var(--u) * 2);
}

.sound-tab.is-chosen {
  --edge: var(--amber);
  background: rgba(232, 163, 61, 0.16);
  color: var(--amber);
}

/* Sound Grid */
.sound-browser {
  display: flex;
  flex-direction: column;
}

.sound-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: calc(var(--u) * 3);
  margin: 0;
  padding: 0;
  list-style: none;
}

.sound-grid-cell {
  display: flex;
}

@container (max-width: 720px) {
  .sound-deck {
    grid-template-columns: 1fr;
  }
  .sound-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
