<template>
  <div class="treasure-chip" :aria-label="ariaLabel">
    <span class="treasure-worth">{{ lines.worth }}</span>
    <span v-for="count in lines.counts" :key="count" class="treasure-jewel">{{ count }}</span>
  </div>
</template>

<script setup lang="ts">
/** The candy in hand on a trip: what it comes to at the candy shop, over the count of pieces. */
import { computed } from 'vue';
import type { HomeUi } from '../game/home-hud.ts';
import { carriedLines } from '../game/home-screens.ts';

const { home } = defineProps<{ home: HomeUi }>();

const lines = computed(() => carriedLines(home.carried));
const ariaLabel = computed(() => (home.carried.candy !== undefined ? 'Carried candy' : 'Carried jewels'));
</script>

<style scoped>
.treasure-chip {
  display: flex;
  flex-direction: column;
  gap: var(--u);
  padding: calc(var(--u) * 2) calc(var(--u) * 4);
  background: rgba(11, 12, 16, 0.78);
  color: var(--amber);
  font-weight: 700;
}

.treasure-jewel {
  color: var(--bone-dim);
  font-weight: 400;
}
</style>
