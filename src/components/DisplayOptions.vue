<template>
  <div class="display-options">
    <OptionChoice label="Hit colors" :options="PALETTE_OPTIONS" :value="ui.palette" @change="game.setPalette" />
    <p class="display-options-note">{{ PALETTE_NOTES[ui.palette] }}</p>
    <OptionChoice label="UI size" :options="SCALE_OPTIONS" :value="ui.uiScale" @change="game.setUiScale" />
  </div>
</template>

<script setup lang="ts">
import type { PaletteId, UiScale } from '../game/display-prefs.ts';
import type { UiState } from '../game/hud-state.ts';
import OptionChoice from './OptionChoice.vue';
import { useGame } from './use-game.ts';

defineProps<{ ui: UiState }>();
const game = useGame();

const PALETTE_OPTIONS: readonly { id: PaletteId; label: string }[] = [
  { id: 'classic', label: 'Classic' },
  { id: 'clear', label: 'Colorblind' },
];
const PALETTE_NOTES: Record<PaletteId, string> = {
  classic: 'Red for danger, green for health.',
  clear: 'Magenta for danger, blue for health. Easier to tell apart with red-green colorblindness.',
};
const SCALE_OPTIONS: readonly { id: UiScale; label: string }[] = [
  { id: 'normal', label: 'Normal' },
  { id: 'large', label: 'Large' },
  { id: 'larger', label: 'Larger' },
];
</script>

<style scoped>
.display-options {
  display: flex;
  flex-direction: column;
  gap: calc(var(--u) * 2);
}

.display-options-note {
  margin: 0;
  color: var(--bone-dim);
}
</style>
