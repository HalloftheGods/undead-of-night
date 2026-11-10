<template>
  <ArtSideContainer>
    <CandyHeroArt
      :id="candy.id"
      :name="candy.name"
      :sprite="art.ui.candies[candy.id]"
      :burst="candy.burst"
      :caption="candy.caption"
    />
  </ArtSideContainer>
</template>

<script setup lang="ts">
import type { ArtBook } from '../../../art/types.ts';
import type { CandyMagazineEntry } from '../../../game/candy-magazine-data.ts';
import ArtSideContainer from '../atoms/ArtSideContainer.vue';
import CandyHeroArt from '../molecules/CandyHeroArt.vue';

defineProps<{
  candy: CandyMagazineEntry;
  art: ArtBook;
}>();
</script>
