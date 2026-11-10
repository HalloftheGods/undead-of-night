<template>
  <CoverSideContainer @click="emit('open')">
    <CoverHeader
      :title="CANDY_MAGAZINE_TITLE"
      :strap="CANDY_MAGAZINE_SUBTITLE"
      :issue="CANDY_MAGAZINE_ISSUE"
      :price="CANDY_MAGAZINE_PRICE"
    />
    <CoverShowcase :art="art" />
    <CoverLinesBlock />
    <CoverFooter>
      <SpriteImg class="mag-cover-logo" :sprite="art.ui.logo" />
      <CoverBarcode />
      <CoverOpenPrompt @open="emit('open')" />
    </CoverFooter>
  </CoverSideContainer>
</template>

<script setup lang="ts">
/**
 * Closed front cover of Sweet Tooth magazine: iconic masthead, comic sunburst
 * showcase featuring star candies, newsprint headline banners, barcode, and
 * click-to-open interaction.
 */
import type { ArtBook } from '../../../art/types.ts';
import {
  CANDY_MAGAZINE_ISSUE,
  CANDY_MAGAZINE_PRICE,
  CANDY_MAGAZINE_SUBTITLE,
  CANDY_MAGAZINE_TITLE,
} from '../../../game/candy-magazine-data.ts';
import SpriteImg from '../../SpriteImg.vue';
import CoverBarcode from '../atoms/CoverBarcode.vue';
import CoverFooter from '../atoms/CoverFooter.vue';
import CoverHeader from '../atoms/CoverHeader.vue';
import CoverOpenPrompt from '../atoms/CoverOpenPrompt.vue';
import CoverSideContainer from '../atoms/CoverSideContainer.vue';
import CoverLinesBlock from '../molecules/CoverLinesBlock.vue';
import CoverShowcase from '../molecules/CoverShowcase.vue';

defineProps<{ art: ArtBook }>();
const emit = defineEmits<{ open: [] }>();
</script>
