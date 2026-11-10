<template>
  <p class="mag-head-kicker">
    <span class="mag-head-number">{{ number }}</span>
    {{ kicker }}
  </p>
</template>

<script setup lang="ts">
defineProps<{
  number: number;
  kicker: string;
}>();
</script>
