<template>
  <div class="select">
    <SceneCard :sprite="art?.ui.style[card.style] ?? null" :name="card.label" :line="card.line">
      <StyleFacts :game-style="card.style" />
      <p class="select-key">{{ STYLE_ROOM_NOTE }}</p>
    </SceneCard>
    <SceneRoster ref="roster" label="Style" :items="tiles" :chosen="styleIndex(gameStyle)" @choose="choose" @preview="preview" />
  </div>
</template>

<script setup lang="ts">
/**
 * The Play page's first step, laid out like the mode step: a big framed card for Campaign or Arcade
 * (whichever is pointed at, else the one chosen) with its scene, name, line and facts, over the two tiles to pick from.
 * The choice itself is the game's to remember; this only reports a pick.
 */
import { computed, ref, useTemplateRef } from 'vue';
import type { GameStyle } from '../../shared/game-style.ts';
import type { ArtBook } from '../art/types.ts';
import { STYLE_CARDS, STYLE_ROOM_NOTE, styleIndex } from '../game/style-select-view.ts';
import SceneCard from './SceneCard.vue';
import SceneRoster from './SceneRoster.vue';
import StyleFacts from './StyleFacts.vue';
import { useGame } from './use-game.ts';

const { art, gameStyle } = defineProps<{ art: ArtBook | null; gameStyle: GameStyle }>();
const emit = defineEmits<{ choose: [style: GameStyle] }>();
const game = useGame();
const roster = useTemplateRef<InstanceType<typeof SceneRoster>>('roster');

const previewed = ref<number | null>(null);
const card = computed(() => STYLE_CARDS[previewed.value ?? styleIndex(gameStyle)]);
const tiles = computed(() =>
  STYLE_CARDS.map((each) => ({ key: each.style, name: each.label, aria: `${each.label}: ${each.line}`, sprite: art?.ui.style[each.style] ?? null }))
);

function choose(index: number): void {
  game.playUi('click');
  emit('choose', STYLE_CARDS[index].style);
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
