<template>
  <div class="radio-deck px-frame" :class="{ 'is-playing': isPlaying, 'is-paused': isPaused }">
    <!-- Top boombox handle and antenna -->
    <div class="radio-top-bar" aria-hidden="true">
      <div class="radio-handle">
        <div class="radio-handle-grip" />
      </div>
      <div class="radio-antenna" />
    </div>

    <!-- Main radio faceplate -->
    <div class="radio-body">
      <!-- Left stereo speaker -->
      <div class="radio-speaker is-left" aria-hidden="true">
        <div class="speaker-cone">
          <div class="speaker-core" />
        </div>
      </div>

      <!-- Center deck console -->
      <div class="radio-console">
        <!-- Neon LCD display -->
        <div class="radio-lcd px-frame">
          <div class="lcd-header">
            <span class="lcd-status-badge" :class="statusClass">{{ statusLabel }}</span>
            <div class="lcd-modes">
              <span class="lcd-pill" :class="{ 'is-active': isShuffle }">SHUFFLE</span>
              <span class="lcd-pill" :class="{ 'is-active': repeatMode !== 'off' }">
                {{ repeatMode === 'one' ? 'REP 1' : repeatMode === 'all' ? 'REP ALL' : 'REP' }}
              </span>
              <span v-if="isFavorite" class="lcd-pill is-fav" aria-label="Favorited">♥ FAV</span>
            </div>
          </div>

          <div class="lcd-track-title" :title="track?.name ?? 'No tape loaded'">
            {{ track?.name ?? 'INSERT CASSETTE TAPE' }}
          </div>

          <div class="lcd-sub-line">
            <span class="lcd-origin">{{ track?.where ?? 'EXTRAS // RADIO' }}</span>
            <span class="lcd-time">{{ formatTrackTime(currentTime) }} / {{ formatTrackTime(duration) }}</span>
          </div>

          <!-- Pixel VU meter equalizer -->
          <div class="lcd-vu-meter" aria-hidden="true">
            <div v-for="bar in 8" :key="bar" class="vu-bar" :style="{ '--bar-idx': bar }" />
          </div>
        </div>

        <!-- Cassette deck compartment -->
        <div class="cassette-bay px-frame">
          <div class="cassette-tape">
            <!-- Cassette label -->
            <div class="tape-label">
              <span class="tape-side">SIDE A</span>
              <span class="tape-title">{{ track?.name ?? 'SURVIVAL MIX TAPE' }}</span>
              <span class="tape-type">HQ CrO2</span>
            </div>

            <!-- Tape window with rotating reels -->
            <div class="tape-window">
              <div class="tape-spool is-left">
                <div class="spool-core" />
                <div class="spool-teeth" />
              </div>
              <div class="tape-bridge">
                <div class="tape-ribbon" />
              </div>
              <div class="tape-spool is-right">
                <div class="spool-core" />
                <div class="spool-teeth" />
              </div>
            </div>
          </div>
        </div>

        <!-- Scrubber progress slider -->
        <div class="radio-scrubber-row">
          <input
            type="range"
            class="radio-slider"
            min="0"
            :max="sliderMax"
            :value="currentTime"
            step="0.5"
            aria-label="Track progress"
            @input="onSeek"
          />
        </div>

        <!-- Primary tape deck tactile buttons -->
        <div class="radio-buttons-row" role="toolbar" aria-label="Tape deck controls">
          <button
            class="tape-btn"
            type="button"
            title="Previous track"
            aria-label="Previous track"
            @click="emit('prev')"
          >
            |&lt;&lt;
          </button>
          <button
            class="tape-btn"
            type="button"
            title="Rewind 5 seconds"
            aria-label="Rewind 5 seconds"
            @click="onStep(-5)"
          >
            &lt;&lt;
          </button>
          <button
            v-if="!isPlaying || isPaused"
            class="tape-btn is-play is-primary"
            type="button"
            title="Play"
            aria-label="Play"
            @click="emit('play')"
          >
            PLAY &#9654;
          </button>
          <button
            v-else
            class="tape-btn is-pause is-active"
            type="button"
            title="Pause"
            aria-label="Pause"
            @click="emit('pause')"
          >
            PAUSE ||
          </button>
          <button
            class="tape-btn is-stop"
            type="button"
            :disabled="!isPlaying && !isPaused"
            title="Stop"
            aria-label="Stop"
            @click="emit('stop')"
          >
            STOP &#9632;
          </button>
          <button
            class="tape-btn"
            type="button"
            title="Fast forward 5 seconds"
            aria-label="Fast forward 5 seconds"
            @click="onStep(5)"
          >
            &gt;&gt;
          </button>
          <button
            class="tape-btn"
            type="button"
            title="Next track"
            aria-label="Next track"
            @click="emit('next')"
          >
            &gt;&gt;|
          </button>
        </div>

        <!-- Secondary deck options: Shuffle, Repeat, Favorite -->
        <div class="radio-modes-row">
          <button
            class="mode-btn"
            :class="{ 'is-toggled': isShuffle }"
            type="button"
            :aria-pressed="isShuffle"
            @click="emit('toggleShuffle')"
          >
            <span class="mode-icon" aria-hidden="true">&#128256;</span>
            SHUFFLE {{ isShuffle ? 'ON' : 'OFF' }}
          </button>

          <button
            class="mode-btn"
            :class="{ 'is-toggled': repeatMode !== 'off' }"
            type="button"
            :aria-label="`Repeat mode: ${repeatMode}`"
            @click="emit('toggleRepeat')"
          >
            <span class="mode-icon" aria-hidden="true">&#128257;</span>
            REPEAT {{ repeatMode.toUpperCase() }}
          </button>

          <button
            v-if="track"
            class="mode-btn is-fav-btn"
            :class="{ 'is-favorited': isFavorite }"
            type="button"
            :aria-pressed="isFavorite"
            @click="emit('toggleFavorite')"
          >
            <span class="mode-icon">{{ isFavorite ? '♥' : '♡' }}</span>
            FAVORITE
          </button>
        </div>
      </div>

      <!-- Right stereo speaker -->
      <div class="radio-speaker is-right" aria-hidden="true">
        <div class="speaker-cone">
          <div class="speaker-core" />
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

