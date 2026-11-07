<template>
  <TitlePage heading="Could not open" @close="emit('close')">
    <p class="px-label">This page did not load. Check the connection and try again.</p>
  </TitlePage>
</template>

<script setup lang="ts">
import TitlePage from './TitlePage.vue';

/** Shown in place of a page whose code could not be fetched, so Back still works. */
defineProps<{ error?: unknown }>();
const emit = defineEmits<{ close: [] }>();
</script>
