<template>
  <TitlePage heading="Level Select" bare @close="emit('close')">
    <ol class="level-cards" aria-label="Levels">
      <li v-for="row in rows" :key="row.number" class="level-stop">
        <component
          :is="row.unlocked ? 'button' : 'div'"
          class="level-card px-frame"
          :class="{ 'is-locked': !row.unlocked }"
          :type="row.unlocked ? 'button' : undefined"
          :aria-label="row.unlocked ? `Start in ${row.town}: ${row.title}` : `${row.town}: locked`"
          @click="choose(row.number)"
          @mouseenter="hover(row.number)"
          @mouseleave="previewed = null"
          @focus="previewed = row.number"
          @blur="previewed = null"
        >
          <span class="level-head">
            <span class="level-number" aria-hidden="true">{{ row.number }}</span>
            <span class="level-town">{{ row.town }}</span>
          </span>
          <span class="level-art">
            <img v-if="row.scene" :src="spriteDataUrl(row.scene)" alt="" draggable="false" />
            <span v-if="!row.unlocked" class="level-locked" aria-hidden="true">Locked</span>
            <span class="level-title" :style="{ '--chars': longestWord(row.name) }">{{ row.name }}</span>
          </span>
        </component>
      </li>
    </ol>

    <div class="level-info" aria-live="polite">
      <p class="level-info-name">{{ featured.name }}</p>
      <p class="level-info-line">{{ featured.line }}</p>
      <PickBars :bars="featured.bars" />
      <p class="px-label level-info-note">{{ LEVELS_PAGE_NOTE }}</p>
    </div>
  </TitlePage>
</template>

<script setup lang="ts">
/**
 * The Levels page, laid out like the Play page: no box, the ten towns as portrait cards with their titles along the
 * bottom, and the one pointed at (else the furthest reached) told in a few lines with its meters under them.
 */
import { computed, ref } from 'vue';
import { LEVELS, levelDef, townName } from '../../shared/levels.ts';
import type { ArtBook } from '../art/types.ts';
import { spriteDataUrl } from '../engine/sprite-cache.ts';
import { levelMeters } from '../game/level-meters.ts';
import { isLevelUnlocked, loadLevelProgress } from '../game/level-progress.ts';
import { THEME_NAMES } from '../game/level-select.ts';
import { longestWord } from '../game/setup-picks.ts';
import type { PickBar } from '../game/setup-picks.ts';
import { LEVELS_PAGE_NOTE } from '../game/title-menu.ts';
import PickBars from './PickBars.vue';
import TitlePage from './TitlePage.vue';
import { useGame } from './use-game.ts';

const { art } = defineProps<{ art: ArtBook | null }>();
const emit = defineEmits<{ close: []; start: [level: number] }>();
const game = useGame();
const progress = loadLevelProgress();
const previewed = ref<number | null>(null);

function choose(level: number): void {
  const isOpen = isLevelUnlocked(level, progress);
  if (!isOpen) return;
  game.playUi('click');
  emit('start', level);
}

function hover(level: number): void {
  game.playUi('hover');
  previewed.value = level;
}

const sceneOf = (level: number) => art?.ui.levelScenes[level - 1] ?? null;
const lockHintOf = (level: number) => `Survive ${townName(level - 1)} to unlock`;

const rows = computed(() =>
  LEVELS.map((level) => {
    const unlocked = isLevelUnlocked(level.number, progress);
    return { number: level.number, town: level.town, title: level.title, unlocked, scene: sceneOf(level.number), name: unlocked ? level.title : 'Classified' };
  })
);

/** The level the lines under the cards tell: the one pointed at, else the furthest reached. */
const featured = computed(() => {
  const def = levelDef(previewed.value ?? progress.highest);
  const unlocked = isLevelUnlocked(def.number, progress);
  const theme = THEME_NAMES[def.theme] ?? def.theme;
  const goal = unlocked ? `Survive ${def.hordes} hordes to open the exit.` : `${lockHintOf(def.number)}.`;
  const bars: readonly PickBar[] = levelMeters(def).map((meter) => ({ key: meter.key, label: meter.label, filled: meter.slots, strong: false }));
  return { name: unlocked ? def.title : 'Classified sector', line: `${def.town} - ${theme}. ${goal}`, bars };
});
</script>

