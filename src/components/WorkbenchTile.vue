<template>
  <li class="work">
    <PixelButton
      class="work-tile"
      :class="{ 'is-fitted': fitted }"
      :disabled
      :aria-label="aria"
      @press="emit('fit')"
      @mouseenter="emit('peek')"
      @focus="emit('peek')"
      @mouseleave="emit('unpeek')"
      @blur="emit('unpeek')"
    >
      <span class="work-art">
        <SpriteImg v-for="(each, index) in sprites" :key="index" :sprite="each" />
      </span>
      <span v-if="pips" class="work-pips">
        <span v-for="n in pips.of" :key="n" class="work-pip" :class="{ 'is-on': n <= pips.on }" />
      </span>
      <strong v-else class="work-count" :class="{ 'is-none': count === 0 }">x{{ count }}</strong>
      <span class="work-name">{{ label }}</span>
      <span v-if="sub" class="work-sub" :class="`is-${tone}`">{{ sub }}</span>
    </PixelButton>
    <span class="work-moves">
      <PixelButton
        v-for="target in moves"
        :key="target"
        class="work-move"
        :aria-label="`Move ${label} to ${WEAPONS[target].label}`"
        :title="`Move to ${WEAPONS[target].label}`"
        @press="emit('move', target)"
      >
        <span aria-hidden="true">&gt;</span>
        <SpriteImg :sprite="weaponIcons[target]" />
      </PixelButton>
    </span>
  </li>
</template>

<script setup lang="ts">
/**
 * One framed tile on the bench, in the shelf's tile language: the in-game icons of what it takes, its ranks
 * (or the count carried), its name, and under the frame a fixed foot for the guns a toolkit could carry it to.
 * Pressing the tile fits it to the gun in focus; pointing at it, or tabbing to it, tells the screen so it can
 * say what the tile does.
 */
import { WEAPONS } from '../../shared/constants.ts';
import type { WeaponId } from '../../shared/protocol.ts';
import type { PixelSprite, UiArt } from '../art/types.ts';
import PixelButton from './PixelButton.vue';
import SpriteImg from './SpriteImg.vue';

interface TileProps {
  sprites: readonly PixelSprite[];
  label: string;
  aria: string;
  /** Ranks fitted out of the most, for an upgrade; null for a kit, which shows its count instead. */
  pips?: { on: number; of: number } | null;
  count?: number;
  /** A line under the name that is on the tile for a touch screen too: what it costs, or why it cannot be fitted. */
  sub?: string;
  tone?: 'cost' | 'blocked' | 'done';
  disabled: boolean;
  /** On the gun in focus already. */
  fitted: boolean;
  moves: readonly WeaponId[];
  weaponIcons: UiArt['weaponIcons'];
}

const { sprites, label, aria, pips = null, count = 0, sub = '', tone = 'cost', disabled, fitted, moves, weaponIcons } = defineProps<TileProps>();
const emit = defineEmits<{ fit: []; move: [to: WeaponId]; peek: []; unpeek: [] }>();
</script>

<style scoped>
.work {
  display: flex;
  flex-direction: column;
  gap: var(--u);
  min-width: 0;
}

.work-tile.px-button {
  --edge: var(--ink-line);
  display: grid;
  grid-template-columns: 1fr auto;
  grid-template-areas: 'art mark' 'name name' 'sub sub';
  align-items: center;
  gap: var(--u) calc(var(--u) * 2);
  padding: calc(var(--u) * 2) calc(var(--u) * 3);
  background: var(--ink-raised);
  color: var(--bone-dim);
  font-weight: 400;
}

.work-tile.px-button:hover:not(:disabled),
.work-tile.px-button:focus-visible {
  --edge: var(--bone-dim);
  background: var(--ink-raised);
  color: var(--bone);
}

.work-tile.px-button.is-fitted {
  --edge: var(--amber);
  background: rgba(232, 163, 61, 0.14);
  color: var(--amber);
}

.work-tile.px-button:disabled {
  color: var(--bone-dim);
}

.work-tile:disabled .work-art {
  opacity: 0.45;
}

/* Two part icons at most; the box is always as tall as one, so a tile never changes height. */
.work-art {
  --sprite-px: max(var(--dpx, 1px), round(nearest, var(--u), var(--dpx, 1px)));
  grid-area: art;
  display: flex;
  gap: var(--u);
  min-height: calc(var(--sprite-px) * 15);
}

.work-pips {
  grid-area: mark;
  display: flex;
  gap: var(--u);
}

.work-pip {
  width: calc(var(--u) * 4);
  height: calc(var(--u) * 5);
  background: var(--ink-line);
}

.work-pip.is-on {
  background: var(--amber);
}

.work-count {
  grid-area: mark;
  color: var(--amber);
  font-size: calc(var(--u) * 8);
}

.work-count.is-none {
  opacity: 0.4;
}

.work-sub {
  grid-area: sub;
  overflow: hidden;
  color: var(--bone-dim);
  font-size: calc(var(--u) * 5);
  text-align: left;
  text-overflow: ellipsis;
  text-transform: uppercase;
  white-space: nowrap;
}

.work-sub.is-blocked {
  color: var(--blood-bright);
}

.work-sub.is-done {
  color: var(--amber);
}

.work-name {
  grid-area: name;
  overflow: hidden;
  font-size: calc(var(--u) * 6);
  text-align: left;
  text-overflow: ellipsis;
  text-transform: uppercase;
  white-space: nowrap;
}

/* Room for two guns to carry it to is always kept, so a toolkit coming or going moves nothing. */
.work-moves {
  display: flex;
  gap: var(--u);
  height: calc(var(--u) * 11);
}

.work-move.px-button {
  --edge: var(--ink-line);
  --sprite-px: max(var(--dpx, 1px), round(down, calc(var(--u) * 0.67), var(--dpx, 1px)));
  display: flex;
  align-items: center;
  gap: var(--u);
  width: auto;
  padding: var(--u) calc(var(--u) * 2);
  font-size: calc(var(--u) * 6);
}
</style>
