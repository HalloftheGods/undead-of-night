<template>
  <blockquote class="mag-review">
    <span class="mag-review-stars" :aria-label="`${stars} stars`">{{ starIcons }}</span>
    <p>{{ quote }}</p>
    <small>- {{ author }}</small>
  </blockquote>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  stars: number;
  quote: string;
  author: string;
}>();

const starIcons = computed(() => '★'.repeat(props.stars));
</script>
