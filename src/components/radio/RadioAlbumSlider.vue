<template>
  <div class="album-slider-root" :class="{ 'is-horde-mode': currentAlbum.isHorde }">
    <!-- Slider Row: Left Flipper, Big Beautiful Album Cover, Right Flipper -->
    <div class="slider-showcase">
      <button
        class="slider-flipper is-prev"
        type="button"
        title="Previous Album (Left Arrow)"
        aria-label="Previous Album"
        :disabled="isFirstAlbum"
        @click="onPrev"
      >
        <span class="flipper-glyph" aria-hidden="true">◀</span>
      </button>

      <!-- Big Play Setup-style Album Card -->
      <div class="album-card-wrapper">
        <div class="pick px-frame album-card" role="region" :aria-label="`${currentAlbum.volume}: ${currentAlbum.title}`">
          <span class="pick-head">
            <span class="pick-number" aria-hidden="true">{{ volumeNumber }}</span>
            <span class="pick-label">{{ currentAlbum.volume }} // {{ currentAlbum.subtitle }}</span>
          </span>

          <span class="pick-art">
            <img v-if="currentAlbum.art" :src="spriteDataUrl(currentAlbum.art)" alt="" draggable="false" />
            <span class="pick-title" :style="{ '--chars': longestWord(currentAlbum.title) }">
              {{ currentAlbum.title }}
            </span>
          </span>
        </div>
      </div>

      <button
        class="slider-flipper is-next"
        type="button"
        title="Next Album (Right Arrow)"
        aria-label="Next Album"
        :disabled="isLastAlbum"
        @click="onNext"
      >
        <span class="flipper-glyph" aria-hidden="true">▶</span>
      </button>
    </div>

    <!-- Album Navigation Indicators -->
    <div class="slider-nav" role="tablist" aria-label="Album Selector">
      <button
        v-for="(album, index) in albums"
        :key="album.id"
        class="slider-dot"
        :class="{ 'is-active': index === currentIndex, 'is-horde-dot': album.isHorde }"
        type="button"
        role="tab"
        :aria-selected="index === currentIndex"
        :title="`${album.volume}: ${album.title}`"
        @click="selectAlbum(index)"
      >
        <span class="dot-num">{{ dotLabel(album.volume) }}</span>
      </button>
    </div>

    <!-- Cassette Tracks Underneath the Album Cover -->
    <div class="slider-tracks-section">
      <div class="tracks-header">
        <span class="tracks-heading">CASSETTE TRACKLIST</span>
        <span class="tracks-count">{{ currentTracks.length }} TAPES</span>
      </div>

      <ul class="slider-tracks-list">
        <li
          v-for="(entry, index) in currentTracks"
          :key="entry.id"
          class="cassette-tape-row"
          :class="{ 'is-current-row': isEntryCurrent(entry.id) }"
        >
          <button
            class="cassette-btn"
            :class="{ 'is-current': isEntryCurrent(entry.id) }"
            type="button"
            :aria-label="`Play ${entry.name}`"
            @click="emit('selectTrack', entry)"
          >
            <!-- Corner Screws -->
            <span class="tape-screw is-tl" aria-hidden="true" />
            <span class="tape-screw is-bl" aria-hidden="true" />

            <!-- Tape Side Number & Play Indicator -->
            <span class="tape-index">
              <span v-if="isEntryPlaying(entry.id)" class="mini-eq" aria-hidden="true">
                <span class="eq-bar" />
                <span class="eq-bar" />
                <span class="eq-bar" />
              </span>
              <span v-else-if="isEntryPaused(entry.id)" class="mini-pause">⏸</span>
              <span v-else class="side-label">A{{ index + 1 }}</span>
            </span>

            <!-- Tape Label Band -->
            <span class="tape-label-band">
              <span class="tape-title">{{ entry.name }}</span>
              <span class="tape-meta">
                <span class="tape-type">TYPE II // CrO2</span>
                <span class="tape-origin">{{ entry.where }}</span>
                <span v-if="entry.find" class="tape-badge">RADIO FIND</span>
              </span>
            </span>

            <!-- Spool Hub -->
            <span class="tape-spool-pip" aria-hidden="true">
              <span class="spool-ring" />
            </span>

            <span class="tape-screw is-tr" aria-hidden="true" />
            <span class="tape-screw is-br" aria-hidden="true" />
          </button>

          <!-- Favorite Button -->
          <button
            class="track-fav-btn"
            :class="{ 'is-fav': favorites.has(entry.file) }"
            type="button"
            :title="favorites.has(entry.file) ? 'Remove from favorites' : 'Add to favorites'"
            :aria-label="`Favorite ${entry.name}`"
            @click.stop="emit('toggleFavorite', entry.file)"
          >
            {{ favorites.has(entry.file) ? '♥' : '♡' }}
          </button>
        </li>
      </ul>
    </div>

    <!-- Mini Player Bar at foot -->
    <div v-if="currentTrack" class="slider-mini-player">
      <div class="mini-player-info">
        <span class="mini-player-label">NOW PLAYING:</span>
        <span class="mini-player-title">{{ currentTrack.name }}</span>
      </div>

      <div class="mini-player-controls">
        <button class="mini-ctrl-btn" type="button" title="Previous Track" @click="emit('prevTrack')">
          |◀
        </button>
        <button
          class="mini-ctrl-btn is-play"
          type="button"
          :title="isPlaying && !isPaused ? 'Pause' : 'Play'"
          @click="isPlaying && !isPaused ? emit('pause') : emit('play')"
        >
          {{ isPlaying && !isPaused ? '⏸' : '▶' }}
        </button>
        <button class="mini-ctrl-btn" type="button" title="Next Track" @click="emit('nextTrack')">
          ▶|
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { spriteDataUrl } from '../../engine/sprite-cache.ts';
import type { TapeAlbumDef } from '../../game/radio-albums.ts';
import { longestWord } from '../../game/setup-picks.ts';
import type { MusicEntry } from '../../game/sound-test.ts';
import { useGame } from '../use-game.ts';

