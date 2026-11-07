<template>
  <div class="roster" role="radiogroup" aria-label="Survivor" @keydown="onKey">
    <button
      v-for="(each, index) in CHARACTERS"
      :key="each.id"
      :ref="(el) => setTile(index, el)"
      class="roster-tile px-frame"
      :class="{ 'is-chosen': index === chosen }"
      type="button"
      role="radio"
      :aria-checked="index === chosen"
      :aria-label="`${each.name}: ${each.trait}`"
      :tabindex="index === chosen ? 0 : -1"
      @mouseenter="hear(index)"
      @mouseleave="release"
      @focus="spinOn(index)"
      @blur="release"
      @click="pick(index)"
    >
      <span class="roster-figure">
        <SpriteImg v-if="art" :sprite="shownFor(art.survivors[index], index)" />
      </span>
      <span class="roster-name">{{ each.name }}</span>
      <StatBars :skin="index" compact />
    </button>
  </div>
</template>

<script setup lang="ts">
/**
 * The row of five survivors to pick from. The one pointed at or focused turns through every facing;
 * on a touch screen, which has no hover, the chosen one keeps turning. Arrows move the pick and the focus together.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { CHARACTERS } from '../../shared/characters.ts';
import type { ArtBook, SurvivorArt } from '../art/types.ts';
import { rosterStep } from '../game/character-select-view.ts';
import { motion } from '../game/motion.ts';
import { createSpinner, FRONT_FACING, holdsStill } from '../game/survivor-spin.ts';
import { isTouchDevice } from '../game/touch-input.ts';
import SpriteImg from './SpriteImg.vue';
import StatBars from './StatBars.vue';

const { art, chosen } = defineProps<{ art: ArtBook | null; chosen: number }>();
const emit = defineEmits<{ choose: [index: number]; preview: [index: number | null] }>();

const tiles = new Map<number, HTMLElement>();
const spinning = ref<number | null>(null);
const facing = ref(FRONT_FACING);
const spinner = createSpinner((next) => {
  facing.value = next;
});
const touchOnly = isTouchDevice();
const stayStill = computed(() => holdsStill(touchOnly, motion.reduced.value));

function setTile(index: number, el: unknown): void {
  const isElement = el instanceof HTMLElement;
  if (isElement) tiles.set(index, el);
}

function shownFor(survivor: SurvivorArt, index: number) {
  const turning = index === spinning.value;
  return turning ? survivor.portraits[facing.value] : survivor.portrait;
}

/** Turns one survivor in place. Reduced motion only stops a turn nobody pointed at. */
function spinOn(index: number): void {
  if (stayStill.value) return;
  spinning.value = index;
  spinner.start();
}

function release(): void {
  spinner.stop();
  spinning.value = null;
  emit('preview', null);
  if (touchOnly) spinOn(chosen);
}

function hear(index: number): void {
  emit('preview', index);
  spinOn(index);
}

function pick(index: number): void {
  emit('choose', index);
  if (touchOnly) spinOn(index);
}

function onKey(event: KeyboardEvent): void {
  const next = rosterStep(chosen, event.key);
  const stays = next === null;
  if (stays) return;
  event.preventDefault();
  pick(next);
  tiles.get(next)?.focus();
}

onMounted(() => {
  if (touchOnly) spinOn(chosen);
});
onBeforeUnmount(() => spinner.stop());

/** Puts the keyboard on the chosen survivor, as a radio group lands on its checked option. */
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

.roster-figure {
  display: flex;
  justify-content: center;
  align-items: flex-end;
  min-height: calc(var(--u) * 26);
}

.roster-figure img {
  /* Whole device pixels per art pixel, the most that fit the tile with one art pixel of air each side. */
  --sprite-px: max(var(--dpx, 1px), min(round(down, calc(100cqw / 34), var(--dpx, 1px)), round(down, calc(var(--u) * 2), var(--dpx, 1px))));
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

/* Too narrow for a name: the big panel above says who it is. */
@container (max-width: 64px) {
  .roster-name {
    display: none;
  }
}
</style>
