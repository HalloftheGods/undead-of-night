<template>
  <li class="cm-nutrition-row" :class="{ 'is-bold': fact.bold }">
    <span>{{ fact.name }} {{ fact.amount }}</span>
    <span v-if="fact.percent">{{ fact.percent }}</span>
  </li>
</template>

<script setup lang="ts">
import type { NutritionFactRowData } from '../../../game/candy-magazine-data.ts';

defineProps<{ fact: NutritionFactRowData }>();
</script>
