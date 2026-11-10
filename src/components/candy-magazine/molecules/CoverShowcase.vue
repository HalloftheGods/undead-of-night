<template>
  <CoverHeroGraphic>
    <CoverClusterBox>
      <SpriteImg class="cm-cluster-candy is-skulls" :sprite="art.ui.candies.sour_skulls" :scale="7" />
      <SpriteImg class="cm-cluster-candy is-taffy" :sprite="art.ui.candies.fang_taffy" :scale="6" />
      <SpriteImg class="cm-cluster-candy is-jawbreaker" :sprite="art.ui.candies.jawbreaker" :scale="6" />
      <SpriteImg class="cm-cluster-candy is-bar" :sprite="art.ui.candies.full_size_bar" :scale="7" />
    </CoverClusterBox>
    <CandyBurstBadge class="cm-cover-burst-badge" burst="ALL 13 CANDIES TESTED & RATED!" />
  </CoverHeroGraphic>
</template>

<script setup lang="ts">
import type { ArtBook } from '../../../art/types.ts';
import SpriteImg from '../../SpriteImg.vue';
import CandyBurstBadge from '../atoms/CandyBurstBadge.vue';
import CoverClusterBox from '../atoms/CoverClusterBox.vue';
import CoverHeroGraphic from '../atoms/CoverHeroGraphic.vue';

defineProps<{ art: ArtBook }>();
</script>
