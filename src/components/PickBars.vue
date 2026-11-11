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
  display: flex;
  flex-direction: column;
  gap: calc(var(--u) * 1.5);
  width: 100%;
  padding: calc(var(--u) * 1.5) calc(var(--u) * 2) calc(var(--u) * 1);
  box-sizing: border-box;
}

.pick-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: calc(var(--u) * 1.5);
  min-width: 0;
  width: 100%;
}

.pick-bar-label {
  color: var(--bone-dim);
  font-family: 'Silkscreen', monospace;
  font-size: min(calc(var(--u) * 5.5), 13cqi);
  font-weight: 700;
  letter-spacing: 0.05em;
  line-height: 1;
  text-align: left;
  text-transform: uppercase;
  white-space: nowrap;
}

.pick-bar.is-strong .pick-bar-label {
  color: var(--amber);
}

.pick-bar-cells {
  display: flex;
  gap: max(1px, calc(var(--u) * 0.75));
  flex: 1 1 auto;
  justify-content: flex-end;
}

.pick-bar-cell {
  flex: 1 1 0;
  min-width: calc(var(--u) * 3);
  max-width: calc(var(--u) * 6);
  height: calc(var(--u) * 4);
  background: var(--ink-line);
}

.pick-bar-cell.is-on {
  background: var(--sick);
}

.pick-bar.is-strong .pick-bar-cell.is-on {
  background: var(--amber);
}
</style>