const statusLabel = computed(() => {
  if (isPaused) return 'PAUSED';
  if (isPlaying) return 'PLAYING';
  return 'STANDBY';
});

const statusClass = computed(() => ({
  'is-active': isPlaying && !isPaused,
  'is-paused': isPaused,
}));

function onSeek(event: Event): void {
  const target = event.target as HTMLInputElement | null;
  const targetSeconds = Number(target?.value ?? 0);
  emit('seek', targetSeconds);
}

function onStep(deltaSeconds: number): void {
  const target = Math.max(0, Math.min(currentTime + deltaSeconds, duration || 999));
  emit('seek', target);
}
</script>

<style scoped>
.radio-deck {
  display: flex;
  flex-direction: column;
  background: #11151c;
  padding: calc(var(--u) * 6);
  border-radius: 4px;
  box-shadow: inset 0 0 calc(var(--u) * 4) rgba(0, 0, 0, 0.8), 0 8px 24px rgba(0, 0, 0, 0.5);
  user-select: none;
}

/* Boombox handle & antenna */
.radio-top-bar {
  display: flex;
  position: relative;
  align-items: center;
  justify-content: center;
  margin-bottom: calc(var(--u) * 4);
  height: calc(var(--u) * 8);
}

.radio-handle {
  display: flex;
  position: relative;
  align-items: center;
  justify-content: center;
  border: calc(var(--u) * 2) solid #3a424e;
  border-bottom: none;
  border-radius: 6px 6px 0 0;
  width: 50%;
  height: 100%;
}

.radio-handle-grip {
  background: #202630;
  border-radius: 2px;
  width: 70%;
  height: calc(var(--u) * 3);
}

