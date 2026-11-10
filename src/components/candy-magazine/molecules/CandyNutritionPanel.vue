<template>
  <NutritionPanelBox>
    <NutritionTitle />
    <NutritionServingRow
      :serving-size="nutrition.servingSize"
      :servings-per-container="nutrition.servingsPerContainer"
    />
    <NutritionCaloriesRow :calories="nutrition.calories" />
    <NutritionDvHeader />
    <NutritionListContainer>
      <NutritionFactRow
        v-for="fact in nutrition.facts"
        :key="fact.name"
        :fact="fact"
      />
    </NutritionListContainer>
    <NutritionIngredients :ingredients="nutrition.ingredients" />
  </NutritionPanelBox>
</template>

<script setup lang="ts">
import type { CandyNutritionData } from '../../../game/candy-magazine-data.ts';
import NutritionCaloriesRow from '../atoms/NutritionCaloriesRow.vue';
import NutritionDvHeader from '../atoms/NutritionDvHeader.vue';
import NutritionFactRow from '../atoms/NutritionFactRow.vue';
import NutritionIngredients from '../atoms/NutritionIngredients.vue';
import NutritionListContainer from '../atoms/NutritionListContainer.vue';
import NutritionPanelBox from '../atoms/NutritionPanelBox.vue';
import NutritionServingRow from '../atoms/NutritionServingRow.vue';
import NutritionTitle from '../atoms/NutritionTitle.vue';

defineProps<{ nutrition: CandyNutritionData }>();
</script>
