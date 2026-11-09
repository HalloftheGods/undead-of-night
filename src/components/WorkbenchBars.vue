<template>
  <ul class="gun-bars">
    <li v-for="(bar, at) in bars" :key="bar.label" class="gun-bar">
      <span class="gun-bar-label">{{ bar.label }}</span>
      <span class="gun-bar-cells" role="img" :aria-label="`${bar.label} ${bar.value}, ${bar.filled} of ${BAR_SLOTS}`">
        <span v-for="n in BAR_SLOTS" :key="n" class="gun-bar-cell" :class="cellClass(bar, n, next?.[at])" />
      </span>
      <span class="gun-bar-value" :class="{ 'is-changed': bar.changed, 'is-next': moves(bar, next?.[at]) }">{{ valueText(bar, next?.[at]) }}</span>
    </li>
  </ul>
</template>

<script setup lang="ts">
/**
 * A gun's five stats stacked like a survivor's bars, label on the left and the number beside them. The cells
 * the work on the gun added are amber, as is a number the work moved off the stock gun's.
 */
import { BAR_SLOTS } from '../game/bench-view.ts';
import type { GunBar } from '../game/bench-view.ts';

defineProps<{ bars: readonly GunBar[]; next?: readonly GunBar[] }>();

/** Cells the pointed-at upgrade would light are outlined, not filled: a promise, not a fact. */
function cellClass(bar: GunBar, n: number, after: GunBar | undefined): Record<string, boolean> {
  const lit = n <= bar.filled;
  return { 'is-on': lit, 'is-gained': lit && n > bar.filled - bar.gained, 'is-next': !lit && after !== undefined && n <= after.filled };
}

const moves = (bar: GunBar, after: GunBar | undefined): boolean => after !== undefined && after.value !== bar.value;
const short = (value: string): string => value.replace(' noise', '');

/** The number now, and with an arrow the number after, when the upgrade would move it. */
function valueText(bar: GunBar, after: GunBar | undefined): string {
  return after !== undefined && moves(bar, after) ? `${short(bar.value)} > ${short(after.value)}` : bar.value;
}
</script>

<style scoped>
.gun-bars {
  --row-h: calc(var(--u) * 10);
  display: grid;
  grid-template-columns: max-content max-content 1fr;
  grid-auto-rows: var(--row-h);
  gap: calc(var(--u) * 3) calc(var(--u) * 5);
  margin: 0;
  padding: 0;
  list-style: none;
}

.gun-bar {
  display: grid;
  grid-column: 1 / -1;
  grid-template-columns: subgrid;
  align-items: center;
}

.gun-bar-label {
  color: var(--bone-dim);
  font-size: calc(var(--u) * 7);
  text-transform: uppercase;
}

.gun-bar-cells {
  display: flex;
  gap: var(--u);
}

.gun-bar-cell {
  width: calc(var(--u) * 9);
  height: calc(var(--u) * 7);
  background: var(--ink-line);
}

.gun-bar-cell.is-on {
  background: var(--sick);
}

.gun-bar-cell.is-gained {
  background: var(--amber);
}

.gun-bar-value {
  overflow: hidden;
  color: var(--bone);
  font-size: calc(var(--u) * 6);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.gun-bar-cell.is-next {
  background: transparent;
  box-shadow: inset 0 0 0 var(--u) var(--amber);
}

.gun-bar-value.is-changed {
  color: var(--amber);
}

.gun-bar-value.is-next {
  color: var(--amber);
}
</style>
