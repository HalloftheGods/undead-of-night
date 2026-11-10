<template>
  <span class="book-card-art">
    <img v-if="src" :src="src" alt="" draggable="false" />
    <span class="book-card-title" :style="{ '--chars': longestWord(title) }">{{ title }}</span>
  </span>
</template>

<script setup lang="ts">
import { longestWord } from '../../../game/setup-picks.ts';

defineProps<{
  src?: string;
  title: string;
}>();
</script>
