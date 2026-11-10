<template>
  <article
    ref="pageRef"
    class="mag-page"
    :class="[`mag-color-${color}`, isArt ? 'cm-art-page mag-layout-hero' : '', `is-${side}`]"
  >
    <slot />
  </article>
</template>

<script setup lang="ts">
import { useTemplateRef } from 'vue';
import { usePageFit } from '../../../game/magazine-fit.ts';
import type { MagazineColor } from '../../../game/magazine-types.ts';

defineProps<{
  color: MagazineColor;
  side: 'left' | 'right';
  isArt?: boolean;
}>();

const pageRef = useTemplateRef<HTMLElement>('pageRef');
usePageFit(pageRef);
</script>
