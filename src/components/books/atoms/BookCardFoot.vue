<template>
  <span class="book-card-foot">
    <span class="book-card-subtitle">{{ subtitle }}</span>
    <span class="book-card-pages">{{ pagesCount }}</span>
  </span>
</template>

<script setup lang="ts">
defineProps<{
  subtitle: string;
  pagesCount: string;
}>();
</script>
