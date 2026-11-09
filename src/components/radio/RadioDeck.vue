<template>
  <div class="radio-unit" :class="{ 'is-playing': isPlaying, 'is-paused': isPaused }">
    <!-- Top handle & antenna -->
    <div class="deck-top" aria-hidden="true">
      <div class="deck-antenna">
        <div class="antenna-segment" />
        <div class="antenna-tip" />
      </div>
      <div class="deck-handle">
        <div class="handle-bracket is-left" />
        <div class="handle-bar" />
        <div class="handle-bracket is-right" />
      </div>
    </div>

    <!-- Main radio chassis -->
    <div class="deck-chassis px-frame">
      <!-- Left stereo speaker -->
      <div class="deck-speaker is-left" aria-hidden="true">
        <div class="speaker-grille">
          <div class="speaker-core">
            <div class="speaker-dust-cap" />
          </div>
        </div>
      </div>

      <!-- Center section: Tuner, Cassette Bay, Scrubber & Controls -->
      <div class="deck-center">
        <!-- Frequency Tuner / Dial across top of center -->
        <div class="tuner-box">
          <div class="tuner-header">
            <span class="tuner-label">FM STEREO TUNER</span>
            <div class="tuner-indicators">
              <span class="tuner-led" :class="{ 'is-lit': isPlaying }" title="Tuned signal" />
              <span class="tuner-indicator-text">{{ isPlaying && !isPaused ? 'STEREO' : 'IDLE' }}</span>
            </div>
            <span class="tuner-time">{{ formatTrackTime(currentTime) }} / {{ formatTrackTime(duration) }}</span>
          </div>

          <!-- Tuner glass with frequency scale and moving red needle -->
          <div class="tuner-glass" @click="onTunerClick">
            <div class="tuner-scale" aria-hidden="true">
              <span class="scale-mark">88</span>
              <span class="scale-tick" />
              <span class="scale-mark">92</span>
              <span class="scale-tick" />
              <span class="scale-mark">96</span>
              <span class="scale-tick" />
              <span class="scale-mark">100</span>
              <span class="scale-tick" />
              <span class="scale-mark">104</span>
              <span class="scale-tick" />
              <span class="scale-mark">108</span>
            </div>
            <!-- Red tuning needle that travels across the scale with track progress -->
            <div class="tuner-needle" :style="{ left: needlePosition }" />
          </div>
        </div>

        <!-- Cassette Tape Well & Readout -->
        <div class="cassette-well">
          <!-- Digital readout above tape -->
          <div class="cassette-readout">
            <div class="readout-title" :title="track?.name ?? 'No tape loaded'">
              {{ track?.name ?? 'NO CASSETTE LOADED' }}
            </div>
            <div class="readout-sub">
              <span>{{ track?.where ?? 'RADIO' }}</span>
              <span v-if="track?.find" class="readout-find">RADIO FIND</span>
            </div>
          </div>

          <!-- Tape compartment with window and rotating reels -->
          <div class="cassette-tape">
            <div class="tape-screws" aria-hidden="true">
              <span class="screw is-tl" />
              <span class="screw is-tr" />
            </div>

            <div class="tape-label-strip">
              <span class="tape-side">A</span>
              <span class="tape-brand">TYPE II // CrO2</span>
            </div>

            <!-- Tape window showing spools and magnetic ribbon -->
            <div class="tape-window" aria-hidden="true">
              <!-- Left spool -->
              <div class="spool is-left">
                <div class="spool-hub" />
                <div class="spool-teeth" />
                <div class="spool-tape-pack" :style="{ '--fill': spoolLeftFill }" />
              </div>

              <!-- Magnetic tape ribbon bridge -->
              <div class="tape-bridge">
                <div class="tape-ribbon" />
              </div>

              <!-- Right spool -->
              <div class="spool is-right">
                <div class="spool-hub" />
                <div class="spool-teeth" />
                <div class="spool-tape-pack" :style="{ '--fill': spoolRightFill }" />
              </div>
            </div>

            <div class="tape-screws is-bottom" aria-hidden="true">
              <span class="screw is-bl" />
              <span class="screw is-br" />
            </div>
          </div>
        </div>

        <!-- Scrubber track slider -->
        <div class="scrubber-bar">
          <input
            type="range"
            class="scrubber-slider"
            min="0"
            :max="sliderMax"
            :value="currentTime"
            step="0.5"
            aria-label="Track progress"
            @input="onSeek"
          />
        </div>

        <!-- Tactile Tape Deck Transport Buttons -->
        <div class="transport-strip" role="toolbar" aria-label="Tape deck controls">
          <!-- Previous track -->
          <button
            class="deck-btn"
            type="button"
            title="Previous"
            aria-label="Previous track"
            @click="emit('prev')"
          >
            <svg class="pixel-icon" viewBox="0 0 12 12" shape-rendering="crispEdges" aria-hidden="true">
              <rect x="2" y="2" width="2" height="8" fill="currentColor" />
              <polygon points="10,2 10,10 4,6" fill="currentColor" />
            </svg>
          </button>

          <!-- Rewind 5s -->
          <button
            class="deck-btn"
            type="button"
            title="Rewind 5 seconds"
            aria-label="Rewind 5 seconds"
            @click="onStep(-5)"
          >
            <svg class="pixel-icon" viewBox="0 0 12 12" shape-rendering="crispEdges" aria-hidden="true">
              <polygon points="6,2 6,10 1,6" fill="currentColor" />
              <polygon points="11,2 11,10 6,6" fill="currentColor" />
            </svg>
          </button>

          <!-- Play / Pause toggle -->
          <button
            v-if="!isPlaying || isPaused"
            class="deck-btn is-play"
            type="button"
            title="Play"
            aria-label="Play"
            @click="emit('play')"
          >
            <svg class="pixel-icon" viewBox="0 0 12 12" shape-rendering="crispEdges" aria-hidden="true">
              <polygon points="3,2 3,10 10,6" fill="currentColor" />
            </svg>
          </button>
          <button
            v-else
            class="deck-btn is-pause is-active"
            type="button"
            title="Pause"
            aria-label="Pause"
            @click="emit('pause')"
          >
            <svg class="pixel-icon" viewBox="0 0 12 12" shape-rendering="crispEdges" aria-hidden="true">
              <rect x="3" y="2" width="2" height="8" fill="currentColor" />
              <rect x="7" y="2" width="2" height="8" fill="currentColor" />
            </svg>
          </button>

          <!-- Stop -->
          <button
            class="deck-btn is-stop"
            type="button"
            :disabled="!isPlaying && !isPaused"
            title="Stop"
            aria-label="Stop"
            @click="emit('stop')"
          >
            <svg class="pixel-icon" viewBox="0 0 12 12" shape-rendering="crispEdges" aria-hidden="true">
              <rect x="3" y="3" width="6" height="6" fill="currentColor" />
            </svg>
          </button>

          <!-- Fast-Forward 5s -->
          <button
            class="deck-btn"
            type="button"
            title="Fast forward 5 seconds"
            aria-label="Fast forward 5 seconds"
            @click="onStep(5)"
          >
            <svg class="pixel-icon" viewBox="0 0 12 12" shape-rendering="crispEdges" aria-hidden="true">
              <polygon points="1,2 1,10 6,6" fill="currentColor" />
              <polygon points="6,2 6,10 11,6" fill="currentColor" />
            </svg>
          </button>

          <!-- Next track -->
          <button
            class="deck-btn"
            type="button"
            title="Next"
            aria-label="Next track"
            @click="emit('next')"
          >
            <svg class="pixel-icon" viewBox="0 0 12 12" shape-rendering="crispEdges" aria-hidden="true">
              <polygon points="2,2 2,10 8,6" fill="currentColor" />
              <rect x="8" y="2" width="2" height="8" fill="currentColor" />
            </svg>
          </button>
        </div>
      </div>

      <!-- Right speaker & Option Knobs -->
      <div class="deck-speaker is-right" aria-hidden="true">
        <div class="speaker-grille">
          <div class="speaker-core">
            <div class="speaker-dust-cap" />
          </div>
        </div>

        <!-- Mode Switches directly integrated on the radio faceplate -->
        <div class="deck-side-switches" aria-hidden="false">
          <!-- Shuffle button with LED pip -->
          <button
            class="side-btn"
            :class="{ 'is-active': isShuffle }"
            type="button"
            :title="`Shuffle: ${isShuffle ? 'ON' : 'OFF'}`"
            :aria-label="`Shuffle: ${isShuffle ? 'ON' : 'OFF'}`"
            @click="emit('toggleShuffle')"
          >
            <svg class="pixel-icon" viewBox="0 0 12 12" shape-rendering="crispEdges" aria-hidden="true">
              <path d="M1 3h3l4 6h3 M8 3h3 M1 9h3l1.5-2.2 M10 1l2 2-2 2 M10 7l2 2-2 2" stroke="currentColor" stroke-width="1.5" fill="none" />
            </svg>
            <span class="switch-led" :class="{ 'is-lit': isShuffle }" />
          </button>

          <!-- Repeat button with multi-state LED pip -->
          <button
            class="side-btn"
            :class="{ 'is-active': repeatMode !== 'off' }"
            type="button"
            :title="`Repeat: ${repeatMode}`"
            :aria-label="`Repeat mode: ${repeatMode}`"
            @click="emit('toggleRepeat')"
          >
            <svg class="pixel-icon" viewBox="0 0 12 12" shape-rendering="crispEdges" aria-hidden="true">
              <path d="M2 5V3h7v3 M10 7v2H3V6 M1 7l2-2 2 2 M11 5l-2 2-2-2" stroke="currentColor" stroke-width="1.5" fill="none" />
            </svg>
            <span v-if="repeatMode === 'one'" class="repeat-one-badge" aria-hidden="true">1</span>
            <span class="switch-led" :class="repeatLedClass" />
          </button>

          <!-- Favorite heart button -->
          <button
            class="side-btn is-fav-side"
            :class="{ 'is-favorited': isFavorite }"
            type="button"
            :title="isFavorite ? 'Favorited' : 'Favorite track'"
            :aria-label="isFavorite ? 'Favorited' : 'Favorite track'"
            @click="emit('toggleFavorite')"
          >
            <span class="fav-heart">{{ isFavorite ? '♥' : '♡' }}</span>
            <span class="switch-led is-fav-led" :class="{ 'is-lit': isFavorite }" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { formatTrackTime, type RepeatMode } from '../../game/radio-player.ts';
