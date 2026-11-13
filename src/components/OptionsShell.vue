<template>
  <TitlePage :heading size="wide" @close="emit('close')">
    <div class="options-cards">
      <div class="options-columns">
        <slot />
      </div>
    </div>
  </TitlePage>
</template>

<script setup lang="ts">
import TitlePage from './TitlePage.vue';

defineProps<{ heading: string }>();
const emit = defineEmits<{ close: [] }>();
</script>

<style scoped>
/* Each group of settings is its own framed card, in two balanced columns where the window is wide enough. */
.options-cards {
  display: flex;
  flex-direction: column;
  gap: calc(var(--u) * 6);
  padding: calc(var(--u) * 1);
}

.options-columns {
  columns: 2 calc(var(--u) * 200);
  column-gap: calc(var(--u) * 6);
}

.options-columns > :deep(.options-card) {
  break-inside: avoid;
  margin-bottom: calc(var(--u) * 6);
}

.options-columns > :deep(.options-card:last-child) {
  margin-bottom: 0;
}
</style>
