<template>
  <span class="mag-nav-page" aria-live="polite">{{ label }}</span>
</template>

<script setup lang="ts">
defineProps<{ label: string }>();
</script>
