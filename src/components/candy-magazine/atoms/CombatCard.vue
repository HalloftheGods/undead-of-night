<template>
  <div class="cm-combat-card">
    <h4 class="cm-combat-card-title">{{ title }}</h4>
    <p class="cm-combat-card-body">{{ body }}</p>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title: string;
  body: string;
}>();
</script>