import type { MusicEntry } from '../../game/sound-test.ts';

interface RadioDeckProps {
  track: MusicEntry | null;
  isPlaying: boolean;
  isPaused: boolean;
  currentTime: number;
  duration: number;
  repeatMode: RepeatMode;
  isShuffle: boolean;
  isFavorite: boolean;
}

const {
  track,
  isPlaying,
  isPaused,
  currentTime,
  duration,
  repeatMode,
  isShuffle,
  isFavorite,
} = defineProps<RadioDeckProps>();

const emit = defineEmits<{
  play: [];
  pause: [];
  stop: [];
  next: [];
  prev: [];
  seek: [seconds: number];
  toggleRepeat: [];
  toggleShuffle: [];
  toggleFavorite: [];
}>();

const sliderMax = computed(() => (duration > 0 ? duration : 100));

const needlePosition = computed(() => {
  if (duration <= 0) return '0%';
  const ratio = Math.max(0, Math.min(currentTime / duration, 1));
  return `${(ratio * 96).toFixed(1)}%`;
});

const spoolLeftFill = computed(() => {
  if (duration <= 0) return 0.8;
  const ratio = Math.max(0, Math.min(currentTime / duration, 1));
  return (0.85 - ratio * 0.55).toFixed(2);
});

const spoolRightFill = computed(() => {
  if (duration <= 0) return 0.3;
  const ratio = Math.max(0, Math.min(currentTime / duration, 1));
  return (0.3 + ratio * 0.55).toFixed(2);
});

const repeatLedClass = computed(() => ({
  'is-lit': repeatMode === 'all',
  'is-lit-alt': repeatMode === 'one',
}));

function onSeek(event: Event): void {
  const target = event.target as HTMLInputElement | null;
  const targetSeconds = Number(target?.value ?? 0);
  emit('seek', targetSeconds);
}

function onTunerClick(event: MouseEvent): void {
  if (duration <= 0) return;
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  const ratio = Math.max(0, Math.min((event.clientX - rect.left) / rect.width, 1));
  emit('seek', ratio * duration);
}

function onStep(deltaSeconds: number): void {
  const target = Math.max(0, Math.min(currentTime + deltaSeconds, duration || 999));
  emit('seek', target);
}
</script>

<style scoped src="./radio-deck.css"></style>
