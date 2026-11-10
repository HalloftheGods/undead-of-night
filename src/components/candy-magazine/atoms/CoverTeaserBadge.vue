<template>
  <div class="cm-teaser-badge" :class="tiltClass">
    <span class="cm-teaser-stamp">{{ kicker }}</span>
    <span class="cm-teaser-title">{{ title }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    kicker: string;
    title: string;
    tilt?: 'left' | 'right' | 'slight-left';
  }>(),
  { tilt: 'left' },
);

const tiltClass = computed(() => `is-tilt-${props.tilt}`);
</script>
