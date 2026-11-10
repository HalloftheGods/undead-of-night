<template>
  <span class="book-card-head">
    <span class="book-card-number" aria-hidden="true">{{ number }}</span>
    <span class="book-card-tag">{{ tag }}</span>
  </span>
</template>

<script setup lang="ts">
defineProps<{
  number: string;
  tag: string;
}>();
</script>
