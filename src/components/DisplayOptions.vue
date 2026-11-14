<template>
  <div class="display-options">
    <!-- First, so a phone on its side shows it without a scroll: it is the one setting that decides if the game is playable. -->
    <BrightnessSlider id="display" />
    <OptionChoice label="Resolution" :options="RESOLUTION_OPTIONS" :value="ui.resolution" @change="(v) => game.setResolution(v)" />
    <p class="display-options-note">{{ RESOLUTION_NOTES[ui.resolution] }}</p>
    <OptionChoice label="Hit colors" :options="PALETTE_OPTIONS" :value="ui.palette" @change="(v) => game.setPalette(v)" />
    <p class="display-options-note">{{ PALETTE_NOTES[ui.palette] }}</p>
    <OptionChoice label="UI size" :options="SCALE_OPTIONS" :value="ui.uiScale" @change="(v) => game.setUiScale(v)" />
    <OptionChoice label="Speed unit" :options="SPEED_OPTIONS" :value="ui.speedUnit" @change="(v) => game.setSpeedUnit(v)" />
    <p class="display-options-note">Unit for vehicle speedometer readouts.</p>
  </div>
</template>

<script setup lang="ts">
import type { PaletteId, Resolution, SpeedUnit, UiScale } from '../game/display-prefs.ts';
import type { UiState } from '../game/hud-state.ts';
import BrightnessSlider from './BrightnessSlider.vue';
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
const RESOLUTION_OPTIONS: readonly { id: Resolution; label: string }[] = [
  { id: 'low', label: 'Low' },
  { id: 'auto', label: 'Auto' },
  { id: 'high', label: 'High' },
  { id: 'ultra', label: 'Ultra' },
];
const RESOLUTION_NOTES: Record<Resolution, string> = {
  low: 'Chunkier pixels and a closer view. Easiest on a weak device.',
  auto: 'Fits the window.',
  high: 'Finer pixels and more of the world in view. In co-op the view stops at the shared reach.',
  ultra: 'The finest pixels. In co-op the view stops at the shared reach.',
};
const SCALE_OPTIONS: readonly { id: UiScale; label: string }[] = [
  { id: 'normal', label: 'Normal' },
  { id: 'large', label: 'Large' },
  { id: 'larger', label: 'Larger' },
];
const SPEED_OPTIONS: readonly { id: SpeedUnit; label: string }[] = [
  { id: 'mph', label: 'MPH' },
  { id: 'kmh', label: 'KM/H' },
  { id: 'pxs', label: 'PX/S' },
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
