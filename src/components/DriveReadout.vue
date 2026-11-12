<template>
  <aside v-if="readout" class="drive-readout hud-chip" aria-label="Test drive readout">
    <span>Speed {{ speedText }}</span>
    <span>Heading {{ readout.heading }}&deg; ({{ readout.facing.toUpperCase() }})</span>
    <span>Body {{ readout.body }}</span>
    <span>Last crash {{ crashText }}</span>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { driveReadout as readout, formatSpeed } from '../game/drive-readout.ts';
import { useGame } from './use-game.ts';

const game = useGame();
const speedText = computed(() => {
  const currentSpeed = readout.value?.speed ?? 0;
  const unit = game.ui.value.speedUnit;
  return formatSpeed(currentSpeed, unit);
});
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
