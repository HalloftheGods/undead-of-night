<template>
  <DetailFlowContainer>
    <CandyBrandHeader
      :number="number"
      :kicker="candy.kicker"
      :deck="candy.deck"
    />
    <DetailGridContainer>
      <CandyNutritionPanel :nutrition="candy.nutrition" />
      <CandyCombatBoost
        :boost-description="candy.boostDescription"
        :tactical-advice="candy.tacticalAdvice"
        :found-in="candy.foundIn"
      />
    </DetailGridContainer>
    <DetailFooterContainer>
      <CandyReviewBlock
        :stars="candy.review.stars"
        :quote="candy.review.quote"
        :author="candy.review.author"
      />
      <CandyStampBadge
        :text="candy.stamp.text"
        :tilt="candy.stamp.tilt"
      />
    </DetailFooterContainer>
  </DetailFlowContainer>
</template>

<script setup lang="ts">
import type { CandyMagazineEntry } from '../../../game/candy-magazine-data.ts';
import CandyReviewBlock from '../atoms/CandyReviewBlock.vue';
import CandyStampBadge from '../atoms/CandyStampBadge.vue';
import DetailFlowContainer from '../atoms/DetailFlowContainer.vue';
import DetailFooterContainer from '../atoms/DetailFooterContainer.vue';
import DetailGridContainer from '../atoms/DetailGridContainer.vue';
import CandyBrandHeader from '../molecules/CandyBrandHeader.vue';
import CandyCombatBoost from '../molecules/CandyCombatBoost.vue';
import CandyNutritionPanel from '../molecules/CandyNutritionPanel.vue';

defineProps<{
  candy: CandyMagazineEntry;
  number: number;
}>();
</script>
