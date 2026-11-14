<template>
  <div class="level-card" role="status">
    <span class="level-card-heading">{{ card.heading }}</span>
    <strong class="level-card-title">{{ card.title }}</strong>
    <span class="level-card-goal">{{ card.goal }}</span>
    <span v-if="card.rule" class="level-card-rule">{{ card.rule }}</span>
    <span v-if="card.sidequest" class="level-card-sidequest">{{ card.sidequest }}</span>
    <span v-if="card.event" class="level-card-event">Tonight: {{ card.event }}</span>
    <span v-if="card.boss" class="level-card-event">Boss night: {{ card.boss }}</span>
    <span v-if="card.streak" class="level-card-streak">{{ card.streak }}</span>
  </div>
</template>

<script setup lang="ts">
import type { LevelCard } from '../game/hud-state.ts';

defineProps<{ card: LevelCard }>();
</script>

<style scoped>
.level-card {
  position: absolute;
  /* Low on the screen, above the weapon bar, so the world stays clear while it plays. */
  bottom: 18%;
  left: 0;
  right: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: calc(var(--u) * 3);
  padding: calc(var(--u) * 6) calc(var(--u) * 4);
  background: rgba(11, 12, 16, 0.82);
  text-align: center;
  text-transform: uppercase;
  pointer-events: none;
  animation: level-card-life 4.2s steps(21) both;
}

.level-card-heading {
  color: var(--amber);
}

.level-card-title {
  font-size: calc(var(--u) * 24);
  line-height: 1;
  color: var(--bone);
}

.level-card-goal {
  color: var(--bone-dim);
}

.level-card-rule {
  color: var(--amber);
}

.level-card-sidequest {
  color: var(--cyan, #4af0ff);
}

.level-card-streak {
  color: var(--sick);
}

.level-card-event {
  color: var(--blood, #e4502e);
}

@keyframes level-card-life {
  0% { opacity: 0; }
  6% { opacity: 1; }
  88% { opacity: 1; }
  100% { opacity: 0; }
}

/* The controller still takes the card down on time. */
:root[data-motion='reduced'] .level-card {
  animation: none;
}
</style>
