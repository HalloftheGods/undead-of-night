<template>
  <div class="cm-cover-callout">
    <span class="cm-callout-tag">{{ tag }}</span>
    <span class="cm-callout-text">{{ text }}</span>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  tag: string;
  text: string;
}>();
</script>
