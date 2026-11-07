<template>
  <div>
    <label class="px-label" :for="id">{{ label }}</label>
    <input :id="id" class="px-slider" type="range" min="0" max="1" step="0.05" :value="value" @input="onInput" />
  </div>
</template>

<script setup lang="ts">
defineProps<{ id: string; label: string; value: number }>();
const emit = defineEmits<{ change: [value: number] }>();

function onInput(event: Event): void {
  emit('change', Number((event.target as HTMLInputElement).value));
}
</script>
