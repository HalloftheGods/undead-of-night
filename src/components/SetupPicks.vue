<template>
  <div ref="root" class="picks">
    <ol class="picks-row" aria-label="Setup">
      <li v-for="pick in picks" :key="pick.key" class="picks-stop">
        <button
          :ref="(el) => setTile(pick.key, el)"
          class="pick px-frame"
          :class="{ 'is-open': open === pick.key }"
          type="button"
          aria-haspopup="listbox"
          :aria-expanded="open === pick.key"
          :aria-controls="listId(pick.key)"
          :aria-label="`${pick.label}: ${chosenOption(pick).name}. Change`"
          @mouseenter="game.playUi('hover')"
          @click="toggle(pick.key)"
        >
          <span class="pick-head">
            <span class="pick-number" aria-hidden="true">{{ pick.number }}</span>
            <span class="pick-label">{{ pick.label }}</span>
          </span>
          <span class="pick-art">
            <img v-if="spriteUrl(pick.key, chosenOption(pick).id)" :src="spriteUrl(pick.key, chosenOption(pick).id)" alt="" draggable="false" />
          </span>
          <span class="pick-name">{{ chosenOption(pick).name }}<span class="pick-caret" aria-hidden="true">▾</span></span>
        </button>
      </li>
    </ol>

    <ul
      v-if="openPick"
      :id="listId(openPick.key)"
      class="picks-list px-frame"
      :class="`is-${openPick.key}`"
      role="listbox"
      :aria-label="openPick.label"
      @keydown="onListKey"
    >
      <li v-for="(option, index) in openPick.options" :key="option.id" role="presentation">
        <button
          :ref="(el) => setOption(index, el)"
          class="pick-option"
          :class="{ 'is-chosen': index === openPick.chosen }"
          type="button"
          role="option"
          :aria-selected="index === openPick.chosen"
          @mouseenter="game.playUi('hover')"
          @click="choose(openPick.key, option.id)"
        >
          <span class="pick-option-art">
            <img v-if="spriteUrl(openPick.key, option.id)" :src="spriteUrl(openPick.key, option.id)" alt="" draggable="false" />
          </span>
          <span class="pick-option-text">
            <span class="pick-option-name">{{ option.name }}</span>
            <span class="pick-option-line">{{ option.line }}</span>
          </span>
        </button>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
/**
 * The Play page's stepper: one portrait per pick (mode, difficulty, survivor) showing what is chosen, joined like steps.
 * A portrait opens the list of that pick's options under the row; choosing one, Esc, or a click elsewhere closes it.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue';
import type { ComponentPublicInstance } from 'vue';
import type { DifficultyId } from '../../shared/difficulty.ts';
import type { ArtBook, PixelSprite } from '../art/types.ts';
import { spriteDataUrl } from '../engine/sprite-cache.ts';
import type { PlayMode } from '../game/play-flow.ts';
import { chosenOption, stepFocus } from '../game/setup-picks.ts';
import type { PickKey, SetupPick } from '../game/setup-picks.ts';
import { useGame } from './use-game.ts';

const { picks, art } = defineProps<{ picks: readonly SetupPick[]; art: ArtBook | null }>();
const emit = defineEmits<{ choose: [key: PickKey, id: string] }>();
const game = useGame();
const root = useTemplateRef<HTMLElement>('root');

const open = ref<PickKey | null>(null);
const openPick = computed(() => picks.find((pick) => pick.key === open.value) ?? null);
const tiles = new Map<PickKey, HTMLButtonElement>();
let options: HTMLButtonElement[] = [];

type Ref = Element | ComponentPublicInstance | null;

function setTile(key: PickKey, el: Ref): void {
  const isButton = el instanceof HTMLButtonElement;
  if (isButton) tiles.set(key, el);
}

function setOption(index: number, el: Ref): void {
  const isButton = el instanceof HTMLButtonElement;
  if (isButton) options[index] = el;
}

function listId(key: PickKey): string {
  return `setup-pick-${key}`;
}

/** The picture for one option: the mode's scene, the difficulty's scene, or the survivor's bust. */
function spriteOf(key: PickKey, id: string): PixelSprite | undefined {
  const isArtLoading = art === null;
  if (isArtLoading) return undefined;
  const isMode = key === 'mode';
  const isDifficulty = key === 'difficulty';
  if (isMode) return art.ui.mode[id as PlayMode];
  if (isDifficulty) return art.ui.difficulty[id as DifficultyId];
  return art.survivors[Number(id)]?.select;
}

function spriteUrl(key: PickKey, id: string): string | undefined {
  const sprite = spriteOf(key, id);
  return sprite ? spriteDataUrl(sprite) : undefined;
}

/** Opens a pick's list with the keyboard on its current choice, or closes it when it is already open. */
function toggle(key: PickKey): void {
  game.playUi('click');
  const isAlreadyOpen = open.value === key;
  if (isAlreadyOpen) {
    close();
    return;
  }
  options = [];
  open.value = key;
  void nextTick(() => options[openPick.value?.chosen ?? 0]?.focus());
}

/** Shuts the list; `refocus` puts the keyboard back on the pick it came from. */
function close(refocus = true): void {
  const was = open.value;
  open.value = null;
  const shouldRefocus = refocus && was !== null;
  if (shouldRefocus) tiles.get(was)?.focus();
}

function choose(key: PickKey, id: string): void {
  game.playUi('click');
  emit('choose', key, id);
  close();
}

