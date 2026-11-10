<template>
  <span class="cm-brand-name" :style="brandStyles">{{ name }}</span>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { CandyId } from '../../../../shared/protocol.ts';
import { brandStyle } from '../../../game/candy-brands.ts';

const props = defineProps<{ id: CandyId; name: string }>();

const brandStyles = computed(() => brandStyle(props.id));
</script>
