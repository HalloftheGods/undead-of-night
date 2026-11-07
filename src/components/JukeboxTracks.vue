<template>
  <ul class="tracks" aria-label="Tracks" :style="RADIO_BOX" @keydown="onKey">
    <li v-for="(entry, at) in shown" :key="entry.id">
      <button
        :ref="(el) => setTile(first + at, el)"
        class="jukebox-item px-frame"
        :class="{ 'is-playing': entry.id === playingId }"
        type="button"
        :aria-pressed="entry.id === playingId"
        :tabindex="first + at === cursor ? 0 : -1"
        @focus="emit('cursor', first + at)"
        @click="press(entry, first + at)"
      >
        <ShopItemArt v-if="entry.find && radio" class="track-glyph" :sprite="radio" />
        <span v-else class="track-glyph track-record" aria-hidden="true" />
        <span class="track-name">{{ entry.name }}</span>
        <span class="track-where">{{ entry.id === playingId ? 'PLAYING' : entry.where }}</span>
      </button>
    </li>
  </ul>
</template>

<script setup lang="ts">
/**
 * The jukebox's strip: one framed tile per track it can play, a page at a time so the screen never scrolls.
 * A radio find wears the in-game radio; the rest a record. Pressing a tile plays it, or stops it if it is
 * the one playing. Arrows walk every track, turning the page at its ends, so a keyboard needs no Tabs.
 */
import { computed, nextTick } from 'vue';
import type { PixelSprite } from '../art/types.ts';
import { rosterStep } from '../game/character-select-view.ts';
import { pageOf, pageTracks, JUKEBOX_PAGE } from '../game/home/jukebox-view.ts';
import type { MusicEntry } from '../game/sound-test.ts';
import ShopItemArt from './ShopItemArt.vue';

interface TracksProps {
  tracks: readonly MusicEntry[];
  /** The tile the keyboard is on; its page is the one shown. */
  cursor: number;
  playingId: string | null;
  radio: PixelSprite | null;
}

const { tracks, cursor, playingId, radio } = defineProps<TracksProps>();
const emit = defineEmits<{ toggle: [entry: MusicEntry]; cursor: [index: number] }>();

const tiles = new Map<number, HTMLElement>();
const first = computed(() => pageOf(cursor) * JUKEBOX_PAGE);
const shown = computed(() => pageTracks(tracks, pageOf(cursor)));
/** The radio icon's box, sized for its art the way the shop sizes an item's. */
const RADIO_BOX = computed(() => ({ '--art-w': radio?.w ?? 1, '--art-h': radio?.h ?? 1 }));

function setTile(index: number, el: unknown): void {
  const isTile = el instanceof HTMLElement;
  if (isTile) tiles.set(index, el);
  else tiles.delete(index);
}

function press(entry: MusicEntry, index: number): void {
  emit('cursor', index);
  emit('toggle', entry);
}

async function focusTile(index: number): Promise<void> {
  await nextTick();
  tiles.get(index)?.focus();
}

/** Arrows walk the list, so a keyboard gets through thirty tracks without thirty Tabs. */
function onKey(event: KeyboardEvent): void {
  const at = [...tiles].find(([, tile]) => tile === event.target)?.[0];
  const onATile = at !== undefined;
  if (!onATile) return;
  const next = rosterStep(at, event.code, tracks.length);
  const moves = next !== null;
  if (!moves) return;
  event.preventDefault();
  emit('cursor', next);
  void focusTile(next);
}

/** Puts the keyboard on the cursor's tile. */
defineExpose({ focus: () => focusTile(cursor) });
</script>

<style scoped>
/* Two fixed rows of five: a short last page keeps the strip's size, so turning a page moves nothing. */
.tracks {
  --tile-h: calc(var(--u) * 40);
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  grid-template-rows: repeat(2, var(--tile-h));
  gap: calc(var(--u) * 3);
  margin: 0;
  padding: var(--u);
  list-style: none;
}

.jukebox-item {
  --edge: var(--ink-line);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--u);
  width: 100%;
  height: 100%;
  min-width: 0;
  border: 0;
  padding: calc(var(--u) * 2) calc(var(--u) * 2);
  background: var(--ink-raised);
  color: var(--bone-dim);
  font: inherit;
  cursor: pointer;
  outline: none;
}

.jukebox-item:hover,
.jukebox-item:focus-visible {
  --edge: var(--bone-dim);
  color: var(--bone);
}

.jukebox-item.is-playing {
  --edge: var(--amber);
  background: rgba(232, 163, 61, 0.14);
  color: var(--amber);
}

.track-glyph {
  --art-box-w: calc(var(--u) * 18);
  --art-box-h: calc(var(--u) * 18);
  flex: none;
}

/* A record drawn in css: grooves round an amber label, with a glint that turns while it plays. */
.track-record {
  width: calc(var(--u) * 16);
  height: calc(var(--u) * 16);
  margin: var(--u);
  border-radius: 50%;
  background:
    radial-gradient(circle, var(--label, var(--bone-dim)) 0 22%, var(--ink) 22% 30%, transparent 30%),
    conic-gradient(rgba(228, 220, 195, 0.3) 0 40deg, transparent 40deg 180deg, rgba(228, 220, 195, 0.15) 180deg 220deg, transparent 220deg),
    repeating-radial-gradient(circle, #050507 0 var(--u), var(--ink-line) var(--u) calc(var(--u) * 1.5));
}

.is-playing .track-record {
  --label: var(--amber);
  animation: track-spin 1.6s steps(8) infinite;
}

@keyframes track-spin {
  to {
    transform: rotate(360deg);
  }
}

:root[data-motion='reduced'] .is-playing .track-record {
  animation: none;
}

.track-name,
.track-where {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  text-transform: uppercase;
  white-space: nowrap;
}

.track-name {
  font-size: calc(var(--u) * 6);
}

.track-where {
  color: var(--bone-dim);
  font-size: calc(var(--u) * 5);
}

.is-playing .track-where {
  color: var(--amber);
}

/* A phone fits two tiles to a row: five rows, the glyph beside the words. */
@container select (max-width: 420px) {
  .tracks {
    --tile-h: calc(var(--u) * 20);
    grid-template-columns: repeat(2, minmax(0, 1fr));
    grid-template-rows: repeat(5, var(--tile-h));
  }

  .jukebox-item {
    display: grid;
    grid-template: auto auto / auto minmax(0, 1fr);
    column-gap: calc(var(--u) * 2);
    justify-items: start;
    text-align: left;
  }

  .track-glyph {
    grid-row: 1 / 3;
  }
}
</style>
