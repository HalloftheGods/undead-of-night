<template>
  <section class="px-screen px-title-scale summary-screen" aria-labelledby="summary-heading">
    <div class="summary px-frame">
      <p class="summary-head">The bunker</p>
      <h2 id="summary-heading" class="px-heading is-danger summary-heading">{{ deathHeading(death) }}</h2>
      <p v-if="cause" class="summary-cause">{{ cause }}</p>
      <p class="px-note summary-note">{{ deathNote(death) }}</p>
      <ul class="summary-lost">
        <li v-for="line in lines" :key="line">{{ line }}</li>
      </ul>
      <div ref="wakeBox" class="summary-wake">
        <PixelButton primary silent @press="game.home.wake()">Wake up</PixelButton>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
/** A Campaign death, on the same framed card as Pause and Game Over: what got you, what was lost, and Wake up. */
import { computed, nextTick, onMounted, useTemplateRef } from 'vue';
import { deathLine, deathWitness } from '../game/death-cause.ts';
import type { HomeDeath } from '../game/home-hud.ts';
import { deathHeading, deathNote, deathSummary } from '../game/home-screens.ts';
import PixelButton from './PixelButton.vue';
import { useGame } from './use-game.ts';

const { death } = defineProps<{ death: HomeDeath }>();
const game = useGame();
const wakeBox = useTemplateRef<HTMLElement>('wakeBox');
const lines = computed(() => deathSummary(death));
/** Read once: the fall has happened by the time this card is up. */
const cause = deathLine(deathWitness.cause());

onMounted(() => void nextTick(() => wakeBox.value?.querySelector('button')?.focus({ preventScroll: true })));
</script>

<style scoped>
.summary-screen {
  background: rgba(7, 8, 12, 0.82);
}

.summary {
  --edge: var(--blood);
  display: flex;
  flex-direction: column;
  gap: calc(var(--u) * 4);
  width: calc(var(--u) * 170);
  max-width: 100%;
  padding: calc(var(--u) * 6);
  background: var(--ink-raised);
  animation: px-fade-in 0.4s steps(4) both;
}

/* A strip along the card's top, as on the Pause and Level Select cards. */
.summary-head {
  margin: calc(var(--u) * -6) calc(var(--u) * -6) 0;
  padding: calc(var(--u) * 2) calc(var(--u) * 4);
  border-bottom: var(--u) solid var(--blood);
  background: var(--ink);
  color: var(--bone-dim);
  font-size: calc(var(--u) * 5);
  text-transform: uppercase;
}

.summary-heading {
  margin: calc(var(--u) * 2) 0 0;
}

.summary-cause {
  margin: 0;
  color: var(--bone);
  text-align: center;
}

.summary-note {
  margin: 0 auto;
}

.summary-lost {
  margin: 0;
  padding: calc(var(--u) * 2) calc(var(--u) * 3);
  background: rgba(7, 8, 12, 0.6);
  color: var(--bone);
  list-style: none;
}

.summary-wake :deep(.px-button) {
  min-height: 48px;
  font-size: calc(var(--u) * 9);
}
</style>
