<template>
  <div ref="root" class="picks">
    <ol class="picks-row" aria-label="Setup">
      <li v-for="card in fixed" :key="card.key" class="picks-stop">
        <div class="pick px-frame is-fixed" role="group" :aria-label="`${card.label}: ${card.name}`">
          <span class="pick-head">
            <span class="pick-number" aria-hidden="true">{{ card.number }}</span>
            <span class="pick-label">{{ card.label }}</span>
          </span>
          <span class="pick-art">
            <img v-if="card.sprite" :src="spriteDataUrl(card.sprite)" alt="" draggable="false" />
            <span class="pick-title" :style="{ '--chars': longestWord(card.name) }">{{ card.name }}</span>
          </span>
        </div>
      </li>
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
            <span class="pick-caret" aria-hidden="true">▾</span>
          </span>
          <span class="pick-art">
            <img v-if="tileUrl(pick)" :src="tileUrl(pick)" alt="" draggable="false" />
            <span :key="shownOption(pick).id" class="pick-title" :class="`is-${pick.key}`" :style="{ '--chars': longestWord(shownOption(pick).name) }">{{ shownOption(pick).name }}</span>
          </span>
        </button>
      </li>
    </ol>

    <div v-if="openPick" class="picks-overlay" @click.self="close()">
      <p class="picks-overlay-label" aria-hidden="true">Choose {{ openPick.label }}</p>
      <ul
        :id="listId(openPick.key)"
        class="picks-list"
        :class="`is-${openPick.key}`"
        :style="{ '--count': openPick.options.length }"
        role="listbox"
        :aria-label="openPick.label"
        @keydown="onListKey"
        @click.self="close()"
      >
        <li v-for="(option, index) in openPick.options" :key="option.id" role="presentation">
          <button
            :ref="(el) => setOption(index, el)"
            class="pick-option"
            :class="{ 'is-chosen': index === openPick.chosen }"
            type="button"
            role="option"
            :aria-selected="index === openPick.chosen"
            @mouseenter="preview(option.id, true)"
            @focus="preview(option.id, false)"
            @mouseleave="unpreview"
            @click="choose(openPick.key, option.id)"
          >
            <span class="pick-option-art" :class="{ 'is-figure': openPick.key === 'who' }">
              <img v-if="optionUrl(openPick.key, option.id)" :src="optionUrl(openPick.key, option.id)" alt="" draggable="false" />
              <span class="pick-option-name" :style="{ '--chars': longestWord(option.name) }">{{ option.name }}</span>
            </span>
            <PickBars :bars="option.bars" />
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * The Play page's stepper: one portrait per pick (mode, difficulty, survivor) showing what is chosen, joined like steps.
 * A portrait opens the list of that pick's options under the row; choosing one, Esc, or a click elsewhere closes it.
 * Pointing at or focusing an option shows it in its portrait until the pointer leaves or the list closes.
 * The chosen survivor shows as their bust; in the list each stands as in play, the one pointed at turning
 * through every facing unless motion is turned down. Every option carries its stat bars.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue';
import type { ComponentPublicInstance } from 'vue';
import type { DifficultyId } from '../../shared/difficulty.ts';
import type { ArtBook, PixelSprite } from '../art/types.ts';
import { spriteDataUrl } from '../engine/sprite-cache.ts';
import type { PlayMode } from '../game/play-flow.ts';
import { chosenOption, longestWord, stepFocus } from '../game/setup-picks.ts';
import type { FixedCard, PickKey, PickOption, SetupPick } from '../game/setup-picks.ts';
import { motion } from '../game/motion.ts';
import { createSpinner, FRONT_FACING } from '../game/survivor-spin.ts';
import PickBars from './PickBars.vue';
import './setup-picks-overlay.css';
import { useGame } from './use-game.ts';

const { picks, art, fixed = [] } = defineProps<{ picks: readonly SetupPick[]; art: ArtBook | null; fixed?: readonly FixedCard[] }>();
const emit = defineEmits<{ choose: [key: PickKey, id: string] }>();
const game = useGame();
const root = useTemplateRef<HTMLElement>('root');

const open = ref<PickKey | null>(null);
const openPick = computed(() => picks.find((pick) => pick.key === open.value) ?? null);
const tiles = new Map<PickKey, HTMLButtonElement>();
let options: HTMLButtonElement[] = [];

/** The option shown in the open pick's portrait instead of its choice, while one is pointed at or focused. */
const previewed = ref<string | null>(null);
const facing = ref(FRONT_FACING);
const spinner = createSpinner((next) => {
  facing.value = next;
});

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

/** What a pick's portrait shows: the option being previewed in its open list, else its choice. */
function shownOption(pick: SetupPick): PickOption {
  const isPreviewing = open.value === pick.key && previewed.value !== null;
  const found = isPreviewing ? pick.options.find((each) => each.id === previewed.value) : undefined;
  return found ?? chosenOption(pick);
}

