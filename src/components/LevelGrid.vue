<template>
  <div class="levels-fit">
    <div class="levels-grid">
      <component
        :is="row.tag"
        v-for="row in rows"
        :key="row.number"
        class="level-tile px-frame"
        :class="{ 'is-locked': !row.unlocked, 'is-cleared': row.cleared, 'is-startable': row.unlocked, 'is-picked': row.picked }"
        :type="row.unlocked ? 'button' : undefined"
        :aria-label="row.startLabel"
        @click="choose(row)"
        @mouseenter="emit('preview', row.number)"
        @mouseleave="emit('preview', null)"
        @focus="emit('preview', row.number)"
        @blur="emit('preview', null)"
      >
        <span class="level-scene" :style="sceneSize(row)">
          <SpriteImg v-if="row.thumbnail" :sprite="row.thumbnail" class="level-scene-img" />
          <span v-if="!row.unlocked" class="level-lock" aria-hidden="true" />
          <span v-else-if="row.badge" class="level-clear-tag">{{ row.badge }}</span>
          <span v-else-if="row.cleared" class="level-clear-tag">CLEARED</span>

          <span class="level-plate">
            <span class="level-plate-row">
              <span class="level-num">{{ row.town.toUpperCase() }}</span>
              <span class="level-theme" :style="{ '--swatch': row.swatch }">{{ row.themeLabel }}</span>
            </span>
            <span class="level-name">{{ row.unlocked ? row.title : 'CLASSIFIED SECTOR' }}</span>
            <span v-if="!row.unlocked" class="level-lock-hint">{{ row.lockHint }}</span>
            <span v-else class="level-plate-row level-meta">
              <span>{{ row.hordes }} HORDES x{{ row.difficulty.toFixed(2) }}</span>
              <span class="level-start-hint">{{ row.actionHint }} &#9654;</span>
            </span>
          </span>
        </span>
      </component>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * The ten levels as framed scene tiles, five to a row (two on a phone): each level's picture drawn at
 * whole pixels to fill its tile, with a nameplate over its foot. Pointing at or focusing a tile previews
 * it, for a page that shows a big card. A locked tile is darkened under a padlock and keeps its title hidden.
 */
import { CARD_H, CARD_W } from '../art/difficulty-card.ts';
import type { PixelSprite } from '../art/types.ts';
import SpriteImg from './SpriteImg.vue';

/** One card. The page that shows the grid decides what unlocked, cleared and picked mean. */
export interface LevelGridRow {
  readonly number: number;
  /** The town's name, shown where the tile once said LEVEL 03. */
  readonly town: string;
  readonly title: string;
  readonly themeLabel: string;
  readonly swatch: string;
  readonly hordes: number;
  readonly difficulty: number;
  readonly unlocked: boolean;
  readonly tag: 'button' | 'div';
  readonly startLabel: string | undefined;
  /** The level's picture, or null while the art book loads (the tile keeps a scene card's size). */
  readonly thumbnail: PixelSprite | null;
  readonly cleared: boolean;
  readonly picked?: boolean;
  /** Shown on the thumbnail in place of CLEARED, such as REPLAY. */
  readonly badge?: string;
  readonly lockHint: string;
  readonly actionHint: string;
}

defineProps<{ rows: readonly LevelGridRow[] }>();
const emit = defineEmits<{ choose: [level: number]; preview: [level: number | null] }>();

/** Only an unlocked card is a button, so a locked one cannot be pressed even by a stale click. */
function choose(row: LevelGridRow): void {
  if (row.unlocked) emit('choose', row.number);
}

/** The picture's size in art pixels; a scene card's before the art arrives, so nothing moves when it does. */
function sceneSize(row: LevelGridRow): Record<string, number> {
  return { '--scene-w': row.thumbnail?.w ?? CARD_W, '--scene-h': row.thumbnail?.h ?? CARD_H };
}
</script>

<style scoped>
.levels-fit {
  container-type: inline-size;
}

