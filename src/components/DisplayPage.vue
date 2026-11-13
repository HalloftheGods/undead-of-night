<template>
  <OptionsShell heading="Display" @close="emit('close')">
    <OptionsCard heading="Display">
      <DisplayOptions :ui />
    </OptionsCard>
    <OptionsCard heading="Comfort">
      <MotionOptions />
    </OptionsCard>
  </OptionsShell>
</template>

<script setup lang="ts">
import type { UiState } from '../game/hud-state.ts';
import DisplayOptions from './DisplayOptions.vue';
import MotionOptions from './MotionOptions.vue';
import OptionsCard from './OptionsCard.vue';
import OptionsShell from './OptionsShell.vue';

defineProps<{ ui: UiState }>();
const emit = defineEmits<{ close: [] }>();
</script>
