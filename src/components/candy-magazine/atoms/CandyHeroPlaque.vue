<template>
  <p class="cm-hero-caption">{{ caption }}</p>
</template>

<script setup lang="ts">
defineProps<{ caption: string }>();
</script>
