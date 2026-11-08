<template>
  <div v-if="isTouch" class="touch-options">
    <p class="px-label">Touch Controls</p>

    <div class="touch-haptics">
      <label class="px-label touch-haptics-label" for="touch-haptics">
        <span>Haptic feedback</span>
      </label>
      <button
        id="touch-haptics"
        class="touch-toggle px-frame"
        :class="{ 'is-on': hapticsOn }"
        type="button"
        role="switch"
        :aria-checked="hapticsOn"
        @mouseenter="game.playUi('hover')"
        @click="toggleHaptics"
      >
        {{ hapticsOn ? 'On' : 'Off' }}
      </button>
    </div>

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

function toggleHaptics(): void {
  game.playUi('click');
  hapticsOn.value = !hapticsOn.value;
  saveHapticsEnabled(hapticsOn.value);
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

.touch-haptics {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: calc(var(--u) * 4);
}

.touch-haptics-label {
  flex: 1;
}

.touch-toggle {
  --edge: var(--ink-line);
  min-width: calc(var(--u) * 24);
  min-height: calc(var(--u) * 12);
  border: 0;
  padding: calc(var(--u) * 2) calc(var(--u) * 4);
  background: var(--ink-raised);
  color: var(--bone-dim);
  font: inherit;
  text-transform: uppercase;
  cursor: pointer;
  outline: none;
  touch-action: manipulation;
}

.touch-toggle:hover,
.touch-toggle:focus-visible {
  --edge: var(--bone-dim);
  color: var(--bone);
}

.touch-toggle.is-on {
  --edge: var(--amber);
  color: var(--amber);
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
