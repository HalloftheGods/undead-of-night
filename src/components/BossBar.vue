<template>
  <div class="boss-bar" role="status" :aria-label="`${boss.name}, ${Math.round(boss.share * 100)}% health`">
    <span class="boss-name">{{ boss.name }}</span>
    <div class="px-meter boss-meter" :style="fill"><span /></div>
  </div>
</template>

<script setup lang="ts">
/** The boss's name and what it has left, across the top of the screen while it stands. */
import { computed } from 'vue';

const { boss } = defineProps<{ boss: { readonly name: string; readonly share: number } }>();
const fill = computed(() => ({ '--fill': `${Math.max(0, Math.min(1, boss.share)) * 100}%` }));
</script>

<style scoped>
.boss-bar {
  position: absolute;
  top: calc(var(--u) * 26);
  left: 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: calc(var(--u) * 2);
  width: min(60%, calc(var(--u) * 260));
  transform: translateX(-50%);
  pointer-events: none;
}

.boss-name {
  color: #ff5a4a;
  font-weight: 700;
  text-transform: uppercase;
  text-shadow: 0 1px 0 #000, 0 0 4px #000;
}

.boss-meter {
  width: 100%;
  height: calc(var(--u) * 5);
  padding: var(--u);
  background: rgba(7, 8, 12, 0.85);
  box-shadow: 0 0 0 var(--u) #5a1410;
}

.boss-meter > span {
  background: linear-gradient(#ff5a4a, #b3121c);
  transition: width 120ms steps(3);
}

:root[data-motion='reduced'] .boss-meter > span {
  transition: none;
}
</style>