interface RadioAlbumSliderProps {
  readonly albums: readonly TapeAlbumDef[];
  readonly tracks: readonly MusicEntry[];
  readonly currentTrack: MusicEntry | null;
  readonly isPlaying: boolean;
  readonly isPaused: boolean;
  readonly favorites: ReadonlySet<string>;
}

const props = defineProps<RadioAlbumSliderProps>();
const emit = defineEmits<{
  selectTrack: [entry: MusicEntry];
  toggleFavorite: [file: string];
  prevTrack: [];
  nextTrack: [];
  play: [];
  pause: [];
}>();

const game = useGame();

const findActiveAlbumIndex = (): number => {
  if (!props.currentTrack) return 0;
  const match = props.albums.findIndex((album) => album.trackFiles.includes(props.currentTrack?.file ?? ''));
  return match >= 0 ? match : 0;
};

const currentIndex = ref<number>(findActiveAlbumIndex());

const currentAlbum = computed<TapeAlbumDef>(() => props.albums[currentIndex.value] ?? props.albums[0]);

const currentTracks = computed<readonly MusicEntry[]>(() => {
  const activeFiles = new Set(currentAlbum.value.trackFiles);
  return props.tracks.filter((track) => activeFiles.has(track.file));
});

const isFirstAlbum = computed(() => currentIndex.value <= 0);
const isLastAlbum = computed(() => currentIndex.value >= props.albums.length - 1);

const volumeNumber = computed(() => {
  const vol = currentAlbum.value.volume;
  if (vol.includes('VOL. ')) return vol.replace('VOL. ', '');
  if (currentAlbum.value.isHorde) return '!';
  return '01';
});

const dotLabel = (volume: string): string => {
  if (volume.includes('VOL. ')) return volume.replace('VOL. ', '');
  return '!';
};

