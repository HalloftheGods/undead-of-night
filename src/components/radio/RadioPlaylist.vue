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
          placeholder="SEARCH TAPES OR ALBUMS..."
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

    <!-- Scrollable tape albums container -->
    <div class="playlist-scroll" role="listbox" aria-label="Tape albums" @keydown="onListKey">
      <div
        v-for="group in filteredAlbumGroups"
        :key="group.album.id"
        class="tape-album"
        :class="{ 'has-current': group.hasCurrentTrack, 'is-horde': group.album.isHorde }"
      >
        <!-- Album J-Card Sleeve Header -->
        <div class="album-header">
          <!-- Album Cover Art (Level art or Horde art) -->
          <div class="album-cover-box">
            <SpriteImg :sprite="group.album.art" :scale="1" />
            <span class="album-vol-badge">{{ group.album.volume }}</span>
          </div>

          <!-- Album Meta Info -->
          <div class="album-meta">
            <div class="album-title-row">
              <span class="album-title">{{ group.album.title }}</span>
              <span v-if="group.album.isHorde" class="album-horde-pill">HORDE MODE</span>
            </div>
            <div class="album-sub">
              <span class="album-subtitle">{{ group.album.subtitle }}</span>
              <span class="album-count">{{ group.tracks.length }} {{ group.tracks.length === 1 ? 'TAPE' : 'TAPES' }}</span>
            </div>
          </div>
        </div>

        <!-- Cassette Tapes Tracklist -->
        <ul class="album-tracks">
          <li
            v-for="(entry, index) in group.tracks"
            :key="entry.id"
            class="cassette-tape-row"
            role="option"
            :aria-selected="entry.id === currentTrack?.id"
          >
            <button
              class="cassette-btn"
              :class="{ 'is-current': entry.id === currentTrack?.id }"
              type="button"
              @click="emit('select', entry)"
            >
              <!-- Corner screws on cassette shell -->
              <span class="tape-screw is-tl" aria-hidden="true" />
              <span class="tape-screw is-bl" aria-hidden="true" />

              <!-- Side index or Equalizer playing indicator -->
              <span class="tape-index">
                <span v-if="entry.id === currentTrack?.id && isPlaying && !isPaused" class="mini-eq" aria-hidden="true">
                  <span class="eq-bar" />
                  <span class="eq-bar" />
                  <span class="eq-bar" />
                </span>
                <span v-else-if="entry.id === currentTrack?.id && isPaused" class="mini-pause">⏸</span>
                <span v-else class="side-label">A{{ index + 1 }}</span>
              </span>

              <!-- Tape label band with track title and origin -->
              <span class="tape-label-band">
                <span class="tape-title">{{ entry.name }}</span>
                <span class="tape-meta">
                  <span class="tape-type">TYPE II // CrO2</span>
                  <span class="tape-origin">{{ entry.where }}</span>
                  <span v-if="entry.find" class="tape-badge">RADIO FIND</span>
                </span>
              </span>

              <!-- Spool hub pip -->
              <span class="tape-spool-pip" aria-hidden="true">
                <span class="spool-ring" />
              </span>

              <span class="tape-screw is-tr" aria-hidden="true" />
              <span class="tape-screw is-br" aria-hidden="true" />
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
        </ul>
      </div>

      <!-- Empty state -->
      <div v-if="filteredAlbumGroups.length === 0" class="playlist-empty">
        <p v-if="activeTab === 'favorites'">No favorite tapes yet. Click the heart on any tape to favorite it.</p>
        <p v-else-if="searchQuery">No tapes or albums match "{{ searchQuery }}".</p>
        <p v-else>No unlocked tapes found.</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { MusicEntry } from '../../game/sound-test.ts';
import { groupTracksIntoAlbums } from '../../game/radio-albums.ts';
import SpriteImg from '../SpriteImg.vue';

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
    const matchesTab =
      activeTab.value === 'all' ||
      (activeTab.value === 'favorites' && favorites.has(track.file)) ||
      (activeTab.value === 'finds' && track.find);

    if (!matchesTab) return false;

    const matchesSearch =
      query.length === 0 ||
      track.name.toLowerCase().includes(query) ||
      track.where.toLowerCase().includes(query);

    return matchesSearch;
  });
});

const filteredAlbumGroups = computed(() => {
  return groupTracksIntoAlbums(filteredTracks.value, currentTrack?.id);
});

function onListKey(event: KeyboardEvent): void {
  const isDown = event.code === 'ArrowDown';
  const isUp = event.code === 'ArrowUp';
  if (!isDown && !isUp) return;

  const buttons = [...document.querySelectorAll<HTMLButtonElement>('.playlist-scroll .cassette-btn')];
  const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
  const onButton = at >= 0;
  if (!onButton) return;

  event.preventDefault();
  const nextIdx = (at + (isDown ? 1 : -1) + buttons.length) % buttons.length;
  buttons[nextIdx]?.focus();
}
</script>

<style scoped src="./radio-playlist.css"></style>
