<template>
  <section
    class="px-title-scale mag-screen"
    :aria-label="title"
    @pointerdown="$emit('pointerdown', $event)"
    @pointerup="$emit('pointerup', $event)"
  >
    <slot />
  </section>
</template>

<script setup lang="ts">
defineProps<{ title: string }>();
defineEmits<{
  pointerdown: [event: PointerEvent];
  pointerup: [event: PointerEvent];
}>();
</script>
