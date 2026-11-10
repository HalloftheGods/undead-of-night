<template>
  <div v-if="tiles.length > 0" class="strip" role="radiogroup" aria-label="Gear" :style="artBox" @keydown="onKey">
    <div
      v-for="(tile, index) in shown"
      :key="tile.key"
      class="strip-tile px-frame"
      :class="{ 'is-chosen': index === chosen, 'is-empty': tile.locker === 0 && tile.hand === 0 }"
      @mouseenter="emit('hover')"
    >
      <button
        :ref="(el) => setTile(index, el)"
        class="strip-pick"
        type="button"
        role="radio"
        :aria-checked="index === chosen"
        :aria-label="ariaOf(tile)"
        aria-keyshortcuts="Enter Delete"
        :tabindex="index === chosen ? 0 : -1"
        @click="onPick(index, tile.key)"
      >
        <span class="strip-badges">
          <span class="strip-badge is-locker" title="Stored in locker">
            <span class="badge-tag">Locker</span>
            <strong class="badge-num">{{ tile.locker }}</strong>
          </span>
          <span class="strip-badge is-hand" :class="{ 'is-held': tile.hand > 0 }" title="Carried in hand">
            <span class="badge-tag">Hand</span>
            <strong class="badge-num">{{ tile.hand }}</strong>
          </span>
        </span>
        <span class="strip-art">
          <ShopItemArt v-if="tile.sprite" :sprite="tile.sprite" />
        </span>
        <span class="strip-name" :title="tile.label">{{ tile.label }}</span>
        <span class="strip-side"><span>Locker</span><strong>{{ tile.locker }}</strong></span>
        <span class="strip-side" :class="{ 'is-held': tile.hand > 0 }"><span>Hand</span><strong>{{ tile.hand }}</strong></span>
      </button>
      <span class="strip-moves">
        <button
          class="strip-move is-take"
          type="button"
          tabindex="-1"
          :disabled="tile.locker === 0"
          :title="`Take 1 ${tile.label}`"
          @click="emit('take', tile.key)"
        >
          + Take<kbd v-if="index === chosen">Enter</kbd>
        </button>
        <button
          class="strip-move is-stow"
          type="button"
          tabindex="-1"
          :disabled="tile.hand === 0"
          :title="`Stow 1 ${tile.label}`"
          @click="emit('stow', tile.key)"
        >
          - Stow<kbd v-if="index === chosen">Del</kbd>
        </button>
      </span>
    </div>
  </div>
  <p v-else class="strip strip-empty px-note">{{ empty }}</p>
</template>

<script setup lang="ts">
/**
 * The locker's card grid: a framed portrait card for each kind of gear, matching the visual weight
 * of the modern play menus. Features large item sprites with radial glow, bold titles, and direct
 * click-to-transfer actions. Enter takes one and Delete stows one.
 */
import { computed } from 'vue';
import { rosterStep } from '../game/character-select-view.ts';
import type { LockerTile } from '../game/home/locker-view.ts';
import { lockerSprite } from '../game/home/locker-view.ts';
import type { ShopIcons } from '../game/home/shop-item-art.ts';
import ShopItemArt from './ShopItemArt.vue';

interface StripProps {
  tiles: readonly LockerTile[];
  chosen: number;
  icons: ShopIcons | null;
  /** The largest icon in the locker, so every tile draws at one scale. */
  artSize: { w: number; h: number };
  /** What the strip says when it has no tiles. */
  empty: string;
}

const { tiles, chosen, icons, artSize } = defineProps<StripProps>();
interface StripEmits {
  choose: [index: number];
  take: [key: string];
  stow: [key: string];
  hover: [];
}

const emit = defineEmits<StripEmits>();

const pickers = new Map<number, HTMLElement>();
const artBox = computed(() => ({ '--art-w': artSize.w, '--art-h': artSize.h }));
const shown = computed(() => tiles.map((tile) => ({ ...tile, sprite: icons ? lockerSprite(icons, tile.key) : null })));
/** The keys that move gear, each to the side it sends it. */
const MOVE_KEYS: Partial<Record<string, 'take' | 'stow'>> = { Enter: 'take', NumpadEnter: 'take', Delete: 'stow', Backspace: 'stow' };

function setTile(index: number, el: unknown): void {
  const isTile = el instanceof HTMLElement;
  if (isTile) pickers.set(index, el);
}

function ariaOf(tile: LockerTile): string {
  return `${tile.label}, ${tile.locker} in the locker, ${tile.hand} in hand`;
}

function onPick(index: number, key: string): void {
  const isAlreadyChosen = index === chosen;
  emit('choose', index);
  if (isAlreadyChosen) {
    emit('take', key);
  }
}

/** Arrows stay on the strip rather than walking the survivor away from the locker. */
function onKey(event: KeyboardEvent): void {
  const move = MOVE_KEYS[event.code];
  const tile = tiles[chosen];
  const moves = move !== undefined && tile !== undefined;
  if (moves) {
    event.preventDefault();
    event.stopPropagation();
    const once = !event.repeat;
    const takes = once && move === 'take';
    const stows = once && move === 'stow';
    if (takes) emit('take', tile.key);
    if (stows) emit('stow', tile.key);
    return;
  }
  const next = rosterStep(chosen, event.key, tiles.length);
  const steps = next !== null;
  if (!steps) return;
  event.preventDefault();
  event.stopPropagation();
  emit('choose', next);
  pickers.get(next)?.focus();
}

