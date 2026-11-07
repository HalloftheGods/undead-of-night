<template>
  <span class="slot-meter" role="img" :aria-label="`${label} ${filled} of ${slots}`" :style="accent ? { '--slot-on': accent } : undefined">
    <span class="slot-meter-label">{{ label }}</span>
    <span class="slot-meter-bar">
      <span v-for="n in slots" :key="n" class="slot-meter-cell" :class="{ 'is-on': n <= filled }" />
    </span>
  </span>
</template>

<script setup lang="ts">
/**
 * A row of pixel segments with a word beside it, for reading a stat at a glance.
 * Props: slots (segments in total), filled (segments lit), label (the word),
 * accent (optional css colour for lit segments, default blood).
 */
interface SlotMeterProps {
  slots: number;
  filled: number;
  label: string;
  accent?: string;
}

const { slots, filled, label, accent = '' } = defineProps<SlotMeterProps>();
</script>

<style scoped>
.slot-meter {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: calc(var(--u) * 2);
  --slot-on: var(--blood-bright);
}

.slot-meter-label {
  color: var(--bone-dim);
  font-size: calc(var(--u) * 6);
  text-transform: uppercase;
}

.slot-meter-bar {
  display: flex;
  gap: var(--u);
  flex: none;
}

.slot-meter-cell {
  width: calc(var(--u) * 4);
  height: calc(var(--u) * 5);
  background: var(--ink-line);
}

.slot-meter-cell.is-on {
  background: var(--slot-on);
}
</style>