<style scoped>
/* Five to a row, two rows, as big as the screen allows with the heading above and the lines and Back below. */
.level-cards {
  --card: min(calc(var(--u) * 84), calc((100vw - var(--u) * 40) / 5 - var(--u) * 4), calc(((100vh - var(--u) * 150) / 2 - var(--u) * 16) * 0.78));
  display: grid;
  grid-template-columns: repeat(5, var(--card));
  justify-content: center;
  gap: calc(var(--u) * 4);
  margin: 0;
  padding: 0;
  list-style: none;
}

.level-card {
  --edge: var(--ink-line);
  container-type: inline-size;
  display: flex;
  flex-direction: column;
  gap: calc(var(--u) * 1.5);
  width: 100%;
  border: 0;
  padding: calc(var(--u) * 1.5);
  background: var(--ink-raised);
  color: var(--bone);
  font: inherit;
  text-transform: uppercase;
  cursor: pointer;
  outline: none;
}

.level-card:hover,
.level-card:focus-visible {
  --edge: var(--amber);
}

.level-card.is-locked {
  cursor: default;
}

.level-card.is-locked:hover {
  --edge: var(--ink-line);
}

.level-head {
  display: flex;
  align-items: center;
  gap: calc(var(--u) * 1.5);
  min-width: 0;
  color: var(--bone-dim);
  font-size: calc(var(--u) * 3.5);
  white-space: nowrap;
}

.level-number {
  display: grid;
  flex: none;
  place-items: center;
  width: calc(var(--u) * 6);
  height: calc(var(--u) * 6);
  background: var(--amber);
  color: var(--ink);
  font-weight: 700;
}

.is-locked .level-number {
  background: var(--ink-line);
  color: var(--bone-dim);
}

.level-town {
  overflow: hidden;
  text-overflow: ellipsis;
}

.level-art {
  position: relative;
  display: block;
  aspect-ratio: 56 / 72;
  overflow: hidden;
  background: var(--ink);
}

.level-art img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  image-rendering: pixelated;
}

.is-locked .level-art img {
  filter: grayscale(1) brightness(0.35);
}

.level-locked {
  position: absolute;
  top: 35%;
  left: 0;
  right: 0;
  color: var(--bone-dim);
  font-size: calc(var(--u) * 4);
  letter-spacing: 0.2em;
  text-align: center;
}

/* The town's title along the bottom of its picture, like the Play page's cards. */
.level-title {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: calc(var(--u) * 8) var(--u) calc(var(--u) * 2);
  background: linear-gradient(to top, rgba(7, 8, 12, 0.92) 0%, rgba(7, 8, 12, 0.55) 60%, transparent 100%);
  color: var(--bone);
  font-size: min(clamp(calc(var(--u) * 4), 11cqi, calc(var(--u) * 10)), calc(90cqi / (var(--chars) * 1.3)));
  font-weight: 700;
  line-height: 1.1;
  letter-spacing: 0.1em;
  text-indent: 0.1em;
  text-align: center;
  text-shadow:
    0 calc(var(--u) * 0.75) 0 var(--blood),
    0 calc(var(--u) * 1.5) 0 var(--ink);
  text-wrap: balance;
}

.level-card:hover .level-title,
.level-card:focus-visible .level-title {
  color: var(--amber);
}

.is-locked .level-title {
  color: var(--bone-dim);
}

/* The pointed-at level, told in a few centred lines. */
.level-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: calc(var(--u) * 2);
  text-align: center;
}

.level-info p {
  margin: 0;
}

.level-info-name {
  color: var(--amber);
  font-size: calc(var(--u) * 9);
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.level-info-line {
  color: var(--bone);
}

.level-info-note {
  color: var(--bone-dim);
}
</style>
