<template>
  <section class="streak-kit px-frame" aria-label="Streak kit">
    <p class="streak-kit-row">
      <span class="px-label streak-kit-label">Tonight's kit - night {{ reward.night }}</span>
      <span class="streak-kit-words">{{ reward.tonight ?? 'The usual pistol. Come back tomorrow and runs start better armed' }}</span>
    </p>
    <p v-if="reward.next" class="streak-kit-row">
      <span class="px-label streak-kit-label">{{ nextLabel }}</span>
      <span class="streak-kit-next">+ {{ reward.next.words }}</span>
    </p>
    <p class="streak-kit-small">{{ footnote }}</p>
  </section>
</template>

<script setup lang="ts">
/** What the Daily Night streak hands out at the start of a run: tonight's kit and the next step up. */
import { computed } from 'vue';
import type { StreakRewardView } from '../game/streak-reward.ts';

const { reward } = defineProps<{ reward: StreakRewardView }>();

const nextLabel = computed(() => {
  const next = reward.next;
  const isTomorrow = next !== null && next.night === reward.night + 1;
  return isTomorrow ? `Tomorrow - night ${next.night}` : `Night ${next?.night ?? ''}`;
});

const footnote = computed(() => {
  const keep = reward.todayOpen ? "Play tonight's town to keep the streak." : 'Streak kept for today.';
  const top = reward.top ? ' This is the top kit.' : '';
  return `${keep}${top} Solo Arcade runs get the kit too. Miss a day and it starts again.`;
});
</script>

<style scoped>
.streak-kit {
  display: flex;
  flex-direction: column;
  gap: calc(var(--u) * 2);
  padding: calc(var(--u) * 3) calc(var(--u) * 4);
}

.streak-kit p {
  margin: 0;
}

.streak-kit-row {
  display: flex;
  flex-wrap: wrap;
  gap: calc(var(--u) * 2) calc(var(--u) * 4);
  align-items: baseline;
}

.streak-kit-label {
  color: var(--amber);
}

.streak-kit-words {
  color: var(--bone);
}

.streak-kit-next {
  color: var(--sick);
}

.streak-kit-small {
  color: var(--bone-dim);
}
</style>
