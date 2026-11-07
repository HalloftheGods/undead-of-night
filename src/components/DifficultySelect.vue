<template>
  <div class="select">
    <SceneCard :sprite="art?.ui.difficulty[difficulty.id] ?? null" :name="difficulty.label" :line="difficulty.blurb">
      <DifficultyBars :def="difficulty" />
      <p class="select-key">Ammo: more bars, more rounds. The rest: more bars, worse.</p>
    </SceneCard>
    <SceneRoster ref="roster" label="Difficulty" :items="tiles" :chosen @choose="choose" @preview="preview">
      <template #default="{ index }">
        <DifficultyBars :def="DIFFICULTIES[index]" compact />
      </template>
    </SceneRoster>
  </div>
</template>

<script setup lang="ts">
/**
 * The difficulty step, laid out like the survivor select: a big framed card for the difficulty pointed at
 * (or the one chosen), with its scene, name, blurb and four meters, over the roster to pick from.
 */
import { computed, ref, useTemplateRef } from 'vue';
import { DIFFICULTIES } from '../../shared/difficulty.ts';
import type { ArtBook } from '../art/types.ts';
import { loadDifficulty, saveDifficulty } from '../game/difficulty-pref.ts';
import DifficultyBars from './DifficultyBars.vue';
import SceneCard from './SceneCard.vue';
import SceneRoster from './SceneRoster.vue';
import { useGame } from './use-game.ts';

const { art } = defineProps<{ art: ArtBook | null }>();
const game = useGame();
const roster = useTemplateRef<InstanceType<typeof SceneRoster>>('roster');

const chosen = ref(Math.max(0, DIFFICULTIES.findIndex((each) => each.id === loadDifficulty())));
const previewed = ref<number | null>(null);
const difficulty = computed(() => DIFFICULTIES[previewed.value ?? chosen.value]);
const tiles = computed(() =>
  DIFFICULTIES.map((each) => ({ key: each.id, name: each.label, aria: `${each.label}: ${each.blurb}`, sprite: art?.ui.difficulty[each.id] ?? null }))
);

function choose(index: number): void {
  game.playUi('click');
  chosen.value = index;
  saveDifficulty(DIFFICULTIES[index].id);
}

function preview(index: number | null): void {
  const isHovering = index !== null;
  if (isHovering) game.playUi('hover');
  previewed.value = index;
}

defineExpose({ focus: () => roster.value?.focus() });
</script>

<style scoped>
.select {
  display: flex;
  flex-direction: column;
  gap: calc(var(--u) * 4);
  container: select / inline-size;
}

.select-key {
  max-width: calc(var(--u) * 150);
  margin: 0;
  color: var(--bone-dim);
  font-size: calc(var(--u) * 6);
}
</style>
