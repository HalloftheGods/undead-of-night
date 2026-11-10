<template>
  <div class="cm-nutrition-ingredients">
    <strong>INGREDIENTS:</strong> {{ ingredients }}
  </div>
</template>

<script setup lang="ts">
defineProps<{ ingredients: string }>();
</script>
