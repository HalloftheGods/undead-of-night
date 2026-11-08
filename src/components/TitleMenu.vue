<template>
  <nav ref="menu" class="px-menu title-menu" aria-label="Main menu">
    <section v-for="column in columns" :key="column.group" class="title-menu-group" :class="`is-${column.group}`" :aria-labelledby="`menu-${column.group}`">
      <h2 :id="`menu-${column.group}`" class="title-menu-heading">{{ column.heading }}</h2>
      <button
        v-for="index in column.indices"
        :key="entries[index].label"
        :ref="(el) => keep(index, el)"
        class="px-menu-item"
        :class="{ 'is-selected': index === selected, 'is-primary': index === primary }"
        type="button"
        :aria-current="index === selected"
        @mousemove="moveTo(index)"
        @focus="select(index)"
        @click="open(index)"
      >
        <span class="px-menu-label">{{ menuLabel(entries[index], unlock) }}</span>
        <span v-if="showInfo" class="px-menu-line">{{ menuLine(entries[index], unlock) }}</span>
      </button>
    </section>
  </nav>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, useTemplateRef } from 'vue';
import { loadMenuInfo } from '../game/menu-info-pref.ts';
import { loadSoundUnlock } from '../game/sound-unlock.ts';
import { isConfirmKey, menuLabel, menuLine, menuColumns, menuMove, menuOwnsKey, movedIndex, primaryIndex, TITLE_MENU } from '../game/title-menu.ts';
import type { KeyFocus, TitleMenuItem } from '../game/title-menu.ts';
import { useGame } from './use-game.ts';

const { entries = TITLE_MENU } = defineProps<{ entries?: readonly TitleMenuItem[] }>();
const selected = defineModel<number>({ required: true });
const emit = defineEmits<{ open: [item: TitleMenuItem] }>();
const game = useGame();
const unlock = loadSoundUnlock();
/** The lines under the items, switched on in Options. Read on mount, so coming back from Options shows the change. */
const showInfo = loadMenuInfo();
const columns = computed(() => menuColumns(entries));
const primary = computed(() => primaryIndex(entries));
/** The buttons by their place in the whole list, which the columns break up on screen. */
const buttons: HTMLButtonElement[] = [];
const menu = useTemplateRef<HTMLElement>('menu');
const CONTROLS = 'button, a[href], input, select, textarea, summary, [role="button"]';

function keep(index: number, el: unknown): void {
  const isButton = el instanceof HTMLButtonElement;
  if (isButton) buttons[index] = el;
}

function select(index: number): void {
  const alreadyThere = index === selected.value;
  if (alreadyThere) return;
  selected.value = index;
  game.playUi('hover');
}

/**
 * Focus follows the marker, so Space and a screen reader land on the item it shows.
 * The mouse drives this by moving, not by entering: Back must not lose the player's
 * place to whichever item comes back under a resting cursor.
 */
function moveTo(index: number): void {
  select(index);
  buttons[index]?.focus({ preventScroll: true });
}

function open(index: number): void {
  game.playUi('click');
  emit('open', entries[index]);
}

function focusOf(eventTarget: EventTarget | null): KeyFocus {
  const target = eventTarget instanceof Element ? eventTarget : null;
  const focusInMenu = target !== null && menu.value?.contains(target) === true;
  const focusOnControl = target !== null && target.closest(CONTROLS) !== null;
  return { focusInMenu, focusOnControl };
}

/**
 * Listens as the page bubbles, not in capture: the studio splash stops a key on its way
 * down, so the key that skips the splash never opens a page behind it.
 */
function onKey(event: KeyboardEvent): void {
  const otherControlHasFocus = !menuOwnsKey(focusOf(event.target));
  if (otherControlHasFocus) return;
  const browserShortcut = event.ctrlKey || event.metaKey || event.altKey;
  const move = browserShortcut ? null : menuMove(event.code);
  const confirming = !browserShortcut && isConfirmKey(event.code);
  // The marker decides, so a focused button must not answer Enter as well.
  const isMenuKey = move !== null || confirming;
  if (isMenuKey) event.preventDefault();
  if (move) moveTo(movedIndex(selected.value, move, entries));
  const opening = confirming && !event.repeat;
  if (opening) open(selected.value);
}

onMounted(() => window.addEventListener('keydown', onKey));
onBeforeUnmount(() => window.removeEventListener('keydown', onKey));
</script>

<style scoped>
/* Three columns side by side, so the menu stays short enough to sit under the logo on a sideways phone. */
.title-menu {
  flex-direction: row;
  align-items: flex-start;
  justify-content: center;
  gap: calc(var(--u) * 6);
}

.title-menu-group {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: calc(var(--u) * 2);
}

.title-menu-heading {
  margin: 0 0 var(--u);
  color: var(--amber);
  font-size: calc(var(--u) * 5);
  font-weight: 400;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  text-shadow: calc(var(--u) * 0.5) calc(var(--u) * 0.5) 0 var(--ink);
}

/* Play leads the eye: it sits in the middle and its words run a size bigger. */
.title-menu .px-menu-item {
  padding-inline: calc(var(--u) * 8);
  font-size: calc(var(--u) * 7);
}

.is-play .px-menu-item {
  font-size: calc(var(--u) * 9);
}

.title-menu .px-menu-item.is-primary {
  font-size: calc(var(--u) * 12);
}

/* The side columns keep each line under its own item. */
.title-menu .px-menu-line {
  max-width: calc(var(--u) * 90);
  text-wrap: balance;
}

/* A short screen drops the lines under the items; the labels say enough. */
@media (max-height: 520px) {
  .title-menu .px-menu-line {
    display: none;
  }
}

/* A tall, narrow screen puts Play on top, full width, and Books and Extras side by side under it. */
@media (max-aspect-ratio: 4 / 5) {
  .title-menu {
    display: grid;
    grid-template-areas:
      'play play'
      'books extras';
    justify-items: center;
    row-gap: calc(var(--u) * 6);
  }

  .is-play {
    grid-area: play;
  }

  .is-books {
    grid-area: books;
  }

  .is-extras {
    grid-area: extras;
  }

  .is-books .px-menu-line,
  .is-extras .px-menu-line {
    display: none;
  }

  .is-play .px-menu-line {
    max-width: none;
  }

  .is-books .px-menu-item,
  .is-extras .px-menu-item {
    padding-inline: calc(var(--u) * 6);
  }
}

/* A small phone held upright drops the lines under Play's items too. */
@media (max-aspect-ratio: 4 / 5) and (max-height: 620px) {
  .title-menu .px-menu-line {
    display: none;
  }
}
</style>
