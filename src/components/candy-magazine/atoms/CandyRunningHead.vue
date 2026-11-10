<template>
  <header class="mag-running-head">
    <span>{{ title }}</span>
    <span>{{ head }}</span>
  </header>
</template>

<script setup lang="ts">
defineProps<{
  title: string;
  head: string;
}>();
</script>
