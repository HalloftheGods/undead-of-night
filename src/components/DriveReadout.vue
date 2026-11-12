<template>
  <aside v-if="readout" class="drive-readout hud-chip" aria-label="Test drive readout">
    <span>Speed {{ readout.speed }}</span>
    <span>Heading {{ readout.heading }}&deg; ({{ readout.facing.toUpperCase() }})</span>
    <span>Body {{ readout.body }}</span>
    <span>Last crash {{ crashText }}</span>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { driveReadout as readout } from '../game/drive-readout.ts';

const crashText = computed(() => (readout.value?.crash == null ? 'none' : `${Math.round(readout.value.crash * 100)}%`));
</script>

<style scoped>
.drive-readout {
  position: absolute;
  left: calc(var(--u) * 4);
  bottom: calc(var(--u) * 24);
  color: var(--bone);
  font-variant-numeric: tabular-nums;
  pointer-events: none;
}
</style>
