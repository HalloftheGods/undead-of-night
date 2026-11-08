<template>
  <BackpackWheel
    v-if="backpackOpen"
    :hud="hud"
    :art="art"
    @close="closeBackpack"
    @action="handleAction"
  />
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
      :held="held.includes('backpack')"
      :open="backpackOpen"
      @press="toggleBackpack"
      @release="() => {}"
    />
    <MobileFAB
      label="Shove"
      :glyph="SHOVE"
      :held="held.includes('KeyF')"
      @press="press('KeyF')"
      @release="release('KeyF')"
    />
  </nav>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue';
import type { ArtBook } from '../art/types.ts';
import type { HudState } from '../game/hud-state.ts';
import { BACKPACK, SEARCH, SHOVE } from '../game/touch-pad.ts';
import BackpackWheel from './BackpackWheel.vue';
import MobileFAB from './MobileFAB.vue';
import { useGame } from './use-game.ts';

defineProps<{ hud: HudState; art: ArtBook }>();

const { input } = useGame();
const held = ref<string[]>([]);
const backpackOpen = ref(false);

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

function toggleBackpack(): void {
  backpackOpen.value = !backpackOpen.value;
}

function closeBackpack(): void {
  backpackOpen.value = false;
}

function handleAction(code: string): void {
  input.padDown(code);
  input.padUp(code);
  closeBackpack();
}

onBeforeUnmount(() => {
  held.value.forEach((code) => input.padUp(code));
  backpackOpen.value = false;
});
</script>

<style scoped>
.touch-fabs {
  position: absolute;
  display: flex;
  gap: 12px;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  z-index: 10;
}

@media (orientation: landscape) {
  .touch-fabs {
    right: calc(var(--safe-right) + 12px);
    bottom: calc(var(--safe-bottom) + 12px);
    flex-direction: row-reverse;
  }
}

@media (orientation: portrait) {
  .touch-fabs {
    right: calc(var(--safe-right) + 12px);
    bottom: calc(var(--safe-bottom) + 12px);
    flex-direction: row-reverse;
  }
}
</style>
