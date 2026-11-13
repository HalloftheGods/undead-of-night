<template>
  <nav ref="menu" class="px-menu title-menu" :aria-label="section ? `${heading} menu` : 'Main menu'">
    <h2 v-if="heading" class="title-menu-heading">{{ heading }}</h2>
    <button
      v-for="(row, index) in rows"
      :key="row.label"
      :ref="(el) => keep(index, el)"
      class="px-menu-item"
      :class="{ 'is-selected': index === selected, 'is-primary': row.primary && section === null }"
      type="button"
      :aria-current="index === selected"
      @mousemove="moveTo(index)"
      @focus="select(index)"
      @click="open(index)"
    >
      <span class="px-menu-label">{{ menuRowLabel(row, unlock) }}</span>
      <span v-if="showInfo" class="px-menu-line">{{ menuRowLine(row, unlock) }}</span>
    </button>
  </nav>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, useTemplateRef } from 'vue';
import { loadMenuInfo } from '../game/menu-info-pref.ts';
import { loadSoundUnlock } from '../game/sound-unlock.ts';
import { isBackKey, isConfirmKey, MENU_SECTIONS, menuOwnsKey, menuSections, menuRows, menuStep, openingRow, steppedRow, TITLE_MENU } from '../game/title-menu.ts';
import type { KeyFocus, MenuGroup, MenuRow, TitleMenuItem } from '../game/title-menu.ts';
import type { SoundUnlock } from '../game/sound-unlock.ts';
import { menuLabel, menuLine } from '../game/title-menu.ts';
import { useGame } from './use-game.ts';

const { entries = TITLE_MENU } = defineProps<{ entries?: readonly TitleMenuItem[] }>();
/** The highlighted row of whichever list is showing. */
const selected = defineModel<number>({ required: true });
/** Null on the title (the three parents); a group once its parent is opened. */
const section = defineModel<MenuGroup | null>('section', { default: null });
const emit = defineEmits<{ open: [item: TitleMenuItem] }>();
const game = useGame();
const unlock = loadSoundUnlock();
const rows = computed(() => menuRows(section.value, entries, unlock));
const heading = computed(() => menuSections(unlock).find((each) => each.group === section.value)?.label ?? '');
/** The lines under the items, switched on in Options. Read on mount, so coming back from Options shows the change. */
const showInfo = loadMenuInfo();
const buttons: HTMLButtonElement[] = [];
const menu = useTemplateRef<HTMLElement>('menu');
const CONTROLS = 'button, a[href], input, select, textarea, summary, [role="button"]';

function menuRowLabel(row: MenuRow, soundUnlock: SoundUnlock): string {
  return row.item ? menuLabel(row.item, soundUnlock) : row.label;
}

function menuRowLine(row: MenuRow, soundUnlock: SoundUnlock): string {
  return row.item ? menuLine(row.item, soundUnlock) : row.line;
}

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
 * Focus follows the marker, so Space and a screen reader land on the row it shows.
 * The mouse drives this by moving, not by entering: Back must not lose the player's
 * place to whichever row comes back under a resting cursor.
 */
function moveTo(index: number): void {
  select(index);
  buttons[index]?.focus({ preventScroll: true });
}

/** Opens a parent's list pointed at its primary row; the title remembers which parent it came from. */
function enter(group: MenuGroup): void {
  section.value = group;
  selected.value = openingRow(menuRows(group, entries, unlock));
}

function leave(): void {
  const group = section.value;
  if (group === null) return;
  section.value = null;
  selected.value = Math.max(0, MENU_SECTIONS.findIndex((each) => each.group === group));
}

function open(index: number): void {
  game.playUi('click');
  const row = rows.value[index];
  const isBooksSection = row.kind === 'section' && row.group === 'books';
  if (isBooksSection) {
    emit('open', { group: 'books', page: 'books', label: 'News Stand', line: row.line });
    return;
  }
  if (row.kind === 'section' && row.group) enter(row.group);
  else if (row.kind === 'back') leave();
  else if (row.item && !isLockedItem(row.item)) emit('open', row.item);
}

/** A row still shown as ???: it holds its place and opens nothing. */
function isLockedItem(item: TitleMenuItem): boolean {
  return item.needs === 'radio' && !unlock.radio;
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
  if (browserShortcut) return;
  const step = menuStep(event.code);
  const confirming = isConfirmKey(event.code);
  const leaving = isBackKey(event.code) && section.value !== null;
  // The marker decides, so a focused button must not answer Enter as well.
  const isMenuKey = step !== null || confirming || leaving;
  if (isMenuKey) event.preventDefault();
  if (step !== null) moveTo(steppedRow(selected.value, step, rows.value.length));
  if (leaving && !event.repeat) leave();
  const opening = confirming && !event.repeat;
  if (opening) open(selected.value);
}

onMounted(() => window.addEventListener('keydown', onKey));
onBeforeUnmount(() => window.removeEventListener('keydown', onKey));
</script>

<style scoped>
.title-menu-heading {
  margin: 0;
  color: var(--amber);
  font-size: calc(var(--u) * 6);
  font-weight: 400;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  text-shadow: calc(var(--u) * 0.5) calc(var(--u) * 0.5) 0 var(--ink);
}

.title-menu .px-menu-item {
  font-size: calc(var(--u) * 9);
}

.title-menu .px-menu-item.is-primary {
  font-size: calc(var(--u) * 12);
}

.title-menu .px-menu-line {
  max-width: calc(var(--u) * 110);
  text-wrap: balance;
}

/* A short screen drops the lines under the rows; the labels say enough. */
@media (max-height: 520px) {
  .title-menu .px-menu-line {
    display: none;
  }
}
</style>
