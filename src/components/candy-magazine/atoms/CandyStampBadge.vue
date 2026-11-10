<template>
  <span class="mag-stamp" :style="tiltStyle">{{ text }}</span>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{ text: string; tilt: number }>();

const tiltStyle = computed(() => ({
  '--tilt': `${props.tilt}deg`,
}));
</script>