/** Arrows walk the list; Esc closes it and stops there, so the page behind does not also take it as Back. */
function onListKey(event: KeyboardEvent): void {
  const isEscape = event.key === 'Escape';
  if (isEscape) {
    event.preventDefault();
    event.stopPropagation();
    close();
    return;
  }
  const at = options.indexOf(document.activeElement as HTMLButtonElement);
  const to = stepFocus(Math.max(0, at), options.length, event.key);
  const isMove = to !== at;
  if (!isMove) return;
  event.preventDefault();
  options[to]?.focus();
}

/** A press anywhere outside the picks closes an open list, leaving the keyboard where the press put it. */
function onPointerDown(event: PointerEvent): void {
  const isInside = root.value?.contains(event.target as Node) ?? false;
  const isOpen = open.value !== null;
  const isOutsideWhileOpen = isOpen && !isInside;
  if (isOutsideWhileOpen) close(false);
}

onMounted(() => document.addEventListener('pointerdown', onPointerDown));
onBeforeUnmount(() => document.removeEventListener('pointerdown', onPointerDown));

defineExpose({ focus: () => tiles.get('mode')?.focus(), isOpen: () => open.value !== null });
</script>

<style scoped>
.picks {
  position: relative;
}

.picks-row {
  --join: calc(var(--u) * 8);
  display: flex;
  justify-content: center;
  align-items: stretch;
  gap: var(--join);
  margin: 0;
  padding: 0;
  list-style: none;
}

.picks-stop {
  position: relative;
  display: flex;
  align-items: stretch;
  flex: 1 1 0;
  min-width: 0;
  max-width: calc(var(--u) * 130);
}

/* The rule that joins one step to the next, drawn in the gap so every portrait is the same width. */
.picks-stop + .picks-stop::before {
  content: '';
  position: absolute;
  top: 50%;
  right: 100%;
  width: var(--join);
  height: var(--u);
  background: var(--amber);
}

.pick {
  --edge: var(--ink-line);
  display: flex;
  flex-direction: column;
  gap: calc(var(--u) * 2);
  flex: 1;
  min-width: 0;
  border: 0;
  padding: calc(var(--u) * 3);
  background: var(--ink-raised);
  color: var(--bone);
  font: inherit;
  text-transform: uppercase;
  cursor: pointer;
  outline: none;
}

.pick:hover,
.pick:focus-visible,
.pick.is-open {
  --edge: var(--amber);
}

.pick.is-open {
  background: rgba(232, 163, 61, 0.14);
}

.pick-head {
  display: flex;
  align-items: center;
  gap: calc(var(--u) * 3);
  font-size: calc(var(--u) * 5);
  color: var(--bone-dim);
}

.pick-number {
  display: grid;
  place-items: center;
  width: calc(var(--u) * 8);
  height: calc(var(--u) * 8);
  background: var(--amber);
  color: var(--ink);
  font-weight: 700;
}

.pick-art {
  display: block;
  aspect-ratio: 4 / 3;
  overflow: hidden;
  background: var(--ink);
}

.pick-art img,
.pick-option-art img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  image-rendering: pixelated;
}

.pick-name {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: calc(var(--u) * 2);
  min-width: 0;
  overflow: hidden;
  color: var(--amber);
  font-size: calc(var(--u) * 7);
  font-weight: 700;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.pick-caret {
  flex: none;
  color: var(--bone-dim);
}

/* The open list drops over the page below the row, as wide as the row. */
.picks-list {
  --edge: var(--amber);
  position: absolute;
  z-index: 5;
  top: calc(100% + var(--u) * 3);
  left: 0;
  right: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(calc(var(--u) * 110), 1fr));
  gap: calc(var(--u) * 3);
  max-height: 60vh;
  overflow-y: auto;
  margin: 0;
  padding: calc(var(--u) * 3);
  background: rgba(11, 12, 16, 0.97);
  list-style: none;
}

.pick-option {
  --edge: var(--ink-line);
  display: flex;
  align-items: center;
  gap: calc(var(--u) * 4);
  width: 100%;
  border: 0;
  padding: calc(var(--u) * 2);
  background: var(--ink-raised);
  box-shadow: 0 0 0 var(--u) var(--edge);
  color: var(--bone);
  font: inherit;
  text-align: left;
  cursor: pointer;
  outline: none;
}

.pick-option:hover,
.pick-option:focus-visible {
  --edge: var(--amber);
}

.pick-option.is-chosen {
  --edge: var(--amber);
  background: rgba(232, 163, 61, 0.18);
}

.pick-option-art {
  flex: none;
  width: calc(var(--u) * 36);
  aspect-ratio: 4 / 3;
  overflow: hidden;
  background: var(--ink);
}

.pick-option-text {
  display: flex;
  flex-direction: column;
  gap: var(--u);
  min-width: 0;
}

.pick-option-name {
  color: var(--amber);
  font-size: calc(var(--u) * 6);
  font-weight: 700;
  text-transform: uppercase;
}

.pick-option-line {
  color: var(--bone-dim);
  font-size: calc(var(--u) * 5);
  line-height: 1.4;
}

/* A phone keeps the three portraits in a row and lets the list run one per line. */
@media (max-width: 600px) {
  .picks-row {
    --join: calc(var(--u) * 3);
  }

  .pick {
    padding: calc(var(--u) * 2);
  }

  .pick-name {
    font-size: calc(var(--u) * 5);
  }

  .picks-list {
    grid-template-columns: 1fr;
  }
}
</style>
