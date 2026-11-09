<template>
  <div class="radio-playlist px-frame">
    <!-- Filter tabs header -->
    <div class="playlist-header">
      <div class="playlist-tabs" role="tablist" aria-label="Playlist filters">
        <button
          class="playlist-tab"
          :class="{ 'is-active': activeTab === 'all' }"
          type="button"
          role="tab"
          :aria-selected="activeTab === 'all'"
          @click="activeTab = 'all'"
        >
          ALL ({{ tracks.length }})
        </button>
        <button
          class="playlist-tab"
          :class="{ 'is-active': activeTab === 'favorites' }"
          type="button"
          role="tab"
          :aria-selected="activeTab === 'favorites'"
          @click="activeTab = 'favorites'"
        >
          ♥ FAVORITES ({{ favoriteCount }})
        </button>
        <button
          class="playlist-tab"
          :class="{ 'is-active': activeTab === 'finds' }"
          type="button"
          role="tab"
          :aria-selected="activeTab === 'finds'"
          @click="activeTab = 'finds'"
        >
          FINDS ({{ findCount }})
        </button>
      </div>

      <!-- Quick search input -->
      <div class="playlist-search">
        <input
          v-model="searchQuery"
          class="search-input px-frame"
          type="text"
          placeholder="SEARCH TAPES..."
          aria-label="Search tracks"
          spellcheck="false"
        />
        <button
          v-if="searchQuery"
          class="search-clear"
          type="button"
          aria-label="Clear search"
          @click="searchQuery = ''"
        >
          ×
        </button>
      </div>
    </div>

    <!-- Scrollable track list -->
    <ul class="playlist-items" role="listbox" aria-label="Unlocked tapes" @keydown="onListKey">
      <li
        v-for="(entry, index) in filteredTracks"
        :key="entry.id"
        class="playlist-row"
        role="option"
        :aria-selected="entry.id === currentTrack?.id"
      >
        <button
          class="track-item"
          :class="{ 'is-current': entry.id === currentTrack?.id }"
          type="button"
          @click="emit('select', entry)"
        >
          <!-- Play indicator / track number -->
          <span class="track-num">
            <span v-if="entry.id === currentTrack?.id && isPlaying && !isPaused" class="mini-eq" aria-hidden="true">
              <span class="eq-bar" />
              <span class="eq-bar" />
              <span class="eq-bar" />
            </span>
            <span v-else-if="entry.id === currentTrack?.id && isPaused" class="mini-pause">⏸</span>
            <span v-else>{{ index + 1 }}</span>
          </span>

          <!-- Track details -->
          <span class="track-info">
            <span class="track-title">{{ entry.name }}</span>
            <span class="track-meta">
              <span class="track-origin">{{ entry.where }}</span>
              <span v-if="entry.find" class="track-badge">RADIO FIND</span>
            </span>
          </span>
        </button>

        <!-- Favorite heart toggle button -->
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

      <!-- Empty state -->
      <li v-if="filteredTracks.length === 0" class="playlist-empty">
        <p v-if="activeTab === 'favorites'">No favorite tapes yet. Click the heart on any track to favorite it.</p>
        <p v-else-if="searchQuery">No tracks match "{{ searchQuery }}".</p>
        <p v-else>No unlocked tapes found.</p>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { MusicEntry } from '../../game/sound-test.ts';

type PlaylistTab = 'all' | 'favorites' | 'finds';

interface RadioPlaylistProps {
  tracks: readonly MusicEntry[];
  currentTrack: MusicEntry | null;
  isPlaying: boolean;
  isPaused: boolean;
  favorites: ReadonlySet<string>;
}

const {
  tracks,
  currentTrack,
  isPlaying,
  isPaused,
  favorites,
} = defineProps<RadioPlaylistProps>();

const emit = defineEmits<{
  select: [track: MusicEntry];
  toggleFavorite: [file: string];
}>();

const activeTab = ref<PlaylistTab>('all');
const searchQuery = ref('');

const favoriteCount = computed(() => tracks.filter((t) => favorites.has(t.file)).length);
const findCount = computed(() => tracks.filter((t) => t.find).length);

const filteredTracks = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();

  return tracks.filter((track) => {
    // Tab criteria
    const matchesTab =
      activeTab.value === 'all' ||
      (activeTab.value === 'favorites' && favorites.has(track.file)) ||
      (activeTab.value === 'finds' && track.find);

    if (!matchesTab) return false;

    // Search query criteria
    const matchesSearch =
      query.length === 0 ||
      track.name.toLowerCase().includes(query) ||
      track.where.toLowerCase().includes(query);

    return matchesSearch;
  });
});

function onListKey(event: KeyboardEvent): void {
  const isDown = event.code === 'ArrowDown';
  const isUp = event.code === 'ArrowUp';
  if (!isDown && !isUp) return;

  const buttons = [...document.querySelectorAll<HTMLButtonElement>('.playlist-items .track-item')];
  const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
  const onButton = at >= 0;
  if (!onButton) return;

  event.preventDefault();
  const nextIdx = (at + (isDown ? 1 : -1) + buttons.length) % buttons.length;
  buttons[nextIdx]?.focus();
}
</script>