.radio-antenna {
  position: absolute;
  top: 0;
  right: calc(var(--u) * 4);
  transform: rotate(45deg);
  transform-origin: bottom center;
  background: linear-gradient(to top, #4b5563, #cbd5e1);
  border-radius: 1px;
  width: calc(var(--u) * 2);
  height: calc(var(--u) * 12);
}

/* Main chassis layout */
.radio-body {
  display: flex;
  gap: calc(var(--u) * 5);
  align-items: stretch;
}

/* Speakers */
.radio-speaker {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  background: radial-gradient(circle, #090c10 20%, #171d25 80%);
  border: calc(var(--u) * 1) solid #28303d;
  border-radius: 4px;
  width: calc(var(--u) * 32);
}

.speaker-cone {
  display: flex;
  align-items: center;
  justify-content: center;
  border: calc(var(--u) * 2) solid #2d3748;
  border-radius: 50%;
  width: calc(var(--u) * 24);
  height: calc(var(--u) * 24);
  background: repeating-radial-gradient(circle, #1a202c, #1a202c 2px, #0f141c 4px);
}

.is-playing .speaker-cone {
  animation: speaker-vibrate 0.15s ease-in-out infinite alternate;
}

@keyframes speaker-vibrate {
  from { transform: scale(0.98); }
  to { transform: scale(1.02); }
}

.speaker-core {
  background: #0d1117;
  border: calc(var(--u) * 1) solid #62c9ff;
  border-radius: 50%;
  width: calc(var(--u) * 8);
  height: calc(var(--u) * 8);
}

/* Console */
.radio-console {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: calc(var(--u) * 4);
  min-width: 0;
}

/* Backlit LCD */
.radio-lcd {
  display: flex;
  flex-direction: column;
  gap: calc(var(--u) * 2);
  background: #05101a;
  padding: calc(var(--u) * 3) calc(var(--u) * 4);
  border-color: #1e3a5f;
  box-shadow: inset 0 0 12px rgba(14, 165, 233, 0.25);
  font-family: inherit;
}

.lcd-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.lcd-status-badge {
  color: #64748b;
  font-size: calc(var(--u) * 4);
  font-weight: bold;
  letter-spacing: 1px;
}

.lcd-status-badge.is-active {
  color: #38bdf8;
  text-shadow: 0 0 6px #0ea5e9;
}

.lcd-status-badge.is-paused {
  color: #facc15;
}

.lcd-modes {
  display: flex;
  gap: calc(var(--u) * 2);
}

.lcd-pill {
  color: #334155;
  font-size: calc(var(--u) * 3.5);
  font-weight: bold;
}

.lcd-pill.is-active {
  color: #38bdf8;
  text-shadow: 0 0 4px #0ea5e9;
}

.lcd-pill.is-fav {
  color: #f43f5e;
}

.lcd-track-title {
  overflow: hidden;
  color: #e0f2fe;
  font-size: calc(var(--u) * 5.5);
  font-weight: bold;
  text-overflow: ellipsis;
  text-shadow: 0 0 8px rgba(98, 201, 255, 0.6);
  white-space: nowrap;
}

.lcd-sub-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: #7dd3fc;
  font-size: calc(var(--u) * 4);
}

.lcd-origin {
  opacity: 0.8;
  letter-spacing: 0.5px;
}

.lcd-time {
  font-variant-numeric: tabular-nums;
}

/* LCD VU Meter */
.lcd-vu-meter {
  display: flex;
  gap: calc(var(--u) * 1.5);
  align-items: flex-end;
  height: calc(var(--u) * 3.5);
}

.vu-bar {
  flex: 1;
  background: #1e293b;
  border-radius: 1px;
  height: 20%;
}

.is-playing .vu-bar {
  background: #38bdf8;
  animation: vu-dance 0.4s ease-in-out infinite alternate;
  animation-delay: calc(var(--bar-idx) * 0.05s);
}

@keyframes vu-dance {
  0% { height: 15%; background: #0284c7; }
  50% { height: 75%; background: #38bdf8; }
  100% { height: 100%; background: #7dd3fc; }
}

/* Cassette Bay */
.cassette-bay {
  display: flex;
  align-items: center;
  justify-content: center;
  background: #090c10;
  padding: calc(var(--u) * 3);
  border-color: #273142;
  box-shadow: inset 0 0 8px #000;
}

.cassette-tape {
  display: flex;
  flex-direction: column;
  background: #1e2530;
  border: calc(var(--u) * 1) solid #374151;
  border-radius: 4px;
  width: 100%;
  padding: calc(var(--u) * 2);
}

.tape-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #f1f5f9;
  color: #0f172a;
  padding: calc(var(--u) * 1) calc(var(--u) * 2);
  border-radius: 2px;
  font-size: calc(var(--u) * 3.5);
  font-weight: bold;
}

.tape-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 60%;
}

.tape-window {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(0, 0, 0, 0.7);
  margin-top: calc(var(--u) * 2);
  padding: calc(var(--u) * 2) calc(var(--u) * 4);
  border-radius: 2px;
}

.tape-spool {
  display: flex;
  position: relative;
  align-items: center;
  justify-content: center;
  border: 2px solid #cbd5e1;
  border-radius: 50%;
  width: calc(var(--u) * 9);
  height: calc(var(--u) * 9);
  background: #111827;
}

.spool-core {
  background: #fff;
  border-radius: 50%;
  width: calc(var(--u) * 3);
  height: calc(var(--u) * 3);
}

.spool-teeth {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  background: #94a3b8;
  width: 2px;
  height: 100%;
}

.is-playing .tape-spool {
  animation: spin-reel 2s linear infinite;
}

.is-paused .tape-spool {
  animation-play-state: paused;
}

@keyframes spin-reel {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.tape-bridge {
  flex: 1;
  height: calc(var(--u) * 2);
  background: #374151;
  margin-inline: calc(var(--u) * 2);
  border-radius: 1px;
}

/* Scrubber */
.radio-scrubber-row {
  display: flex;
  align-items: center;
  width: 100%;
}

.radio-slider {
  width: 100%;
  height: calc(var(--u) * 2);
  background: #1e293b;
  accent-color: #38bdf8;
  cursor: pointer;
}

/* Tape Buttons */
.radio-buttons-row {
  display: flex;
  gap: calc(var(--u) * 2);
}

.tape-btn {
  flex: 1;
  background: #1e2530;
  color: #cbd5e1;
  padding: calc(var(--u) * 2) 0;
  border: calc(var(--u) * 1) solid #374151;
  border-radius: 3px;
  font-family: inherit;
  font-size: calc(var(--u) * 4);
  font-weight: bold;
  cursor: pointer;
  transition: background 0.1s, transform 0.05s;
}

.tape-btn:hover:not(:disabled) {
  background: #283344;
  color: #fff;
}

.tape-btn:active:not(:disabled) {
  transform: translateY(1px);
}

.tape-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.tape-btn.is-primary {
  background: #0369a1;
  border-color: #38bdf8;
  color: #fff;
}

.tape-btn.is-active {
  background: #b45309;
  border-color: #facc15;
  color: #fff;
}

/* Mode toggles */
.radio-modes-row {
  display: flex;
  gap: calc(var(--u) * 3);
  justify-content: center;
}

.mode-btn {
  display: inline-flex;
  gap: calc(var(--u) * 1.5);
  align-items: center;
  background: #161e29;
  color: #94a3b8;
  padding: calc(var(--u) * 1.5) calc(var(--u) * 3);
  border: 1px solid #283548;
  border-radius: 3px;
  font-family: inherit;
  font-size: calc(var(--u) * 3.5);
  font-weight: bold;
  cursor: pointer;
}

.mode-btn:hover {
  background: #1e293b;
  color: #e2e8f0;
}

.mode-btn.is-toggled {
  background: rgba(14, 165, 233, 0.2);
  border-color: #38bdf8;
  color: #38bdf8;
}

.mode-btn.is-favorited {
  background: rgba(244, 63, 94, 0.2);
  border-color: #fb7185;
  color: #fb7185;
}

@media (max-width: 640px) {
  .radio-speaker {
    display: none;
  }
}
</style>