const isEntryCurrent = (id: string): boolean => props.currentTrack?.id === id;
const isEntryPlaying = (id: string): boolean => isEntryCurrent(id) && props.isPlaying && !props.isPaused;
const isEntryPaused = (id: string): boolean => isEntryCurrent(id) && props.isPaused;

function selectAlbum(index: number): void {
  if (index === currentIndex.value) return;
  game.playUi('click');
  currentIndex.value = index;
}

function onPrev(): void {
  if (currentIndex.value > 0) {
    game.playUi('click');
    currentIndex.value--;
  }
}

function onNext(): void {
  if (currentIndex.value < props.albums.length - 1) {
    game.playUi('click');
    currentIndex.value++;
  }
}

function onKeyDown(event: KeyboardEvent): void {
  const isLeft = event.key === 'ArrowLeft';
  const isRight = event.key === 'ArrowRight';

  if (isLeft && !isFirstAlbum.value) {
    event.preventDefault();
    onPrev();
  } else if (isRight && !isLastAlbum.value) {
    event.preventDefault();
    onNext();
  }
}

onMounted(() => window.addEventListener('keydown', onKeyDown));
onBeforeUnmount(() => window.removeEventListener('keydown', onKeyDown));
</script>

<style scoped>
.album-slider-root {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: calc(var(--u) * 3);
  width: 100%;
  max-width: min(calc(var(--u) * 160), 92vw);
  margin: 0 auto;
}

/* Showcase Row */
.slider-showcase {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: calc(var(--u) * 3);
  width: 100%;
}

.slider-flipper {
  display: grid;
  place-items: center;
  width: calc(var(--u) * 10);
  height: calc(var(--u) * 14);
  background: var(--ink-raised);
  border: 1px solid var(--ink-line);
  color: var(--amber);
  font-size: calc(var(--u) * 5);
  cursor: pointer;
  outline: none;
  transition: background-color 0.1s, border-color 0.1s, transform 0.1s;
}

.slider-flipper:hover:not(:disabled) {
  border-color: var(--amber);
  background: rgba(232, 163, 61, 0.18);
  transform: scale(1.08);
}

.slider-flipper:disabled {
  opacity: 0.25;
  cursor: default;
}

.flipper-glyph {
  line-height: 1;
}

/* Album Card Wrapper - SetupPicks card styling */
.album-card-wrapper {
  display: flex;
  justify-content: center;
  width: min(calc(var(--u) * 75), 320px);
}

.album-card {
  --edge: var(--ink-line);
  container-type: inline-size;
  display: flex;
  flex-direction: column;
  gap: calc(var(--u) * 2);
  width: 100%;
  border: 0;
  padding: calc(var(--u) * 3);
  background: var(--ink-raised);
  color: var(--bone);
  font: inherit;
  text-transform: uppercase;
  outline: none;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
  transition: border-color 0.15s, box-shadow 0.15s;
}

.album-card:hover {
  --edge: var(--amber);
  box-shadow: 0 6px 20px rgba(232, 163, 61, 0.25);
}

.is-horde-mode .album-card {
  --edge: var(--blood);
}

.pick-head {
  display: flex;
  align-items: center;
  gap: calc(var(--u) * 2.5);
  font-size: calc(var(--u) * 4);
  color: var(--bone-dim);
  min-width: 0;
}

.pick-number {
  display: grid;
  place-items: center;
  width: calc(var(--u) * 7);
  height: calc(var(--u) * 7);
  background: var(--amber);
  color: var(--ink);
  font-weight: 700;
  flex-shrink: 0;
}

.is-horde-mode .pick-number {
  background: var(--blood);
  color: var(--bone);
}

.pick-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pick-art {
  position: relative;
  display: block;
  aspect-ratio: 56 / 72;
  overflow: hidden;
  background: var(--ink);
}

.pick-art img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  image-rendering: pixelated;
}