<style scoped>
.radio-playlist {
  display: flex;
  flex-direction: column;
  background: #0d1117;
  border-radius: 4px;
  overflow: hidden;
  height: 100%;
  max-height: calc(var(--u) * 110);
}

.playlist-header {
  display: flex;
  flex-direction: column;
  gap: calc(var(--u) * 2);
  background: #161b22;
  padding: calc(var(--u) * 3);
  border-bottom: 1px solid #21262d;
}

.playlist-tabs {
  display: flex;
  gap: calc(var(--u) * 1.5);
}

.playlist-tab {
  flex: 1;
  background: transparent;
  color: #8b949e;
  padding: calc(var(--u) * 1.5) calc(var(--u) * 2);
  border: 1px solid transparent;
  border-radius: 3px;
  font-family: inherit;
  font-size: calc(var(--u) * 3.5);
  font-weight: bold;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}

.playlist-tab:hover {
  color: #c9d1d9;
  background: #21262d;
}

.playlist-tab.is-active {
  color: #58a6ff;
  background: rgba(56, 139, 253, 0.15);
  border-color: #388bfd;
}

.playlist-search {
  position: relative;
  display: flex;
  align-items: center;
}

.search-input {
  width: 100%;
  background: #0d1117;
  color: #c9d1d9;
  padding: calc(var(--u) * 1.5) calc(var(--u) * 3);
  font-family: inherit;
  font-size: calc(var(--u) * 3.5);
  border-color: #30363d;
}

.search-input:focus {
  border-color: #58a6ff;
  outline: none;
}

.search-clear {
  position: absolute;
  right: calc(var(--u) * 2);
  background: transparent;
  border: none;
  color: #8b949e;
  font-size: calc(var(--u) * 4);
  cursor: pointer;
}

/* Playlist scroll view */
.playlist-items {
  list-style: none;
  margin: 0;
  padding: calc(var(--u) * 2);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: calc(var(--u) * 1.5);
  flex: 1;
}

.playlist-row {
  display: flex;
  align-items: center;
  background: #161b22;
  border-radius: 3px;
  border: 1px solid #21262d;
  transition: background 0.1s, border-color 0.1s;
}

.playlist-row:hover {
  background: #21262d;
  border-color: #30363d;
}

.playlist-row:has(.is-current) {
  background: rgba(56, 189, 248, 0.12);
  border-color: #0284c7;
}

.track-item {
  flex: 1;
  display: flex;
  align-items: center;
  gap: calc(var(--u) * 3);
  background: transparent;
  border: none;
  color: inherit;
  padding: calc(var(--u) * 2.5) calc(var(--u) * 3);
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  min-width: 0;
}

.track-num {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  width: calc(var(--u) * 6);
  color: #6e7681;
  font-size: calc(var(--u) * 3.5);
  font-variant-numeric: tabular-nums;
}

.track-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: calc(var(--u) * 0.5);
  min-width: 0;
}

.track-title {
  color: #e6edf3;
  font-size: calc(var(--u) * 4);
  font-weight: bold;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.is-current .track-title {
  color: #38bdf8;
  text-shadow: 0 0 4px rgba(56, 189, 248, 0.4);
}

.track-meta {
  display: flex;
  gap: calc(var(--u) * 2);
  align-items: center;
  font-size: calc(var(--u) * 3);
  color: #8b949e;
}

.track-origin {
  letter-spacing: 0.5px;
}

.track-badge {
  background: rgba(245, 158, 11, 0.2);
  color: #fbbf24;
  padding: 1px calc(var(--u) * 1.5);
  border-radius: 2px;
  font-size: calc(var(--u) * 2.5);
  font-weight: bold;
}

.track-fav-btn {
  background: transparent;
  border: none;
  color: #6e7681;
  padding: calc(var(--u) * 2) calc(var(--u) * 3);
  font-size: calc(var(--u) * 5);
  cursor: pointer;
  transition: transform 0.1s, color 0.1s;
}

.track-fav-btn:hover {
  color: #f43f5e;
  transform: scale(1.15);
}

.track-fav-btn.is-fav {
  color: #f43f5e;
}

/* Equalizer mini animation */
.mini-eq {
  display: flex;
  align-items: flex-end;
  gap: 1.5px;
  height: calc(var(--u) * 3.5);
}

.eq-bar {
  width: 2px;
  background: #38bdf8;
  border-radius: 1px;
  animation: eq-pulse 0.4s ease-in-out infinite alternate;
}

.eq-bar:nth-child(1) { height: 40%; animation-delay: 0.1s; }
.eq-bar:nth-child(2) { height: 90%; animation-delay: 0.25s; }
.eq-bar:nth-child(3) { height: 60%; animation-delay: 0.05s; }

@keyframes eq-pulse {
  from { height: 20%; }
  to { height: 100%; }
}

.mini-pause {
  color: #facc15;
  font-size: calc(var(--u) * 3);
}

.playlist-empty {
  padding: calc(var(--u) * 8);
  text-align: center;
  color: #8b949e;
  font-size: calc(var(--u) * 4);
}
</style>
