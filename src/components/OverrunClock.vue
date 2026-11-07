<template>
  <p v-if="line" class="overrun-clock" :class="{ 'is-urgent': line.urgent }" role="timer" :aria-label="`${line.label} ${line.value}`">
    <span class="overrun-label">{{ line.label }}</span>
    <strong class="overrun-value">{{ line.value }}</strong>
    <span v-if="line.slowed" class="overrun-slowed">SLOWED</span>
  </p>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { OverrunView } from '../../shared/home-protocol.ts';
import { overrunClockLine } from '../game/overrun-hud.ts';

const props = defineProps<{ overrun: OverrunView | null }>();
const line = computed(() => overrunClockLine(props.overrun));
</script>

<style scoped>
/* No z-index: it draws over the HUD and the station screens mounted before it, and under the pause menu and the van ride after it. */
.overrun-clock {
  position: absolute;
  top: calc(var(--u) * 5);
  left: 50%;
  display: flex;
  align-items: baseline;
  gap: calc(var(--u) * 3);
  margin: 0;
  padding: calc(var(--u) * 2) calc(var(--u) * 4);
  background: rgba(11, 12, 16, 0.78);
  color: var(--bone);
  transform: translateX(-50%);
  pointer-events: none;
}

.overrun-label,
.overrun-slowed {
  color: var(--bone-dim);
}

.overrun-value {
  font-size: calc(var(--u) * 8);
}

.overrun-slowed {
  color: var(--amber);
}

.is-urgent .overrun-value {
  color: var(--blood-bright);
}

/* Full motion only: <html data-motion> follows the Motion option, which can override the system either way. */
:root[data-motion='full'] .is-urgent .overrun-value {
  animation: overrun-pulse 1s steps(2) infinite;
}

@keyframes overrun-pulse {
  50% { opacity: 0.55; }
}
</style>