.pick-title {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: calc(var(--u) * 8) var(--u) calc(var(--u) * 2);
  background: linear-gradient(to top, rgba(7, 8, 12, 0.95) 0%, rgba(7, 8, 12, 0.6) 60%, transparent 100%);
  color: var(--bone);
  font-size: min(clamp(calc(var(--u) * 4), 11cqi, calc(var(--u) * 10)), calc(90cqi / (var(--chars, 8) * 1.3)));
  font-weight: 700;
  line-height: 1.1;
  letter-spacing: 0.1em;
  text-indent: 0.1em;
  text-align: center;
  text-shadow:
    0 calc(var(--u) * 0.75) 0 var(--blood),
    0 calc(var(--u) * 1.5) 0 var(--ink);
  text-wrap: balance;
}

/* Dots Navigation */
.slider-nav {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: calc(var(--u) * 1.5);
  margin-top: calc(var(--u) * 1);
}

.slider-dot {
  display: grid;
  place-items: center;
  width: calc(var(--u) * 6);
  height: calc(var(--u) * 6);
  background: var(--ink-raised);
  border: 1px solid var(--ink-line);
  color: var(--bone-dim);
  font-size: calc(var(--u) * 3);
  font-weight: bold;
  font-family: inherit;
  cursor: pointer;
  outline: none;
  transition: all 0.1s;
}

.slider-dot:hover {
  border-color: var(--amber);
  color: var(--bone);
}

.slider-dot.is-active {
  background: var(--amber);
  border-color: var(--amber);
  color: var(--ink);
  transform: scale(1.15);
}

.slider-dot.is-horde-dot.is-active {
  background: var(--blood);
  border-color: var(--blood);
  color: var(--bone);
}

/* Cassette Tracks List */
.slider-tracks-section {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: calc(var(--u) * 1.5);
  margin-top: calc(var(--u) * 1);
}

.tracks-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--ink-line);
  padding-bottom: calc(var(--u) * 1);
}

.tracks-heading {
  font-size: calc(var(--u) * 3.5);
  font-weight: bold;
  letter-spacing: 1px;
  color: var(--amber);
}

.tracks-count {
  font-size: calc(var(--u) * 3);
  color: var(--bone-dim);
}

.slider-tracks-list {
  display: flex;
  flex-direction: column;
  gap: calc(var(--u) * 1.5);
  margin: 0;
  padding: 0;
  list-style: none;
}

.cassette-tape-row {
  display: flex;
  align-items: center;
  gap: calc(var(--u) * 1.5);
  width: 100%;
}

.cassette-btn {
  position: relative;
  display: flex;
  align-items: center;
  gap: calc(var(--u) * 2);
  flex: 1;
  min-width: 0;
  padding: calc(var(--u) * 1.5) calc(var(--u) * 3);
  background: #181a24;
  border: 1px solid #2d3040;
  box-shadow: inset 1px 1px 0 #3b3f54, inset -1px -1px 0 #0c0d12;
  color: var(--bone);
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  outline: none;
  transition: background-color 0.1s, border-color 0.1s;
}

.cassette-btn:hover {
  background: #222534;
  border-color: #4f536c;
}

.cassette-btn.is-current {
  border-color: var(--amber);
  background: #25221c;
  box-shadow: inset 1px 1px 0 rgba(232, 163, 61, 0.4), inset -1px -1px 0 #0c0d12;
}

/* Authentic Tape Screws */
.tape-screw {
  position: absolute;
  width: calc(var(--u) * 1.25);
  height: calc(var(--u) * 1.25);
  background: #4a4e64;
  border-radius: 50%;
}

.tape-screw.is-tl {
  top: calc(var(--u) * 0.75);
  left: calc(var(--u) * 0.75);
}

.tape-screw.is-bl {
  bottom: calc(var(--u) * 0.75);
  left: calc(var(--u) * 0.75);
}

.tape-screw.is-tr {
  top: calc(var(--u) * 0.75);
  right: calc(var(--u) * 0.75);
}

.tape-screw.is-br {
  bottom: calc(var(--u) * 0.75);
  right: calc(var(--u) * 0.75);
}

