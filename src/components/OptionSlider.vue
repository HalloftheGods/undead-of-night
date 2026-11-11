<template>
  <div class="px-slider-field">
    <div class="px-slider-header">
      <label class="px-label" :for="id">{{ label }}</label>
      <span v-if="readout !== undefined" class="px-slider-readout">{{ readout }}</span>
    </div>
    <input :id="id" class="px-slider" type="range" min="0" max="1" step="0.05" :value="value" @input="onInput" />
  </div>
</template>

<script setup lang="ts">
defineProps<{ id: string; label: string; value: number; readout?: string }>();
const emit = defineEmits<{ change: [value: number] }>();

function onInput(event: Event): void {
  emit('change', Number((event.target as HTMLInputElement).value));
}
</script>

<style scoped>
.px-slider-field {
  display: flex;
  flex-direction: column;
  gap: var(--u);
}

.px-slider-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

.px-slider-readout {
  color: var(--amber);
  font-size: calc(var(--u) * 6);
  font-weight: 700;
}
</style>
