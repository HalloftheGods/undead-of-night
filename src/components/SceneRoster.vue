<template>
  <div class="roster" role="radiogroup" :aria-label="label" :style="CARD_SIZE" @keydown="onKey">
    <button
      v-for="(each, index) in items"
      :key="each.key"
      :ref="(el) => setTile(index, el)"
      class="roster-tile px-frame"
      :class="{ 'is-chosen': index === chosen }"
      type="button"
      role="radio"
      :aria-checked="index === chosen"
      :aria-label="each.aria"
      :tabindex="index === chosen ? 0 : -1"
      @mouseenter="emit('preview', index)"
      @mouseleave="emit('preview', null)"
      @blur="emit('preview', null)"
      @click="emit('choose', index)"
    >
      <span class="roster-figure">
        <SpriteImg v-if="each.sprite" :sprite="each.sprite" />
      </span>
      <span class="roster-name">{{ each.name }}</span>
      <slot :index />
    </button>
  </div>
</template>

<script setup lang="ts">
/**
 * A row of scene tiles to pick from, tiled like the survivor roster, for the mode and difficulty steps.
 * Pointing at one previews it in the big card above; arrows move the pick and the focus together, wrapping.
 * The slot fills each tile's foot (compact bars), given the tile's index.
 */
import { CARD_H, CARD_W } from '../art/difficulty-card.ts';
import type { PixelSprite } from '../art/types.ts';
import { rosterStep } from '../game/character-select-view.ts';
import SpriteImg from './SpriteImg.vue';

export interface SceneTile {
  readonly key: string;
  readonly name: string;
  readonly aria: string;
  readonly sprite: PixelSprite | null;
}

const { items, chosen, label } = defineProps<{ items: readonly SceneTile[]; chosen: number; label: string }>();
const emit = defineEmits<{ choose: [index: number]; preview: [index: number | null] }>();

const tiles = new Map<number, HTMLElement>();
const CARD_SIZE = { '--card-w': CARD_W, '--card-h': CARD_H };

function setTile(index: number, el: unknown): void {
  const isTile = el instanceof HTMLElement;
  if (isTile) tiles.set(index, el);
}

function onKey(event: KeyboardEvent): void {
  const next = rosterStep(chosen, event.key, items.length);
  const isNotRosterKey = next === null;
  if (isNotRosterKey) return;
  event.preventDefault();
  emit('choose', next);
  tiles.get(next)?.focus();
}

/** Puts the keyboard on the chosen tile, as a radio group lands on its checked option. */
defineExpose({ focus: () => tiles.get(chosen)?.focus() });
</script>

<style scoped>
.roster {
  display: flex;
  gap: calc(var(--u) * 3);
  padding: var(--u);
}

.roster-tile {
  --edge: var(--ink-line);
  flex: 1 1 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: calc(var(--u) * 2);
  min-width: 0;
  container-type: inline-size;
  border: 0;
  padding: calc(var(--u) * 2) 0 calc(var(--u) * 3);
  background: var(--ink-raised);
  color: var(--bone-dim);
  font: inherit;
  cursor: pointer;
  outline: none;
}

.roster-tile:hover,
.roster-tile:focus-visible {
  --edge: var(--bone-dim);
  color: var(--bone);
}

.roster-tile.is-chosen {
  --edge: var(--amber);
  background: rgba(232, 163, 61, 0.14);
  color: var(--amber);
}

/* The scene's box keeps its size before the art book loads, so nothing moves when it arrives. */
.roster-figure {
  /* Whole device pixels per art pixel, the most that fit the tile with two art pixels of air each side, at most one and a half units (about a survivor tile's height). */
  --sprite-px: max(var(--dpx, 1px), min(round(down, calc(100cqw / (var(--card-w) + 4)), var(--dpx, 1px)), round(down, calc(var(--u) * 1.5), var(--dpx, 1px))));
  display: flex;
  justify-content: center;
  align-items: flex-end;
  width: calc(var(--sprite-px) * var(--card-w));
  height: calc(var(--sprite-px) * var(--card-h));
}

.roster-figure img {
  flex: none;
}

.roster-name {
  max-width: 100%;
  overflow: hidden;
  font-size: calc(var(--u) * 7);
  text-overflow: ellipsis;
  text-transform: uppercase;
  white-space: nowrap;
}

/* Too narrow for a name: the big card above says which it is. */
@container (max-width: 64px) {
  .roster-name {
    display: none;
  }
}
</style>
