<template>
  <CandyBrandHeaderBox>
    <CandyKickerText :number="number" :kicker="kicker" />
    <CandyDeckText :deck="deck" />
  </CandyBrandHeaderBox>
</template>

<script setup lang="ts">
import CandyBrandHeaderBox from '../atoms/CandyBrandHeaderBox.vue';
import CandyDeckText from '../atoms/CandyDeckText.vue';
import CandyKickerText from '../atoms/CandyKickerText.vue';

defineProps<{
  number: number;
  kicker: string;
  deck: string;
}>();
</script>