.tape-index {
  display: flex;
  align-items: center;
  justify-content: center;
  width: calc(var(--u) * 6);
  flex-shrink: 0;
  font-size: calc(var(--u) * 3.5);
  font-weight: bold;
  color: var(--amber);
}

.mini-pause {
  font-size: calc(var(--u) * 3);
}

.mini-eq {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  height: calc(var(--u) * 3.5);
}

.eq-bar {
  width: 2px;
  background: var(--amber);
  animation: eq-pulse 0.6s infinite alternate ease-in-out;
}

.eq-bar:nth-child(1) {
  height: 40%;
  animation-delay: 0.1s;
}

.eq-bar:nth-child(2) {
  height: 85%;
  animation-delay: 0.3s;
}

.eq-bar:nth-child(3) {
  height: 60%;
  animation-delay: 0.2s;
}

@keyframes eq-pulse {
  0% {
    height: 25%;
  }
  100% {
    height: 100%;
  }
}

.tape-label-band {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.tape-title {
  font-size: calc(var(--u) * 3.5);
  font-weight: bold;
  color: var(--bone);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cassette-btn.is-current .tape-title {
  color: var(--amber);
}

.tape-meta {
  display: flex;
  align-items: center;
  gap: calc(var(--u) * 2);
  font-size: calc(var(--u) * 2.5);
  color: var(--bone-dim);
}

.tape-badge {
  background: rgba(232, 163, 61, 0.2);
  color: var(--amber);
  border: 1px solid var(--amber);
  padding: 1px 4px;
  font-size: calc(var(--u) * 2);
  font-weight: bold;
}

.tape-spool-pip {
  display: grid;
  place-items: center;
  width: calc(var(--u) * 4);
  height: calc(var(--u) * 4);
  background: #0d0e14;
  border: 1px solid #333748;
  border-radius: 50%;
  flex-shrink: 0;
}

.spool-ring {
  width: calc(var(--u) * 1.5);
  height: calc(var(--u) * 1.5);
  background: #444960;
  border-radius: 50%;
}

.track-fav-btn {
  display: grid;
  place-items: center;
  width: calc(var(--u) * 9);
  height: calc(var(--u) * 9);
  background: #181a24;
  border: 1px solid #2d3040;
  color: var(--bone-dim);
  font-size: calc(var(--u) * 4.5);
  cursor: pointer;
  outline: none;
  flex-shrink: 0;
  transition: color 0.1s, border-color 0.1s;
}

.track-fav-btn:hover {
  border-color: #e04f5f;
  color: #e04f5f;
}

.track-fav-btn.is-fav {
  color: #e04f5f;
  border-color: #e04f5f;
}

/* Mini Player Foot */
.slider-mini-player {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  padding: calc(var(--u) * 2) calc(var(--u) * 3);
  background: #10121a;
  border: 1px solid var(--ink-line);
  margin-top: calc(var(--u) * 2);
  box-sizing: border-box;
}

.mini-player-info {
  display: flex;
  align-items: center;
  gap: calc(var(--u) * 2);
  min-width: 0;
}

.mini-player-label {
  font-size: calc(var(--u) * 2.5);
  color: var(--bone-dim);
  font-weight: bold;
}

.mini-player-title {
  font-size: calc(var(--u) * 3.5);
  color: var(--amber);
  font-weight: bold;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mini-player-controls {
  display: flex;
  gap: calc(var(--u) * 1.5);
  flex-shrink: 0;
}

.mini-ctrl-btn {
  display: grid;
  place-items: center;
  width: calc(var(--u) * 7);
  height: calc(var(--u) * 7);
  background: var(--ink-raised);
  border: 1px solid var(--ink-line);
  color: var(--bone);
  font-size: calc(var(--u) * 3);
  font-weight: bold;
  cursor: pointer;
  outline: none;
  transition: all 0.1s;
}

.mini-ctrl-btn:hover {
  border-color: var(--amber);
  color: var(--amber);
}

.mini-ctrl-btn.is-play {
  color: var(--amber);
  border-color: var(--amber);
}
</style>
