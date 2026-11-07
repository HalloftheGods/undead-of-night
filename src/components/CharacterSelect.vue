<template>
  <div class="select">
    <div class="select-card">
      <div class="select-bust px-frame">
        <SpriteImg v-if="art" :sprite="art.survivors[shown].select" :scale="bustScale" />
        <div class="select-plate">
          <p class="select-name">{{ survivor.name }}</p>
          <p class="select-trait">{{ survivor.trait }}</p>
        </div>
      </div>
      <StatBars class="select-stats" :skin="shown" />
    </div>
    <SurvivorRoster ref="roster" :art :chosen @choose="choose" @preview="preview" />
  </div>
</template>

<script setup lang="ts">
/**
 * The survivor select screen: a big framed card for the survivor pointed at (or the one chosen),
 * with their bust, name, trait and five stat bars, over the roster to pick from.
 */
import { computed, ref, useTemplateRef } from 'vue';
import { characterOf } from '../../shared/characters.ts';
import type { ArtBook } from '../art/types.ts';
import { loadCharacter, saveCharacter } from '../game/character-pref.ts';
import SpriteImg from './SpriteImg.vue';
import StatBars from './StatBars.vue';
import SurvivorRoster from './SurvivorRoster.vue';
import { useGame } from './use-game.ts';

/** A page with its own header above takes a smaller bust, so the roster still fits without scrolling. */
const { art, bustScale = 3 } = defineProps<{ art: ArtBook | null; bustScale?: number }>();
const game = useGame();
const roster = useTemplateRef<InstanceType<typeof SurvivorRoster>>('roster');

const chosen = ref(loadCharacter());
const previewed = ref<number | null>(null);
const shown = computed(() => previewed.value ?? chosen.value);
const survivor = computed(() => characterOf(shown.value));

function choose(index: number): void {
  game.playUi('click');
  chosen.value = index;
  saveCharacter(index);
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

/* The bust and one column of bars, both fixed in size (the name and trait live inside the bust frame), so changing survivor moves nothing. */
.select-card {
  display: grid;
  grid-template-columns: auto auto;
  justify-content: center;
  align-items: center;
  gap: calc(var(--u) * 14);
  padding: calc(var(--u) * 2) calc(var(--u) * 4);
}

.select-stats {
  min-width: 0;
}

.select-bust {
  --edge: var(--amber);
  position: relative;
  flex: none;
  padding: calc(var(--u) * 3);
  background: var(--ink-raised);
}

/* The nameplate sits over the bust's shoulders, so it adds no height to the card. */
.select-plate {
  position: absolute;
  inset: auto 0 0;
  padding: calc(var(--u) * 3);
  background: rgba(7, 8, 12, 0.82);
  border-top: var(--u) solid var(--amber);
  text-align: center;
}

.select-name {
  margin: 0 0 calc(var(--u) * 2);
  color: var(--amber);
  font-size: calc(var(--u) * 14);
  font-weight: 700;
  line-height: 1;
  text-transform: uppercase;
}

/* Two lines are always kept, so a long trait never changes the plate's height. */
.select-trait {
  margin: 0;
  min-height: 2lh;
  color: var(--bone-dim);
}

/* A phone has no room beside the bust: the bars stack under it, still in the same places. */
@container select (max-width: 420px) {
  .select-card {
    grid-template-columns: 1fr;
    justify-items: center;
    gap: calc(var(--u) * 4);
    padding: 0;
  }

  .select-bust {
    order: -1;
  }
}
</style>
