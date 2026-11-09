<template>
  <div class="display-options">
    <OptionChoice label="Hit colors" :options="PALETTE_OPTIONS" :value="ui.palette" @change="game.setPalette" />
    <p class="display-options-note">{{ PALETTE_NOTES[ui.palette] }}</p>
    <OptionChoice label="UI size" :options="SCALE_OPTIONS" :value="ui.uiScale" @change="game.setUiScale" />
    <div class="display-brightness">
      <label class="px-label display-brightness-label" for="display-brightness">
        <span>Brightness</span>
        <span class="display-brightness-value" aria-hidden="true">{{ brightnessShown }}</span>
      </label>
      <input
        id="display-brightness"
        class="px-slider"
        type="range"
        min="0"
        max="100"
        step="5"
        :value="brightnessPercent"
        :aria-valuetext="brightnessShown"
        aria-describedby="display-brightness-note"
        @input="onBrightness"
      />
      <p id="display-brightness-note" class="display-options-note">Lifts the dark corners so zombies show outside the light. Normal is the night as drawn.</p>
    </div>
    <PixelSwitch label="Menu details" :on="menuInfo" @change="setMenuInfo" />
    <p class="display-options-note">A line under each main menu item saying what it opens.</p>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { brightness, brightnessLift, setBrightness } from '../game/display-prefs.ts';
import type { PaletteId, UiScale } from '../game/display-prefs.ts';
import type { UiState } from '../game/hud-state.ts';
import { loadMenuInfo, saveMenuInfo } from '../game/menu-info-pref.ts';
import OptionChoice from './OptionChoice.vue';
import PixelSwitch from './PixelSwitch.vue';
import { useGame } from './use-game.ts';

defineProps<{ ui: UiState }>();
const game = useGame();
const menuInfo = ref(loadMenuInfo());

const brightnessPercent = computed(() => Math.round(brightness.value * 100));
/** Normal at the bottom, then how much the dark is lifted: up to +40% at the top. */
const brightnessShown = computed(() => {
  const lift = Math.round(brightnessLift() * 100);
  return lift === 0 ? 'Normal' : `+${lift}%`;
});

function onBrightness(event: Event): void {
  setBrightness(Number((event.target as HTMLInputElement).value) / 100);
}

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
</script>

<style scoped>
.display-brightness {
  padding-top: calc(var(--u) * 2);
}

.display-brightness-label {
  display: flex;
  justify-content: space-between;
  gap: calc(var(--u) * 4);
}

.display-brightness-value {
  color: var(--bone);
  text-align: right;
}

.display-brightness .display-options-note {
  margin-top: calc(var(--u) * 2);
}

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