/** The portrait's picture: the scene, or the survivor's bust. */
function tileUrl(pick: SetupPick): string | undefined {
  const id = shownOption(pick).id;
  const isSurvivor = pick.key === 'who';
  const bust = isSurvivor ? art?.survivors[Number(id)]?.select : undefined;
  return bust ? spriteDataUrl(bust) : spriteUrl(pick.key, id);
}

/** A list option's picture; the survivor being pointed at turns. */
function optionUrl(key: PickKey, id: string): string | undefined {
  const isTurning = key === 'who' && previewed.value === id;
  const turning = isTurning ? art?.survivors[Number(id)]?.portraits[facing.value] : undefined;
  return turning ? spriteDataUrl(turning) : spriteUrl(key, id);
}

/** Motion turned down holds the survivor facing front. */
function spinFromFront(): void {
  const isCalm = motion.reduced.value;
  if (isCalm) spinner.stop();
  else spinner.start();
}

function preview(id: string, byPointer: boolean): void {
  if (byPointer) game.playUi('hover');
  previewed.value = id;
  spinFromFront();
}

function unpreview(): void {
  previewed.value = null;
  spinner.stop();
}

/** The picture for one option in a list: the mode's scene, the difficulty's scene, or the survivor standing. */
function spriteOf(key: PickKey, id: string): PixelSprite | undefined {
  const isArtLoading = art === null;
  if (isArtLoading) return undefined;
  const isMode = key === 'mode';
  const isDifficulty = key === 'difficulty';
  if (isMode) return art.ui.mode[id as PlayMode];
  if (isDifficulty) return art.ui.difficulty[id as DifficultyId];
  return art.survivors[Number(id)]?.portrait;
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
  unpreview();
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
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onPointerDown);
  spinner.stop();
});

defineExpose({ focus: () => tiles.get(picks[0]?.key ?? 'mode')?.focus(), isOpen: () => open.value !== null });
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
  /* As big as the screen allows, leaving --under for what the page puts below the row (callsign, buttons). */
  max-width: min(calc(var(--u) * 150), calc((100vh - var(--under, calc(var(--u) * 150))) * 0.66));
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
  container-type: inline-size;
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

.pick.is-fixed,
.pick.is-fixed:hover {
  --edge: var(--ink-line);
  cursor: default;
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

/* Every portrait shares the cards' portrait shape (CARD_W by TALL_H in src/art/difficulty-card.ts). */
.pick-art {
  position: relative;
  display: block;
  aspect-ratio: 56 / 72;
  overflow: hidden;
  background: var(--ink);
}

/* A survivor stands whole in the frame rather than cropped to fill it. */
.is-figure img {
  object-fit: contain;
}

.pick-art img,
.pick-option-art img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  image-rendering: pixelated;
}

/* The choice's name stands over the bottom of its picture like a film title: big, spaced, lit from below, with a drop shadow. */
.pick-title {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: calc(var(--u) * 16) calc(var(--u) * 3) calc(var(--u) * 4);
  background: linear-gradient(to top, rgba(7, 8, 12, 0.92) 0%, rgba(7, 8, 12, 0.6) 55%, transparent 100%);
  color: var(--bone);
  /* Shrinks so the longest word (--chars letters, each about 1.3em with its spacing) still fits the card's width. */
  font-size: min(clamp(calc(var(--u) * 7), 12cqi, calc(var(--u) * 20)), calc(90cqi / (var(--chars) * 1.3)));
  font-weight: 700;
  line-height: 1;
  letter-spacing: 0.12em;
  /* Spacing trails the last letter too; the indent evens it up so the title sits centred. */
  text-indent: 0.12em;
  text-align: center;
  text-transform: uppercase;
  text-wrap: balance;
  text-shadow:
    0 calc(var(--u) * 0.75) 0 var(--blood),
    0 calc(var(--u) * 1.5) 0 var(--ink),
    0 0 calc(var(--u) * 6) rgba(232, 163, 61, 0.45);
  animation: pick-title-in 360ms steps(6);
}

/* The survivor is the star: their name runs biggest and glows amber. */
.pick-title.is-who {
  color: var(--amber);
  font-size: min(clamp(calc(var(--u) * 9), 17cqi, calc(var(--u) * 26)), calc(90cqi / (var(--chars) * 1.4)));
  letter-spacing: 0.16em;
  text-indent: 0.16em;
}

@keyframes pick-title-in {
  from {
    opacity: 0;
    letter-spacing: 0.5em;
  }
}

:root[data-motion='reduced'] .pick-title {
  animation: none;
}

.pick-caret {
  flex: none;
  margin-left: auto;
  color: var(--bone-dim);
}

/* A phone keeps the three portraits in a row. */
@media (max-width: 600px) {
  .picks-row {
    --join: calc(var(--u) * 3);
  }

  .pick {
    padding: calc(var(--u) * 2);
  }
}
</style>
