<template>
  <div class="cm-nutrition-serving">
    <span>Serving size</span>
    <span>{{ servingSize }}</span>
  </div>
  <div class="cm-nutrition-serving">
    <span>Servings Per Container</span>
    <span>{{ servingsPerContainer }}</span>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  servingSize: string;
  servingsPerContainer: string;
}>();
</script>
