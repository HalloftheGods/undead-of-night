<template>
  <!--
    Four buttons in a block under the right thumb. Sprint takes the corner, where the thumb
    rests and where it can be held through a whole street; the backpack, which is opened and
    left alone, sits furthest away.
  -->
  <nav class="touch-fabs" data-touch-pad aria-label="Touch controls">
    <MobileFAB
      label="Search"
      :glyph="SEARCH"
      :held="held.includes('KeyE')"
      @press="press('KeyE')"
      @release="release('KeyE')"
    />
    <MobileFAB
      label="Backpack"
      :glyph="BACKPACK"
      :open="game.ui.value.backpackOpen"
      @press="game.toggleBackpack()"
      @release="() => {}"
    />
    <MobileFAB
      label="Shove"
      :glyph="SHOVE"
      :held="held.includes('KeyF')"
      @press="press('KeyF')"
      @release="release('KeyF')"
    />
    <MobileFAB
      label="Sprint"
      :glyph="SPRINT"
      :held="held.includes(SPRINT_CODE)"
      @press="press(SPRINT_CODE)"
      @release="release(SPRINT_CODE)"
    />
  </nav>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue';
import { BACKPACK, SEARCH, SHOVE, SPRINT } from '../game/touch-pad.ts';
import MobileFAB from './MobileFAB.vue';
import { useGame } from './use-game.ts';

/** Held to sprint, the same key the keyboard holds (game/input-manager.ts). */
const SPRINT_CODE = 'ShiftLeft';

const game = useGame();
const input = game.input;
const held = ref<string[]>([]);

function press(code: string): void {
  held.value = [...held.value, code];
  input.padDown(code);
}

function release(code: string): void {
  const wasDown = held.value.includes(code);
  if (!wasDown) return;
  held.value = held.value.filter((each) => each !== code);
  input.padUp(code);
}

onBeforeUnmount(() => {
  held.value.forEach((code) => input.padUp(code));
  game.closeBackpack();
});
</script>

<style scoped>
/* Two by two in the corner, the same block however the phone is held. */
.touch-fabs {
  display: grid;
  position: absolute;
  right: calc(var(--safe-right) + var(--u) * 3);
  bottom: calc(var(--safe-bottom) + var(--u) * 3);
  grid-template-columns: repeat(2, auto);
  gap: var(--fab-gap, 12px);
  z-index: 10;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
}
</style>
