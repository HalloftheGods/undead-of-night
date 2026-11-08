<template>
  <div class="backpack-wheel" @mousedown.stop @contextmenu.prevent @click.self="$emit('close')">
    <div class="backpack-items" :style="{ '--item-count': visibleItems.length }">
      <button
        v-for="(item, index) in visibleItems"
        :key="item.code"
        class="backpack-item"
        :class="{ 'is-hovered': hovered === item.code, 'is-disabled': !item.ready }"
        :style="{ '--angle': `${itemAngle(index)}deg` }"
        type="button"
        :aria-label="item.label"
        :disabled="!item.ready"
        @pointerenter="hovered = item.code"
        @pointerleave="hovered = null"
        @click="pick(item)"
      >
        <span v-if="item.icon === 'candy'" class="backpack-candy" aria-hidden="true" />
        <SpriteImg v-else-if="item.sprite" :sprite="item.sprite" :scale="2" />
        <svg
          v-else-if="item.glyph"
          class="backpack-glyph"
          :viewBox="`0 0 ${item.glyph[0].length} ${item.glyph.length}`"
          aria-hidden="true"
          shape-rendering="crispEdges"
        >
          <path :d="glyphPath(item.glyph)" fill="currentColor" />
        </svg>
        <span v-if="item.count !== undefined" class="backpack-count">{{ item.count }}</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { ArtBook, PixelSprite } from '../art/types.ts';
import type { HudState } from '../game/hud-state.ts';
import { glyphPath } from '../game/touch-pad.ts';
import type { PadGlyph } from '../game/touch-pad.ts';
import SpriteImg from './SpriteImg.vue';

/** A round arrow, as on every reload since there were reloads. */
const WEAPON_GLYPH: PadGlyph = [
  '.......#...',
  '.......##..',
  '..########.',
  '.......##..',
  '.......#...',
  '...........',
  '...#.......',
  '..##.......',
  '.########..',
  '..##.......',
  '...#.......',
];

const HEAL_GLYPH: PadGlyph = [
  '...........',
  '....###....',
  '....###....',
  '....###....',
  '.#########.',
  '.#########.',
  '.#########.',
  '....###....',
  '....###....',
  '....###....',
  '...........',
];

const MAP_GLYPH: PadGlyph = [
  '...........',
  '###########',
  '#..#...#..#',
  '#..##.##..#',
  '#..#.#.#..#',
  '#..##.##..#',
  '#..#...#..#',
  '#..#...#..#',
  '#..#...#..#',
  '###########',
  '...........',
];

interface WheelItem {
  code: string;
  label: string;
  glyph?: PadGlyph;
  sprite?: PixelSprite;
  icon?: 'candy';
  count?: number;
  ready: boolean;
}

const props = defineProps<{ hud: HudState; art: ArtBook }>();
const emit = defineEmits<{ close: []; action: [code: string] }>();

const hovered = ref<string | null>(null);

const visibleItems = computed<WheelItem[]>(() => {
  const items: WheelItem[] = [];

  // Always show these core items
  items.push({ code: 'KeyH', label: 'Heal', glyph: HEAL_GLYPH, ready: true });
  items.push({ code: 'KeyQ', label: 'Switch Weapon', glyph: WEAPON_GLYPH, ready: true });
  items.push({ code: 'KeyN', label: 'Map', glyph: MAP_GLYPH, ready: true });

  // Conditional items based on inventory
  const { bottles, fireworks, flares, candy } = props.hud;
  const hasBottle = bottles > 0;

  if (hasBottle) {
    items.push({ code: 'KeyG', label: 'Throw Bottle', sprite: props.art.ui.bottle, count: bottles, ready: true });
  }
  if (fireworks > 0) {
    items.push({ code: 'KeyT', label: 'Firework', sprite: props.art.ui.fireworks, count: fireworks, ready: true });
  }
  if (flares > 0) {
    items.push({ code: 'KeyV', label: 'Flare', sprite: props.art.ui.flare, count: flares, ready: true });
  }
  if (candy.length > 0) {
    items.push({ code: 'KeyX', label: 'Eat Candy', icon: 'candy', count: candy.length, ready: true });
  }

  return items;
});

/** Distributes items evenly around the wheel starting from the top. */
function itemAngle(index: number): number {
  const count = visibleItems.value.length;
  const step = 360 / count;
  return index * step - 90; // Start from top (-90 degrees)
}

function pick(item: WheelItem): void {
  if (!item.ready) return;
  emit('action', item.code);
}
</script>

<style scoped>
.backpack-wheel {
  position: fixed;
  inset: 0;
  z-index: 25;
  background: rgba(0, 0, 0, 0.4);
}

.backpack-items {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
}

.backpack-item {
  display: grid;
  place-items: center;
  position: absolute;
  width: calc(var(--u) * 22);
  height: calc(var(--u) * 22);
  margin: calc(var(--u) * -11);
  border: 0;
  border-radius: 50%;
  padding: 0;
  background: rgba(23, 24, 31, 0.9);
  color: var(--bone);
  cursor: pointer;
  transform: rotate(var(--angle)) translateX(calc(var(--u) * 38)) rotate(calc(var(--angle) * -1));
  transition: background 0.15s, transform 0.15s;
}

.backpack-item.is-hovered {
  background: var(--amber);
  color: var(--ink);
  transform: rotate(var(--angle)) translateX(calc(var(--u) * 38)) rotate(calc(var(--angle) * -1)) scale(1.1);
}

.backpack-item.is-disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.backpack-glyph {
  display: block;
  width: 22px;
  height: 22px;
}

.backpack-count {
  position: absolute;
  right: 2px;
  bottom: 2px;
  font-size: 10px;
  font-weight: bold;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
}

.backpack-candy {
  width: 24px;
  height: 12px;
  background:
    linear-gradient(#e8742a, #e8742a) center / 12px 100% no-repeat,
    linear-gradient(#f4d36b, #f4d36b) left center / 6px 6px no-repeat,
    linear-gradient(#f4d36b, #f4d36b) right center / 6px 6px no-repeat;
}
</style>