/** Puts the keyboard on the chosen tile, as a radio group lands on its checked option. */
defineExpose({ focus: () => pickers.get(chosen)?.focus() });
</script>

<style scoped>
/* Spacious card grid matching modern play menus without squishing items. */
.strip {
  --tile-w: calc(var(--u) * 58);
  --tile-h: calc(var(--u) * 88);
  --gap: calc(var(--u) * 3);
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-content: flex-start;
  gap: var(--gap);
  min-height: calc(var(--tile-h) + var(--gap));
  max-height: calc(var(--tile-h) * 2 + var(--gap) * 2 + var(--u) * 6);
  overflow-y: auto;
  margin: 0;
  padding: calc(var(--u) * 2);
}

.strip-empty {
  align-items: center;
  max-width: none;
}

.strip-tile {
  --edge: var(--ink-line);
  display: flex;
  flex-direction: column;
  flex: 0 0 var(--tile-w);
  width: var(--tile-w);
  height: var(--tile-h);
  min-width: 0;
  container-type: inline-size;
  background: var(--ink-raised);
  color: var(--bone-dim);
  transition: transform 120ms ease, box-shadow 120ms ease, background 120ms ease;
}

.strip-tile:hover,
.strip-tile:focus-within {
  --edge: var(--bone);
  color: var(--bone);
  transform: translateY(calc(var(--u) * -1));
}

.strip-tile.is-chosen {
  --edge: var(--amber);
  background: rgba(232, 163, 61, 0.14);
  color: var(--amber);
}

.strip-pick {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: calc(var(--u) * 1.5);
  flex: 1;
  min-width: 0;
  border: 0;
  padding: calc(var(--u) * 2) calc(var(--u) * 2) var(--u);
  background: none;
  color: inherit;
  font: inherit;
  cursor: pointer;
  outline: none;
}

.strip-badges {
  display: flex;
  justify-content: space-between;
  align-self: stretch;
  gap: var(--u);
  font-size: calc(var(--u) * 5.5);
  line-height: 1;
}

.strip-badge {
  display: flex;
  align-items: center;
  gap: calc(var(--u) * 1);
  padding: calc(var(--u) * 0.5) calc(var(--u) * 1);
  background: rgba(11, 12, 16, 0.85);
  border: 1px solid var(--ink-line);
}

.strip-badge .badge-tag {
  color: var(--bone-dim);
  font-size: calc(var(--u) * 5);
  text-transform: uppercase;
}

.strip-badge .badge-num {
  color: var(--bone);
  font-weight: 700;
  font-size: calc(var(--u) * 6);
}

.strip-badge.is-hand.is-held .badge-num {
  color: var(--sick);
}

/* The icon box is illuminated like the modern portrait cards. */
.strip-art {
  position: relative;
  display: grid;
  place-items: center;
  width: 100%;
  height: calc(var(--u) * 32);
  background: radial-gradient(ellipse at 50% 50%, rgba(232, 163, 61, 0.22), transparent 70%), var(--ink);
  border: 1px solid rgba(51, 52, 60, 0.6);
  overflow: hidden;
}

.strip-art .item-art {
  --art-box-w: calc(100cqw - var(--u) * 2);
  --art-box-h: calc(var(--u) * 30);
}

.strip-name {
  max-width: 100%;
  overflow: hidden;
  font-size: calc(var(--u) * 7);
  font-weight: 700;
  text-overflow: ellipsis;
  text-transform: uppercase;
  white-space: nowrap;
  letter-spacing: 0.04em;
  color: var(--bone);
  text-align: center;
  padding-inline: var(--u);
}

.strip-tile.is-chosen .strip-name {
  color: var(--amber);
}

.strip-side {
  display: none;
  justify-content: space-between;
  align-self: stretch;
  padding-inline: calc(var(--u) * 2);
  color: var(--bone-dim);
  font-size: calc(var(--u) * 5);
  text-transform: uppercase;
}

.strip-side strong {
  color: var(--bone);
}

.strip-side.is-held strong {
  color: var(--sick);
}

.strip-moves {
  display: flex;
  gap: var(--u);
  margin-top: auto;
  padding: calc(var(--u) * 1.5);
  background: rgba(11, 12, 16, 0.7);
  border-top: 1px solid var(--ink-line);
}

.strip-move {
  display: flex;
  flex: 1 1 0;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: calc(var(--u) * 1);
  min-width: 0;
  border: 0;
  padding: calc(var(--u) * 1.5) 0;
  background: var(--ink);
  box-shadow: 0 0 0 1px var(--ink-line);
  color: var(--bone);
  font: inherit;
  font-size: calc(var(--u) * 6);
  font-weight: 700;
  line-height: 1.1;
  text-transform: uppercase;
  cursor: pointer;
  transition: box-shadow 100ms, color 100ms, background 100ms;
}

.strip-move:hover:not(:disabled) {
  box-shadow: 0 0 0 1px var(--amber);
  color: var(--amber);
  background: rgba(232, 163, 61, 0.12);
}

.strip-move.is-take:hover:not(:disabled) {
  box-shadow: 0 0 0 1px var(--sick);
  color: var(--sick);
  background: rgba(143, 191, 58, 0.12);
}

.strip-move:disabled {
  opacity: 0.3;
  cursor: default;
}

.strip-move kbd {
  color: var(--bone-dim);
  font: inherit;
  font-size: calc(var(--u) * 4.5);
  margin-left: calc(var(--u) * 0.5);
}

@container select (max-width: 420px) {
  .strip {
    --tile-w: calc((100% - var(--gap)) / 2);
    min-height: 0;
  }
}
</style>
