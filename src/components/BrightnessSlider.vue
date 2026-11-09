<template>
  <div class="brightness">
    <label class="px-label brightness-label" :for="`${id}-brightness`">
      <span>Brightness</span>
      <span class="brightness-value" aria-hidden="true">{{ shown }}</span>
    </label>
    <input
      :id="`${id}-brightness`"
      class="px-slider"
      type="range"
      min="0"
      max="100"
      step="5"
      :value="percent"
      :aria-valuetext="shown"
      :aria-describedby="note ? `${id}-brightness-note` : undefined"
      @input="onInput"
      @pointerdown="emit('preview', true)"
      @pointerup="emit('preview', false)"
      @pointercancel="emit('preview', false)"
      @blur="emit('preview', false)"
    />
    <p v-if="note" :id="`${id}-brightness-note`" class="brightness-note">
      Lifts the dark corners so zombies show outside the light. Normal is the night as drawn.
    </p>
  </div>
</template>

<script setup lang="ts">
/**
 * The Brightness slider, one control for the Options page and the pause card so a player who cannot see the
 * zombies can fix it without leaving the run. The renderer follows the setting live (GameController watches it).
 */
import { computed } from 'vue';
import { brightness, brightnessLift, setBrightness } from '../game/display-prefs.ts';

const { id, note = true } = defineProps<{
  /** Prefix for the element ids, so two sliders on one page never share one. */
  id: string;
  /** The one-line explanation under the slider. The pause card is short of room and leaves it out. */
  note?: boolean;
}>();

const emit = defineEmits<{
  /** True while the thumb is held, so a card sitting over the picture can step aside and show what it does. */
  preview: [held: boolean];
}>();

const percent = computed(() => Math.round(brightness.value * 100));
/** Normal at the bottom, then how much the dark is lifted: up to +40% at the top. */
const shown = computed(() => {
  const lift = Math.round(brightnessLift() * 100);
  return lift === 0 ? 'Normal' : `+${lift}%`;
});

function onInput(event: Event): void {
  setBrightness(Number((event.target as HTMLInputElement).value) / 100);
}
</script>

<style scoped>
.brightness {
  display: flex;
  flex-direction: column;
  gap: calc(var(--u) * 2);
}

.brightness-label {
  display: flex;
  justify-content: space-between;
  gap: calc(var(--u) * 4);
}

.brightness-value {
  color: var(--bone);
  text-align: right;
}

.brightness-note {
  margin: 0;
  color: var(--bone-dim);
}
</style>
