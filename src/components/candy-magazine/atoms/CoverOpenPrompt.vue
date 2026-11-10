<template>
  <button type="button" class="cm-cover-open-btn" @click="emit('open')">
    <span class="cm-open-arrow" aria-hidden="true">▾</span>
    <span class="cm-open-label">CLICK TO OPEN MAGAZINE</span>
    <span class="cm-open-arrow" aria-hidden="true">▾</span>
  </button>
</template>

<script setup lang="ts">
const emit = defineEmits<{ open: [] }>();
</script>
