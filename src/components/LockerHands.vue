<template>
  <div class="hands" :style="{ '--rows': HAND_ROW_COUNT }">
    <p class="hands-head">
      <span class="hands-title">In hand</span>
      <span class="hands-sub">Click gear to stow</span>
    </p>
    <p v-if="!shown" class="px-note hands-wait">Opening the locker...</p>
    <ul v-else class="hands-rows">
      <li v-for="row in shown" :key="row.label" class="hands-row" :class="{ 'is-empty': row.held === 0 }">
        <span class="hands-label">{{ row.label }}</span>
        <span class="hands-items">
          <button
            v-for="item in row.items"
            :key="item.key"
            type="button"
            class="hands-item"
            :title="`Click to stow ${item.label} into locker`"
            :aria-label="`Click to stow ${item.label} into locker`"
            @click="emit('stow', item.key)"
          >
            <SpriteImg v-if="item.sprite" :sprite="item.sprite" />
            <span v-if="item.count > 1" class="hands-count">{{ item.count }}</span>
          </button>
        </span>
        <span class="hands-cells" role="img" :aria-label="`${row.label}: ${row.held} of ${row.cap}`">
          <span v-for="n in ITEM_SLOTS" :key="n" class="hands-cell" :class="{ 'is-on': n <= row.filled }" />
        </span>
        <span class="hands-value">{{ row.held }}/{{ row.cap }}</span>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
/**
 * The column beside the locker: what is in hand now, a row per kind of gear in a fixed order, each with the
 * in-game icon and count of what is carried and a bar of it against the most a player may carry. Every icon is
 * drawn at one scale, the strip under it. Clicking a held item stows it back to the locker.
 */
import { computed } from 'vue';
import type { HandRow } from '../game/home/locker-view.ts';
import { HAND_ROW_COUNT, lockerSprite } from '../game/home/locker-view.ts';
import type { ShopIcons } from '../game/home/shop-item-art.ts';
import { ITEM_SLOTS } from '../game/home/shop-item-facts.ts';
import SpriteImg from './SpriteImg.vue';

interface HandsProps {
  /** Null while the save is still loading. */
  rows: readonly HandRow[] | null;
  icons: ShopIcons | null;
}

const { rows, icons } = defineProps<HandsProps>();
const emit = defineEmits<{ stow: [key: string] }>();

const shown = computed(() =>
  rows?.map((row) => ({
    ...row,
    items: row.items.map((item) => ({ ...item, sprite: icons ? lockerSprite(icons, item.key) : null })),
  }))
);
</script>

<style scoped>
.hands {
  --row-h: calc(var(--u) * 26);
  display: flex;
  flex-direction: column;
  gap: calc(var(--u) * 3);
  width: calc(var(--u) * 264);
  height: 100%;
}

.hands p {
  margin: 0;
}

/* Read like the shop's purse strip. */
.hands-head {
  display: flex;
  align-items: baseline;
  gap: calc(var(--u) * 3);
  padding: calc(var(--u) * 2.5) calc(var(--u) * 3);
  background: rgba(11, 12, 16, 0.88);
  border-bottom: var(--u) solid var(--ink-line);
}

.hands-title {
  color: var(--amber);
  font-size: calc(var(--u) * 10);
  font-weight: 700;
  line-height: 1;
  text-transform: uppercase;
}

.hands-sub {
  margin-left: auto;
  color: var(--bone-dim);
  font-size: calc(var(--u) * 6);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* As tall as the rows it stands in for, so the save landing moves nothing. */
.hands-wait {
  display: flex;
  align-items: center;
  justify-content: center;
  height: calc(var(--row-h) * var(--rows) + var(--u) * 2 * (var(--rows) - 1));
  max-width: none;
}

.hands-rows {
  display: grid;
  grid-template-columns: calc(var(--u) * 44) 1fr max-content calc(var(--u) * 30);
  grid-auto-rows: var(--row-h);
  gap: calc(var(--u) * 2) calc(var(--u) * 3);
  margin: 0;
  padding: 0;
  list-style: none;
}

.hands-row {
  display: grid;
  grid-column: 1 / -1;
  grid-template-columns: subgrid;
  align-items: center;
  padding-inline: calc(var(--u) * 2.5);
  background: rgba(23, 24, 31, 0.78);
  border: 1px solid rgba(51, 52, 60, 0.4);
}

.hands-label {
  color: var(--bone);
  font-size: calc(var(--u) * 7.5);
  font-weight: 700;
  text-transform: uppercase;
}

.hands-items {
  display: flex;
  align-items: center;
  gap: calc(var(--u) * 1.5);
  min-width: 0;
  overflow: hidden;
}

/* Each icon at its own size, clickable to stow back into locker. */
.hands-item {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  border: var(--u) solid var(--ink-line);
  padding: calc(var(--u) * 1);
  background: var(--ink);
  cursor: pointer;
  outline: none;
  transition: transform 120ms ease, border-color 120ms ease;
}

.hands-item:hover,
.hands-item:focus-visible {
  border-color: var(--blood-bright);
  transform: scale(1.12);
}

.hands-item:active {
  transform: scale(0.95);
}

.hands-count {
  position: absolute;
  right: calc(var(--u) * -1);
  bottom: calc(var(--u) * -1);
  padding: 0 calc(var(--u) * 1);
  background: rgba(7, 8, 12, 0.95);
  border: 1px solid var(--ink-line);
  color: var(--amber);
  font-size: calc(var(--u) * 6);
  font-weight: 700;
  line-height: 1.2;
}

.hands-cells {
  display: flex;
  gap: calc(var(--u) * 1);
}

.hands-cell {
  width: calc(var(--u) * 7);
  height: calc(var(--u) * 7);
  background: var(--ink-line);
}

.hands-cell.is-on {
  background: var(--sick);
  box-shadow: 0 0 calc(var(--u) * 2) rgba(143, 191, 58, 0.5);
}

.hands-value {
  color: var(--bone);
  font-size: calc(var(--u) * 7);
  font-weight: 700;
  text-align: right;
  white-space: nowrap;
}

.hands-row.is-empty .hands-value {
  color: var(--bone-dim);
  font-weight: 400;
}

/* A phone stacks the column under the scene, never wider than the screen. */
@container select (max-width: 420px) {
  .hands {
    width: 100%;
  }
}
</style>
