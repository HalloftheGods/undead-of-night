<template>
  <section class="options-card px-frame" :aria-labelledby="headId">
    <h3 :id="headId" class="options-card-head">{{ heading }}</h3>
    <slot />
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{ heading: string }>();

const headId = computed(() => `options-${props.heading.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`);
</script>

<style scoped>
.options-card {
  --edge: var(--ink-line);
  display: flex;
  flex-direction: column;
  gap: calc(var(--u) * 3);
  min-width: 0;
  padding: calc(var(--u) * 4);
  background: rgba(23, 24, 31, 0.86);
}

.options-card:focus-within {
  --edge: var(--bone-dim);
}

/* The card's name on a strip along its top, like the town strip on a Level Select card. */
.options-card-head {
  margin: calc(var(--u) * -4) calc(var(--u) * -4) 0;
  padding: calc(var(--u) * 2) calc(var(--u) * 4);
  border-bottom: var(--u) solid var(--amber);
  background: var(--ink);
  color: var(--amber);
  font-size: calc(var(--u) * 7);
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
</style>
