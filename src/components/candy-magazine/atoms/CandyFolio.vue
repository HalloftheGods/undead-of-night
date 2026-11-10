<template>
  <footer class="mag-folio">{{ folio }}</footer>
</template>

<script setup lang="ts">
defineProps<{ folio: number }>();
</script>
