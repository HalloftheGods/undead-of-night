<template>
  <div class="cm-nutrition-calories">
    <span>Calories</span>
    <span class="cm-nutrition-calories-num">{{ calories }}</span>
  </div>
</template>

<script setup lang="ts">
defineProps<{ calories: number }>();
</script>
