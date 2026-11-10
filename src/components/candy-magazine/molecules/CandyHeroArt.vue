<template>
  <CandyHeroBox>
    <CandyBrandText :id="id" :name="name" />
    <SpriteImg class="cm-hero-sprite" :sprite="sprite" :scale="20" />
    <CandyBurstBadge :burst="burst" />
    <CandyHeroPlaque :caption="caption" />
  </CandyHeroBox>
</template>

<script setup lang="ts">
import type { CandyId } from '../../../../shared/protocol.ts';
import type { PixelSprite } from '../../../art/types.ts';
import SpriteImg from '../../SpriteImg.vue';
import CandyBrandText from '../atoms/CandyBrandText.vue';
import CandyBurstBadge from '../atoms/CandyBurstBadge.vue';
import CandyHeroBox from '../atoms/CandyHeroBox.vue';
import CandyHeroPlaque from '../atoms/CandyHeroPlaque.vue';

defineProps<{
  id: CandyId;
  name: string;
  sprite: PixelSprite;
  burst: string;
  caption: string;
}>();
</script>
