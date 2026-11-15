<template>
  <TitlePage heading="Radio" bare boxed class="radio-screen" @close="onPageClose">
    <!-- View Switcher in Lead Section -->
    <template #lead>
      <nav class="radio-view-nav" aria-label="Radio navigation">
        <button
          class="view-btn"
          :class="{ 'is-active': view === 'deck' }"
          type="button"
          @click="view = 'deck'"
        >
          TAPE DECK
        </button>
        <button
          class="view-btn"
          :class="{ 'is-active': view === 'albums' }"
          type="button"
          @click="view = 'albums'"
        >
          ALBUMS
        </button>
      </nav>
    </template>

    <div class="radio-layout">
      <!-- 1. Classic Tape Deck View -->
      <template v-if="view === 'deck'">
        <section class="radio-deck-section" aria-label="Tape Deck">
          <RadioDeck
            :track="currentTrack"
            :is-playing="isPlaying"
            :is-paused="isPaused"
            :current-time="currentTime"
            :duration="duration"
            :repeat-mode="repeatMode"
            :is-shuffle="isShuffle"
            :is-favorite="isCurrentFavorite"
            @play="onPlay"
            @pause="onPause"
            @stop="onStop"
            @next="onNext"
            @prev="onPrev"
            @seek="onSeek"
            @toggle-repeat="onToggleRepeat"
            @toggle-shuffle="onToggleShuffle"
            @toggle-favorite="onToggleCurrentFavorite"
          />
        </section>

        <section class="radio-playlist-section" aria-label="Tape Playlist">
          <RadioPlaylist
            :tracks
            :current-track="currentTrack"
            :is-playing="isPlaying"
            :is-paused="isPaused"
            :favorites
            @select="onSelectTrack"
            @toggle-favorite="onToggleFavorite"
          />
        </section>
      </template>

      <!-- 2. Album Single Slider View (Play Setup Card Aesthetic) -->
      <section v-else class="radio-albums-section" aria-label="Tape Albums Slider">
        <RadioAlbumSlider
          :albums
          :tracks
          :current-track="currentTrack"
          :is-playing="isPlaying"
          :is-paused="isPaused"
          :favorites
          @select-track="onSelectTrack"
          @toggle-favorite="onToggleFavorite"
          @play="onPlay"
          @pause="onPause"
          @next-track="onNext"
          @prev-track="onPrev"
        />
      </section>
    </div>
  </TitlePage>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRadioPlayer } from './use-radio-player.ts';
import { getTapeAlbums } from '../game/radio-albums.ts';
import RadioDeck from './radio/RadioDeck.vue';
import RadioPlaylist from './radio/RadioPlaylist.vue';
import RadioAlbumSlider from './radio/RadioAlbumSlider.vue';
import TitlePage from './TitlePage.vue';
import type { UiState } from '../game/hud-state.ts';

defineProps<{ ui?: UiState }>();
const emit = defineEmits<{ close: [] }>();

type RadioView = 'deck' | 'albums';
const view = ref<RadioView>('deck');

const albums = getTapeAlbums();

function onPageClose(): void {
  emit('close');
}

const {
  tracks,
  currentTrack,
  isPlaying,
  isPaused,
  currentTime,
  duration,
  repeatMode,
  isShuffle,
  favorites,
  isCurrentFavorite,
  onPlay,
  onPause,
  onStop,
  onNext,
  onPrev,
  onSeek,
  onSelectTrack,
  onToggleRepeat,
  onToggleShuffle,
  onToggleFavorite,
  onToggleCurrentFavorite,
} = useRadioPlayer();
</script>

<style scoped src="./radio/radio-albums-view.css"></style>
<style scoped>
.radio-screen :deep(.px-sheet) {
  width: min(calc(var(--u) * 360), 96vw);
  max-height: calc(100vh - calc(var(--u) * 12));
  display: flex;
  flex-direction: column;
  align-items: center;
}

.radio-layout {
  display: flex;
  flex-direction: column;
  gap: calc(var(--u) * 2.5);
  align-items: stretch;
  width: 100%;
}

.radio-deck-section {
  width: 100%;
  display: flex;
  justify-content: center;
}

.radio-playlist-section,
.radio-albums-section,
.radio-album-detail-section {
  width: 100%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  flex: 1;
}
</style>
