<template>
  <div class="callout" :class="`is-${callout.tone}`" role="status" aria-live="polite">
    <strong class="callout-text">{{ callout.text }}</strong>
  </div>
</template>

<script setup lang="ts">
import type { Callout } from '../game/hud-state.ts';

defineProps<{ callout: Callout }>();
</script>

<style scoped>
.callout {
  position: absolute;
  top: 34%;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  pointer-events: none;
  animation: callout-life 1.2s steps(12) both;
}

.callout-text {
  font-size: calc(var(--u) * 14);
  line-height: 1;
  letter-spacing: 0.04em;
  color: var(--amber);
  text-shadow:
    calc(var(--u) * 1) calc(var(--u) * 1) 0 #000,
    calc(var(--u) * -1) calc(var(--u) * 1) 0 #000,
    0 calc(var(--u) * 2) 0 #000;
}

.is-close .callout-text {
  color: var(--blood-bright);
}

.is-stamp {
  top: 22%;
}

.is-stamp .callout-text {
  font-size: calc(var(--u) * 8);
  color: var(--bone, #e8dcc0);
  padding: calc(var(--u) * 2) calc(var(--u) * 4);
  border: calc(var(--u) * 1) solid currentColor;
  transform: rotate(-4deg);
}

@keyframes callout-life {
  0% { opacity: 0; transform: scale(1.6); }
  12% { opacity: 1; transform: scale(1); }
  75% { opacity: 1; transform: scale(1); }
  100% { opacity: 0; transform: translateY(calc(var(--u) * -6)); }
}

:root[data-motion='reduced'] .callout {
  animation: callout-fade 1.2s steps(6) both;
}

@keyframes callout-fade {
  0% { opacity: 0; }
  10% { opacity: 1; }
  80% { opacity: 1; }
  100% { opacity: 0; }
}
</style>
