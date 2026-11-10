<template>
  <span class="cm-contents-item-stat">{{ stat }}</span>
</template>

<script setup lang="ts">
defineProps<{ stat: string }>();
</script>
