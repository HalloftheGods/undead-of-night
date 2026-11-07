<template>
  <div class="option-choice" role="group" :aria-label="label">
    <p class="px-label">{{ label }}</p>
    <div class="option-choice-row">
      <PixelButton v-for="option in options" :key="option.id" :primary="option.id === value" :aria-pressed="option.id === value" @press="emit('change', option.id)">
        {{ option.label }}
      </PixelButton>
    </div>
  </div>
</template>

<script setup lang="ts" generic="T extends string">
import PixelButton from './PixelButton.vue';

defineProps<{ label: string; options: readonly { id: T; label: string }[]; value: T }>();
const emit = defineEmits<{ change: [value: T] }>();
</script>

<style scoped>
.option-choice-row {
  display: flex;
  flex-wrap: wrap;
  gap: calc(var(--u) * 3);
}

.option-choice-row > * {
  flex: 1;
}
</style>
