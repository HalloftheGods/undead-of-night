<template>
  <span class="pick-bars">
    <span v-for="bar in bars" :key="bar.key" class="pick-bar" :class="{ 'is-strong': bar.strong }">
      <span class="pick-bar-label">{{ bar.label }}</span>
      <span class="pick-bar-cells" role="img" :aria-label="`${bar.label} ${bar.filled} of ${STAT_SLOTS}`">
        <span v-for="n in STAT_SLOTS" :key="n" class="pick-bar-cell" :class="{ 'is-on': n <= bar.filled }" />
      </span>
    </span>
  </span>
</template>

<script setup lang="ts">
/** One option's slotted stat bars in a Play page list, small labels on the left; what it is good at shows amber. */
import { STAT_SLOTS } from '../../shared/character-stats.ts';
import type { PickBar } from '../game/setup-picks.ts';

defineProps<{ bars: readonly PickBar[] }>();
</script>

<style scoped>
.pick-bars {
  display: grid;
  grid-template-columns: max-content max-content;
  justify-content: center;
  gap: max(1px, calc(var(--u) / 2)) calc(var(--u) * 2);
}

.pick-bar {
  display: grid;
  grid-column: 1 / -1;
  grid-template-columns: subgrid;
  align-items: center;
}

.pick-bar-label {
  color: var(--bone-dim);
  font-size: calc(var(--u) * 3);
  text-align: left;
  text-transform: uppercase;
}

.pick-bar.is-strong .pick-bar-label {
  color: var(--amber);
}

.pick-bar-cells {
  display: flex;
  gap: max(1px, calc(var(--u) / 2));
}

.pick-bar-cell {
  width: calc(var(--u) * 4);
  height: calc(var(--u) * 2);
  background: var(--ink-line);
}

.pick-bar-cell.is-on {
  background: var(--sick);
}

.pick-bar.is-strong .pick-bar-cell.is-on {
  background: var(--amber);
}
</style>
