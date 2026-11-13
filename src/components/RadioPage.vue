<template>
  <TitlePage heading="Radio" bare boxed class="radio-screen" @close="emit('close')">
    <div class="radio-layout">
      <!-- Top: In-game pixel art radio / tape deck with transport controls -->
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

      <!-- Bottom: Playlist panel spanning full width -->
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
    </div>
  </TitlePage>
</template>

<script setup lang="ts">
import { useRadioPlayer } from './use-radio-player.ts';
import RadioDeck from './radio/RadioDeck.vue';
import RadioPlaylist from './radio/RadioPlaylist.vue';
import TitlePage from './TitlePage.vue';
import type { UiState } from '../game/hud-state.ts';

defineProps<{ ui?: UiState }>();
const emit = defineEmits<{ close: [] }>();

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
  gap: calc(var(--u) * 3);
  align-items: stretch;
  width: 100%;
}

.radio-deck-section {
  width: 100%;
  display: flex;
  justify-content: center;
}

.radio-playlist-section {
  width: 100%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  flex: 1;
}
</style>
