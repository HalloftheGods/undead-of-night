<template>
  <div v-if="isTouch" class="touch-options">
    <p class="px-label">Touch Controls</p>

    <PixelSwitch label="Haptic feedback" :on="hapticsOn" @change="setHaptics" />

    <div class="touch-swipe">
      <label class="px-label touch-swipe-label" for="touch-swipe">
        <span>Swipe sensitivity</span>
        <span class="touch-swipe-value" aria-hidden="true">{{ sensitivityShown }}</span>
      </label>
      <input
        id="touch-swipe"
        class="px-slider"
        type="range"
        min="50"
        max="200"
        step="10"
        :value="sensitivityPercent"
        :aria-valuetext="sensitivityShown"
        @input="onSwipe"
      />
    </div>

    <p class="touch-note">{{ note }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue';
import { supportsHaptics } from '../game/haptic-feedback.ts';
import { isTouchDevice } from '../game/touch-input.ts';
import {
  clampSwipeSensitivity,
  loadHapticsEnabled,
  loadSwipeSensitivity,
  saveHapticsEnabled,
  saveSwipeSensitivity,
} from '../game/touch-pref.ts';
import PixelSwitch from './PixelSwitch.vue';
import { useGame } from './use-game.ts';

const game = useGame();

/** Only show on touch devices. */
const isTouch = ref(isTouchDevice());

const hapticsOn = ref(loadHapticsEnabled());
const swipeSensitivity = ref(loadSwipeSensitivity());

const sensitivityPercent = computed(() => Math.round(swipeSensitivity.value * 100));
const sensitivityShown = computed(() => `${sensitivityPercent.value}%`);

const note = computed(() => {
  if (!supportsHaptics()) {
    return 'Swipe gestures: up to reload, down to pause, left/right to switch weapons.';
  }
  return hapticsOn.value
    ? 'Vibration on fire, damage, and low ammo. Swipe: up=reload, down=pause, left/right=weapon.'
    : 'Vibration off. Swipe: up=reload, down=pause, left/right=weapon.';
});

function setHaptics(on: boolean): void {
  hapticsOn.value = on;
  saveHapticsEnabled(on);
}

function onSwipe(event: Event): void {
  const value = Number((event.target as HTMLInputElement).value) / 100;
  swipeSensitivity.value = clampSwipeSensitivity(value);
  saveSwipeSensitivity(swipeSensitivity.value);
  // Update the touch input's sensitivity
  game.input.touch.swipeSensitivity = swipeSensitivity.value;
}

// Sync settings on mount
watchEffect(() => {
  game.input.touch.swipeSensitivity = swipeSensitivity.value;
});
</script>

<style scoped>
.touch-options {
  display: flex;
  flex-direction: column;
  gap: calc(var(--u) * 2);
}

.touch-swipe {
  padding-top: calc(var(--u) * 2);
}

.touch-swipe-label {
  display: flex;
  justify-content: space-between;
  gap: calc(var(--u) * 4);
}

.touch-swipe-value {
  color: var(--bone);
  text-align: right;
}

.touch-note {
  margin: 0;
  color: var(--bone-dim);
  font-size: calc(var(--u) * 5);
}
</style>
