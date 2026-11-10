<template>
  <div class="books-info" aria-live="polite">
    <p class="books-info-name">{{ title }}</p>
    <p class="books-info-subtitle">{{ subtitle }}</p>
    <p class="books-info-desc">{{ description }}</p>
    <span class="books-info-badge">
      <span class="books-info-badge-dot" aria-hidden="true">★</span>
      {{ tag }} • {{ pagesCount }}
    </span>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title: string;
  subtitle: string;
  description: string;
  tag: string;
  pagesCount: string;
}>();
</script>
