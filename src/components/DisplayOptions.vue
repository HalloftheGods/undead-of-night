<template>
  <div class="display-options">
    <!-- First, so a phone on its side shows it without a scroll: it is the one setting that decides if the game is playable. -->
    <BrightnessSlider id="display" />
    <OptionChoice label="Hit colors" :options="PALETTE_OPTIONS" :value="ui.palette" @change="(v) => game.setPalette(v)" />
    <p class="display-options-note">{{ PALETTE_NOTES[ui.palette] }}</p>
    <OptionChoice label="UI size" :options="SCALE_OPTIONS" :value="ui.uiScale" @change="(v) => game.setUiScale(v)" />
    <OptionChoice label="Speed unit" :options="SPEED_OPTIONS" :value="ui.speedUnit" @change="(v) => game.setSpeedUnit(v)" />
    <p class="display-options-note">Unit for vehicle speedometer readouts.</p>
    <PixelSwitch label="Menu details" :on="menuInfo" @change="setMenuInfo" />
    <p class="display-options-note">A line under each main menu item saying what it opens.</p>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { PaletteId, SpeedUnit, UiScale } from '../game/display-prefs.ts';
import type { UiState } from '../game/hud-state.ts';
import { loadMenuInfo, saveMenuInfo } from '../game/menu-info-pref.ts';
import BrightnessSlider from './BrightnessSlider.vue';
import OptionChoice from './OptionChoice.vue';
import PixelSwitch from './PixelSwitch.vue';
import { useGame } from './use-game.ts';

defineProps<{ ui: UiState }>();
const game = useGame();
const menuInfo = ref(loadMenuInfo());

function setMenuInfo(on: boolean): void {
  menuInfo.value = on;
  saveMenuInfo(on);
}

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
