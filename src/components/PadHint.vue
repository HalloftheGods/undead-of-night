<template>
  <div class="pad-hint" data-pad-gate aria-live="polite">
    <p v-for="line in lines" :key="line" class="pad-hint-line">{{ line }}</p>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { readPads } from '../game/gamepad-input.ts';
import { padHintLines, summarisePads } from '../game/pad-hint.ts';

// The title's controller line, under Press Any Key. `data-pad-gate` on the root tells pad-focus a
// gate is up: the D-pad leaves focus alone, so the press that wakes the title does not also pick a footer link.
const POLL_MS = 250;
const lines = ref<string[]>([]);
let timer = 0;

/** Pads change by hand, not by the frame: a slow poll keeps up, and the events below answer a plug at once. */
function look(): void {
  const next = padHintLines(summarisePads(readPads()));
  const changed = next.join('\n') !== lines.value.join('\n');
  if (changed) lines.value = next;
}

onMounted(() => {
  look();
  timer = window.setInterval(look, POLL_MS);
  window.addEventListener('gamepadconnected', look);
  window.addEventListener('gamepaddisconnected', look);
});

onBeforeUnmount(() => {
  window.clearInterval(timer);
  window.removeEventListener('gamepadconnected', look);
  window.removeEventListener('gamepaddisconnected', look);
});
</script>

<style scoped>
.pad-hint {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: calc(var(--u) * 1);
  min-height: calc(var(--u) * 14);
  color: var(--bone-dim);
  font-size: calc(var(--u) * 6);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  text-shadow: 0 calc(var(--u) * 0.75) 0 var(--ink);
}

.pad-hint-line {
  margin: 0;
}
</style>
