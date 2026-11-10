<template>
  <div class="cm-cover-candy-cell">
    <slot />
    <span class="cm-cover-candy-name">{{ name }}</span>
  </div>
</template>

<script setup lang="ts">
defineProps<{ name: string }>();
</script>
