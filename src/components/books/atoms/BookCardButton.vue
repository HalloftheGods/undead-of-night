<template>
  <button
    class="book-card px-frame"
    :class="{ 'is-active': active }"
    type="button"
    :aria-label="ariaLabel"
    @click="emit('press')"
    @mouseenter="emit('hover')"
    @mouseleave="emit('unhover')"
    @focus="emit('hover')"
    @blur="emit('unhover')"
  >
    <slot />
  </button>
</template>

<script setup lang="ts">
defineProps<{
  ariaLabel: string;
  active?: boolean;
}>();

const emit = defineEmits<{
  press: [];
  hover: [];
  unhover: [];
}>();
</script>
