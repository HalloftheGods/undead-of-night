<template>
  <LeafArticleBox :color="leaf.color" :side="side" :is-art="isArtLeaf">
    <CandyRunningHead
      v-if="hasRunningHead"
      :title="CANDY_MAGAZINE_TITLE"
      :head="leaf.head"
    />

    <CandyCoverSide v-if="leaf.kind === 'cover'" :art="art" @open="$emit('open', 1)" />

    <CandyContentsSide
      v-else-if="leaf.kind === 'contents'"
      :art="art"
      @open="$emit('open', $event)"
    />

    <CandyArtSide
      v-else-if="leaf.kind === 'art'"
      :candy="leaf.candy"
      :art="art"
    />

    <CandyDetailSide
      v-else-if="leaf.kind === 'detail'"
      :candy="leaf.candy"
      :number="candyNumber"
    />

    <CandyFolio v-if="hasFolio" :folio="folio" />
  </LeafArticleBox>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { ArtBook } from '../../../art/types.ts';
import {
  CANDY_MAGAZINE_TITLE,
  type CandyMagazineLeaf,
} from '../../../game/candy-magazine-data.ts';
import { CANDY_ORDER } from '../../../../shared/candy.ts';
import CandyFolio from '../atoms/CandyFolio.vue';
import CandyRunningHead from '../atoms/CandyRunningHead.vue';
import LeafArticleBox from '../atoms/LeafArticleBox.vue';
import CandyArtSide from '../organisms/CandyArtSide.vue';
import CandyContentsSide from '../organisms/CandyContentsSide.vue';
import CandyCoverSide from '../organisms/CandyCoverSide.vue';
import CandyDetailSide from '../organisms/CandyDetailSide.vue';

const props = defineProps<{
  leaf: CandyMagazineLeaf;
  side: 'left' | 'right';
  folio: number;
  art: ArtBook;
}>();

defineEmits<{ open: [index: number] }>();

const isCover = computed(() => props.leaf.kind === 'cover');
const hasRunningHead = computed(() => !isCover.value);
const hasFolio = computed(() => !isCover.value);
const isArtLeaf = computed(() => props.leaf.kind === 'art');

const candyNumber = computed(() => {
  const isDetail = props.leaf.kind === 'detail';
  if (!isDetail) return 1;
  const index = CANDY_ORDER.indexOf(props.leaf.candy.id);
  return index + 1;
});
</script>
