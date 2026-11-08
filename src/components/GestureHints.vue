<template>
  <div v-if="isTouch" class="gesture-hints">
    <p class="gesture-title">Swipe Controls</p>
    <div class="gesture-grid">
      <div class="gesture-item">
        <svg class="gesture-arrow gesture-up" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 4 L12 20 M6 10 L12 4 L18 10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <span class="gesture-label">Reload</span>
      </div>
      <div class="gesture-item">
        <svg class="gesture-arrow gesture-down" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 4 L12 20 M6 14 L12 20 L18 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <span class="gesture-label">Pause</span>
      </div>
      <div class="gesture-item">
        <svg class="gesture-arrow gesture-left" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 12 L20 12 M10 6 L4 12 L10 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <span class="gesture-label">Prev weapon</span>
      </div>
      <div class="gesture-item">
        <svg class="gesture-arrow gesture-right" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 12 L20 12 M14 6 L20 12 L14 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <span class="gesture-label">Next weapon</span>
      </div>
    </div>
    <p class="gesture-note">Swipe on the right side of the screen</p>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { isTouchDevice } from '../game/touch-input.ts';

const isTouch = ref(isTouchDevice());
</script>

<style scoped>
.gesture-hints {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: calc(var(--u) * 3);
  padding: calc(var(--u) * 4);
  background: rgba(23, 24, 31, 0.6);
  border-radius: calc(var(--u) * 2);
}

.gesture-title {
  margin: 0;
  color: var(--amber);
  font-size: calc(var(--u) * 5);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.gesture-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: calc(var(--u) * 4);
}

.gesture-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: calc(var(--u) * 2);
}

.gesture-arrow {
  width: calc(var(--u) * 10);
  height: calc(var(--u) * 10);
  color: var(--bone);
}

.gesture-label {
  color: var(--bone-dim);
  font-size: calc(var(--u) * 4);
  text-transform: uppercase;
}

.gesture-note {
  margin: 0;
  color: var(--bone-dim);
  font-size: calc(var(--u) * 4);
  text-align: center;
}
</style>