.levels-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: calc(var(--u) * 3);
  padding: var(--u);
}

/* A phone has no room for five across. */
@container (max-width: 420px) {
  .levels-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.level-tile {
  --edge: var(--ink-line);
  display: flex;
  justify-content: center;
  min-width: 0;
  padding: 0;
  border: 0;
  background: var(--ink);
  container-type: inline-size;
}

.level-tile.is-startable {
  font: inherit;
  color: inherit;
  text-align: left;
  cursor: pointer;
  outline: none;
}

.level-tile.is-startable:hover,
.level-tile.is-startable:focus-visible,
.level-tile.is-cleared,
.level-tile.is-picked {
  --edge: var(--amber);
}

/* Whole device pixels per art pixel, the most that fit the tile's width. */
.level-scene {
  --sprite-px: max(var(--dpx, 1px), round(down, calc(100cqw / var(--scene-w)), var(--dpx, 1px)));
  position: relative;
  display: block;
  width: calc(var(--sprite-px) * var(--scene-w));
  height: calc(var(--sprite-px) * var(--scene-h));
  overflow: hidden;
  background: var(--ink-raised);
}

.level-scene-img {
  display: block;
}

.is-locked .level-scene-img {
  filter: grayscale(1) brightness(0.4);
}

/* A padlock in the ink colours: the shackle is the ::before, the body the span, the keyhole the ::after. */
.level-lock {
  position: absolute;
  top: 22%;
  left: 50%;
  width: calc(var(--u) * 9);
  height: calc(var(--u) * 7);
  translate: -50% 0;
  margin-top: calc(var(--u) * 4);
  background: var(--bone-dim);
}

.level-lock::before {
  content: '';
  position: absolute;
  bottom: 100%;
  left: calc(var(--u) * 1.5);
  width: calc(var(--u) * 3);
  height: calc(var(--u) * 3);
  border: calc(var(--u) * 1.5) solid var(--bone-dim);
  border-bottom: 0;
}

.level-lock::after {
  content: '';
  position: absolute;
  top: calc(var(--u) * 2);
  left: calc(var(--u) * 4);
  width: var(--u);
  height: calc(var(--u) * 3);
  background: var(--ink);
}

.level-clear-tag {
  position: absolute;
  top: calc(var(--u) * 1);
  right: calc(var(--u) * 1);
  padding: 0 var(--u);
  background: rgba(7, 8, 12, 0.82);
  color: var(--amber);
  font-size: calc(var(--u) * 4);
  box-shadow: 0 0 0 calc(var(--u) * 0.5) var(--amber);
}

/* The nameplate sits over the foot of the scene, as on the select cards. */
.level-plate {
  position: absolute;
  inset: auto 0 0;
  display: flex;
  flex-direction: column;
  gap: calc(var(--u) * 0.5);
  padding: var(--u) calc(var(--u) * 1.5);
  background: rgba(7, 8, 12, 0.82);
  border-top: calc(var(--u) * 0.5) solid var(--amber);
  font-size: calc(var(--u) * 4);
  line-height: 1.2;
}

.is-locked .level-plate {
  border-top-color: var(--ink-line);
}

.level-plate-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: var(--u);
  white-space: nowrap;
}

.level-num {
  color: var(--amber);
  font-weight: 700;
}

.is-locked .level-num {
  color: var(--bone-dim);
}

.level-theme {
  overflow: hidden;
  padding-left: var(--u);
  border-left: var(--u) solid var(--swatch);
  color: var(--bone-dim);
  text-overflow: ellipsis;
  text-transform: uppercase;
}

.level-name {
  overflow: hidden;
  color: var(--bone);
  font-size: calc(var(--u) * 5);
  text-overflow: ellipsis;
  text-transform: uppercase;
  white-space: nowrap;
}

.level-meta {
  color: var(--bone-dim);
}

.level-start-hint {
  color: var(--amber);
}

.level-lock-hint {
  color: var(--blood-bright);
  text-transform: uppercase;
}
</style>
