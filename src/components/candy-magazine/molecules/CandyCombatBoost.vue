<template>
  <CombatBoxContainer>
    <CombatCard title="Combat Boost" :body="boostDescription" />
    <CombatCard title="Tactical Survival" :body="tacticalAdvice" />
    <CombatCard title="Where Found" :body="foundIn" />
  </CombatBoxContainer>
</template>

<script setup lang="ts">
import CombatBoxContainer from '../atoms/CombatBoxContainer.vue';
import CombatCard from '../atoms/CombatCard.vue';

defineProps<{
  boostDescription: string;
  tacticalAdvice: string;
  foundIn: string;
}>();
</script>
