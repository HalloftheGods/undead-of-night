<template>
  <nav ref="menu" class="px-menu" aria-label="Main menu">
    <button
      v-for="(item, index) in entries"
      :key="item.page"
      ref="items"
      class="px-menu-item"
      :class="{ 'is-selected': index === selected }"
      type="button"
      :aria-current="index === selected"
      @mousemove="moveTo(index)"
      @focus="select(index)"
      @click="open(index)"
    >
      {{ menuLabel(item, unlock) }}
    </button>
  </nav>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, useTemplateRef } from 'vue';
import { loadSoundUnlock } from '../game/sound-unlock.ts';
import { isConfirmKey, menuLabel, menuOwnsKey, menuStep, steppedIndex, TITLE_MENU } from '../game/title-menu.ts';
import type { KeyFocus, TitleMenuItem } from '../game/title-menu.ts';
import type { TitlePage } from '../game/title-menu.ts';
import { useGame } from './use-game.ts';

const { entries = TITLE_MENU } = defineProps<{ entries?: readonly TitleMenuItem[] }>();
const selected = defineModel<number>({ required: true });
const emit = defineEmits<{ open: [page: TitlePage] }>();
const game = useGame();
const unlock = loadSoundUnlock();
const buttons = useTemplateRef<HTMLButtonElement[]>('items');
const menu = useTemplateRef<HTMLElement>('menu');
const CONTROLS = 'button, a[href], input, select, textarea, summary, [role="button"]';

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
  buttons.value?.[index]?.focus({ preventScroll: true });
}

function open(index: number): void {
  game.playUi('click');
  emit('open', entries[index].page);
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
  const step = browserShortcut ? 0 : menuStep(event.code);
  const confirming = !browserShortcut && isConfirmKey(event.code);
  // The marker decides, so a focused button must not answer Enter as well.
  const isMenuKey = step !== 0 || confirming;
  if (isMenuKey) event.preventDefault();
  const isStepping = step !== 0;
  if (isStepping) moveTo(steppedIndex(selected.value, step, entries.length));
  const opening = confirming && !event.repeat;
  if (opening) open(selected.value);
}

onMounted(() => window.addEventListener('keydown', onKey));
onBeforeUnmount(() => window.removeEventListener('keydown', onKey));
</script>
