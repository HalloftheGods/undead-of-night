<template>
  <TitlePage heading="Level Select" size="wide" class="levels-screen" @close="emit('close')">
    <p class="px-label levels-note">{{ LEVELS_PAGE_NOTE }}</p>
    <div class="levels">
      <SceneCard :sprite="featured.scene" :name="featured.name" :line="featured.line" :class="{ 'is-locked': !featured.unlocked }">
        <LevelBars :def="featured.def" />
      </SceneCard>
      <LevelGrid :rows @choose="choose" @preview="previewed = $event" />
    </div>
  </TitlePage>
</template>

<script setup lang="ts">
/**
 * The Levels page, laid out like the Play page's select steps: a big framed card for the level pointed at
 * (or the furthest reached), with its scene, name and four meters, over the ten scene tiles to start from.
 */
import { computed, ref } from 'vue';
import { FINAL_LEVEL, LEVELS, levelDef, townName } from '../../shared/levels.ts';
import type { ArtBook } from '../art/types.ts';
import { isLevelUnlocked, loadLevelProgress } from '../game/level-progress.ts';
import { THEME_NAMES } from '../game/level-select.ts';
import { LEVEL_SWATCH } from '../game/level-swatches.ts';
import { LEVELS_PAGE_NOTE } from '../game/title-menu.ts';
import LevelBars from './LevelBars.vue';
import LevelGrid from './LevelGrid.vue';
import type { LevelGridRow } from './LevelGrid.vue';
import SceneCard from './SceneCard.vue';
import TitlePage from './TitlePage.vue';

const { art } = defineProps<{ art: ArtBook | null }>();
const emit = defineEmits<{ close: []; start: [level: number] }>();
const progress = loadLevelProgress();
const previewed = ref<number | null>(null);

function choose(level: number): void {
  if (isLevelUnlocked(level, progress)) emit('start', level);
}

const sceneOf = (level: number) => art?.ui.levelScenes[level - 1] ?? null;
const lockHintOf = (level: number) => `SURVIVE ${townName(level - 1).toUpperCase()} TO UNLOCK`;

/** The level the big card shows: the one pointed at, else the furthest reached. */
const featured = computed(() => {
  const def = levelDef(previewed.value ?? progress.highest);
  const unlocked = isLevelUnlocked(def.number, progress);
  const theme = THEME_NAMES[def.theme] ?? def.theme;
  const goal = unlocked ? `Survive ${def.hordes} hordes to open the exit.` : `${lockHintOf(def.number)}.`;
  return {
    def,
    unlocked,
    scene: sceneOf(def.number),
    name: unlocked ? def.title : 'Classified sector',
    line: `${def.town} - ${theme}. ${goal}`,
  };
});

const rows = computed<readonly LevelGridRow[]>(() =>
  LEVELS.map((level) => {
    const unlocked = isLevelUnlocked(level.number, progress);
    return {
      number: level.number,
      town: level.town,
      title: level.title,
      themeLabel: THEME_NAMES[level.theme] ?? level.theme,
      swatch: LEVEL_SWATCH[level.theme],
      hordes: level.hordes,
      difficulty: level.difficulty,
      unlocked,
      tag: unlocked ? 'button' : 'div',
      startLabel: unlocked ? `Start in ${level.town}: ${level.title}` : undefined,
      thumbnail: sceneOf(level.number),
      cleared: progress.finished && level.number === FINAL_LEVEL,
      lockHint: lockHintOf(level.number),
      actionHint: 'START',
    };
  })
);
</script>

<style scoped>
:deep(.px-sheet-body) {
  gap: calc(var(--u) * 2);
}

.levels-note {
  margin: 0;
}

.levels {
  display: flex;
  flex-direction: column;
  gap: calc(var(--u) * 4);
  container: select / inline-size;
}

/* A locked level's scene shows only as a dark shape, like its tile. */
.is-locked :deep(.select-scene img) {
  filter: grayscale(1) brightness(0.4);
}
</style>
