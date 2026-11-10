<template>
  <span class="cm-contents-item-page">p. {{ page }}</span>
</template>

<script setup lang="ts">
defineProps<{ page: number }>();
</script>
