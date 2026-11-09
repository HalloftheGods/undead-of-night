<template>
  <section class="px-screen">
    <div class="px-panel px-frame garage">
      <header class="garage-head">
        <h2 class="px-heading">Level map</h2>
        <p class="px-note">Pick where the van goes. The room can go as far as its best player has.</p>
      </header>
      <div class="garage-levels">
        <SceneCard :sprite="featured.scene" :name="featured.name" :line="featured.line" :class="{ 'is-locked': !featured.selectable }">
          <LevelBars :def="featured.def" />
        </SceneCard>
        <LevelGrid :rows @choose="game.home.pickLevel($event)" @preview="previewed = $event" />
      </div>
      <footer class="garage-foot">
        <PixelButton class="garage-close" primary @press="game.home.closeStation()">Close</PixelButton>
      </footer>
    </div>
  </section>
</template>

<script setup lang="ts">
/**
 * The van's level map, laid out like the Levels page: a big framed card for the level pointed at (else the
 * one picked, else the furthest the room has reached), with its scene, name and four meters, over the ten
 * scene tiles to pick from. Every level up to the room's best can be picked; the ones before it are replays.
 */
import { computed, ref } from 'vue';
import { levelDef } from '../../shared/levels.ts';
import type { ArtBook } from '../art/types.ts';
import type { HomeUi } from '../game/home-hud.ts';
import { garageLevels } from '../game/home-screens.ts';
import { THEME_NAMES } from '../game/level-select.ts';
import { LEVEL_SWATCH } from '../game/level-swatches.ts';
import LevelBars from './LevelBars.vue';
import LevelGrid from './LevelGrid.vue';
import type { LevelGridRow } from './LevelGrid.vue';
import PixelButton from './PixelButton.vue';
import SceneCard from './SceneCard.vue';
import { useGame } from './use-game.ts';

const { home, art } = defineProps<{ home: HomeUi; art: ArtBook | null }>();
const game = useGame();
const previewed = ref<number | null>(null);

const levels = computed(() => garageLevels(home));
const sceneOf = (level: number) => art?.ui.levelScenes[level - 1] ?? null;
const LOCK_HINT = 'NOT REACHED YET';

/** The level the big card shows: the one pointed at, else the one picked, else the furthest reached. */
const featured = computed(() => {
  const all = levels.value;
  const reach = all.findLast((level) => level.selectable) ?? all[0];
  const shownNumber = previewed.value ?? home.pickedLevel ?? reach.number;
  const level = all.find((each) => each.number === shownNumber) ?? reach;
  const def = levelDef(level.number);
  const theme = THEME_NAMES[def.theme] ?? def.theme;
  const goal = level.selectable ? `Survive ${def.hordes} hordes to open the exit.` : 'Not reached yet.';
  return {
    def,
    selectable: level.selectable,
    scene: sceneOf(level.number),
    name: level.selectable ? def.title : 'Classified sector',
    line: `${def.town} - ${theme}. ${goal}`,
  };
});

const rows = computed<readonly LevelGridRow[]>(() =>
  levels.value.map((level) => {
    const def = levelDef(level.number);
    return {
      number: level.number,
      town: def.town,
      title: level.title,
      themeLabel: THEME_NAMES[def.theme] ?? def.theme,
      swatch: LEVEL_SWATCH[def.theme],
      hordes: def.hordes,
      difficulty: def.difficulty,
      unlocked: level.selectable,
      tag: level.selectable ? 'button' : 'div',
      startLabel: level.selectable ? `Drive to ${def.town}: ${level.title}` : undefined,
      thumbnail: sceneOf(level.number),
      cleared: false,
      picked: level.picked,
      badge: level.state === 'replay' ? 'REPLAY' : undefined,
      lockHint: LOCK_HINT,
      actionHint: level.picked ? 'PICKED' : 'GO',
    };
  })
);
</script>

<style scoped>
/* Trimmed edges, so the whole map fits an 800x600 window without scrolling. */
.px-screen {
  padding: calc(var(--u) * 3);
}

.garage {
  display: flex;
  flex-direction: column;
  gap: calc(var(--u) * 2);
  width: min(calc(var(--u) * 460), 100%);
  padding-block: calc(var(--u) * 4);
  max-height: 100%;
  overflow-y: auto;
}

.garage-head {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: calc(var(--u) * 2);
}

/* One line on a wide sheet, so the tiles keep their room. */
.garage-head .px-note {
  max-width: none;
  margin: 0;
}

.garage-levels {
  display: flex;
  flex-direction: column;
  gap: calc(var(--u) * 3);
  container: select / inline-size;
}

.garage-levels :deep(.select-card) {
  padding-block: 0;
}

.garage-foot {
  display: flex;
  justify-content: flex-end;
}

.garage-close {
  width: auto;
  padding-inline: calc(var(--u) * 10);
}

/* A level not reached yet shows only as a dark shape, like its tile. */
.is-locked :deep(.select-scene img) {
  filter: grayscale(1) brightness(0.4);
}
</style>
