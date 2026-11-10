<template>
  <span class="cm-contents-item-name">{{ name }}</span>
</template>

<script setup lang="ts">
defineProps<{ name: string }>();
</script>
