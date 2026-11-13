<template>
  <OptionsShell heading="Audio" @close="emit('close')">
    <OptionsCard heading="Volume">
      <SoundOptions :ui />
    </OptionsCard>
  </OptionsShell>
</template>

<script setup lang="ts">
import type { UiState } from '../game/hud-state.ts';
import OptionsCard from './OptionsCard.vue';
import OptionsShell from './OptionsShell.vue';
import SoundOptions from './SoundOptions.vue';

defineProps<{ ui: UiState }>();
const emit = defineEmits<{ close: [] }>();
</script>
