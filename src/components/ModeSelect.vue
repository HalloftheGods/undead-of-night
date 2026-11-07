<template>
  <div class="select">
    <SceneCard :sprite="art?.ui.mode[card.mode] ?? null" :name="card.label" :line="card.line">
      <ModeFacts :mode="card.mode" :game-style />
    </SceneCard>
    <SceneRoster ref="roster" label="Mode" :items="tiles" :chosen="modeIndex(mode)" @choose="choose" @preview="preview">
      <template #default="{ index }">
        <ModeFacts :mode="MODE_CARDS[index].mode" compact />
      </template>
    </SceneRoster>
  </div>
</template>

<script setup lang="ts">
/**
 * The Play page's first step, laid out like the survivor select: a big framed card for Solo or Multiplayer
 * (whichever is pointed at, else the one chosen) with its scene, name, line and facts, over the two tiles to pick from.
 * The mode itself lives in the Play flow; this only reports a pick.
 */
import { computed, ref, useTemplateRef } from 'vue';
import type { GameStyle } from '../../shared/game-style.ts';
import type { ArtBook } from '../art/types.ts';
import { MODE_CARDS, modeIndex } from '../game/mode-select-view.ts';
import type { PlayMode } from '../game/play-flow.ts';
import ModeFacts from './ModeFacts.vue';
import SceneCard from './SceneCard.vue';
import SceneRoster from './SceneRoster.vue';
import { useGame } from './use-game.ts';

const { art, mode, gameStyle } = defineProps<{ art: ArtBook | null; mode: PlayMode; gameStyle: GameStyle | null }>();
const emit = defineEmits<{ choose: [mode: PlayMode] }>();
const game = useGame();
const roster = useTemplateRef<InstanceType<typeof SceneRoster>>('roster');

const previewed = ref<number | null>(null);
const card = computed(() => MODE_CARDS[previewed.value ?? modeIndex(mode)]);
const tiles = computed(() =>
  MODE_CARDS.map((each) => ({ key: each.mode, name: each.label, aria: `${each.label}: ${each.line}`, sprite: art?.ui.mode[each.mode] ?? null }))
);

function choose(index: number): void {
  game.playUi('click');
  emit('choose', MODE_CARDS[index].mode);
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
</style>
