<template>
  <!--
    The phone's actions as a tab bar across the foot of the screen, each an icon over its word.
    Pause sits under the left thumb and Sprint at the right end, under the right one.
  -->
  <nav class="touch-tabs" data-touch-pad aria-label="Touch controls">
    <TouchTab
      v-for="tab in tabs"
      :key="tab.id"
      :label="tabLabel(tab, hasKnife)"
      :glyph="tab.glyph"
      :lit="isLit(tab)"
      @press="press(tab)"
      @release="release(tab)"
    />
  </nav>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
import { tabLabel, touchTabsFor } from '../game/touch-tabs.ts';
import type { TouchTab as Tab } from '../game/touch-tabs.ts';
import TouchTab from './TouchTab.vue';
import { useGame } from './use-game.ts';

/** The local player sits in a car: the horn tab shows. */
const props = defineProps<{ seated?: boolean }>();
const game = useGame();
const tabs = computed(() => touchTabsFor(props.seated === true));
const input = game.input;
const held = ref<string[]>([]);
const hasKnife = computed(() => game.ui.value.hud?.knife === true);

function isLit(tab: Tab): boolean {
  const isHold = tab.kind === 'hold';
  if (isHold) return held.value.includes(tab.code);
  const isPack = tab.id === 'backpack';
  return isPack && game.ui.value.backpackOpen;
}

function tapTab(id: 'pause' | 'backpack'): void {
  const isPause = id === 'pause';
  if (isPause) game.togglePause();
  else game.toggleBackpack();
}

function press(tab: Tab): void {
  const isTap = tab.kind === 'tap';
  if (isTap) return tapTab(tab.id);
  held.value = [...held.value, tab.code];
  input.padDown(tab.code);
}

function release(tab: Tab): void {
  const isTap = tab.kind === 'tap';
  if (isTap) return;
  const wasDown = held.value.includes(tab.code);
  if (!wasDown) return;
  held.value = held.value.filter((each) => each !== tab.code);
  input.padUp(tab.code);
}

onBeforeUnmount(() => {
  held.value.forEach((code) => input.padUp(code));
  game.closeBackpack();
});
</script>

<style scoped>
/*
 * Full width, flush with the bottom edge, its own floor under the home bar: the safe area is
 * padding inside the bar, so the bar's dark reaches the glass and the tabs stay above the bar.
 */
.touch-tabs {
  display: grid;
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  grid-auto-columns: 1fr;
  grid-auto-flow: column;
  padding: 0 var(--safe-right) var(--safe-bottom) var(--safe-left);
  border-top: calc(var(--u) * 1) solid var(--ink-line);
  background: rgba(11, 12, 16, 0.92);
  z-index: 10;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
}
</style>
