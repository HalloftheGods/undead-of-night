<template>
  <ContentsFlowContainer>
    <ContentsHeader />
    <ContentsListContainer>
      <CandyContentsItem
        v-for="(id, index) in CANDY_ORDER"
        :key="id"
        :entry="entries[id]"
        :sprite="art.ui.candies[id]"
        :page="3 + index * 2"
        :spread-index="2 + index * 2"
        @open="$emit('open', $event)"
      />
    </ContentsListContainer>
  </ContentsFlowContainer>
</template>

<script setup lang="ts">
import type { ArtBook } from '../../../art/types.ts';
import { CANDY_ENTRIES } from '../../../game/candy-magazine-data.ts';
import { CANDY_ORDER } from '../../../../shared/candy.ts';
import ContentsFlowContainer from '../atoms/ContentsFlowContainer.vue';
import ContentsHeader from '../atoms/ContentsHeader.vue';
import ContentsListContainer from '../atoms/ContentsListContainer.vue';
import CandyContentsItem from '../molecules/CandyContentsItem.vue';

defineProps<{ art: ArtBook }>();

defineEmits<{ open: [index: number] }>();

const entries = CANDY_ENTRIES;
</script>
