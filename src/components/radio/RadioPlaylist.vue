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
          class="search-input"
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

<style scoped src="./radio-playlist.css"></style>
