<template>
  <section class="px-screen bag" aria-label="Candy bag" @mousedown.stop @pointerdown.stop @touchstart.stop>
    <header class="bag-head">
      <SpriteImg :sprite="art.ui.candy" :scale="3" />
      <h2 class="bag-title">Candy bag</h2>
      <span class="bag-total">{{ hud.candyCount }}</span>
    </header>

    <ul v-if="hud.bag.length > 0" class="bag-grid">
      <li v-for="(stack, index) in hud.bag" :key="stack.id">
        <button
          ref="cards"
          type="button"
          class="bag-card px-frame"
          :class="{ 'is-working': stack.left > 0 }"
          :disabled="!canEat"
          :aria-label="`Eat ${stack.name}, ${stack.count} left. ${stack.blurb}`"
          @click="eat(stack.id)"
        >
          <span v-if="index < PICK_KEYS.length" class="bag-key keys-only">{{ PICK_KEYS[index] }}</span>
          <span class="bag-art"><SpriteImg :sprite="art.ui.candies[stack.id]" :scale="4" /></span>
          <span class="bag-count">x{{ stack.count }}</span>
          <strong class="bag-name">{{ stack.name }}</strong>
          <span class="bag-stat">{{ stack.stat }}</span>
          <span class="bag-blurb">{{ stack.blurb }}</span>
          <span v-if="stack.left > 0" class="bag-left">{{ stack.left }}s left. Eat another for more.</span>
        </button>
      </li>
    </ul>
    <p v-else class="px-note bag-empty">Your bag is empty. Search homes, and the candy bowls by every front door.</p>

    <ul v-if="working.length > 0" class="bag-working" aria-label="Candy working">
      <li v-for="sugar in working" :key="sugar.id">
        <SpriteImg :sprite="art.ui.candies[sugar.id]" :scale="2" />
        <span>{{ sugar.name }}</span>
        <span class="bag-working-left">{{ sugar.left }}s</span>
      </li>
    </ul>

    <p class="px-note">
      {{ waitNote }} Eating a candy that is already working adds its time.
      <span class="keys-only">Click one or press its number. X to close.</span>
    </p>
    <MenuLink class="touch-only bag-close" @press="game.toggleBag()">Close</MenuLink>
  </section>
</template>

<script setup lang="ts">
/**
 * The candy bag: every candy carried, with its picture, how many and what it does. A click, a tap
 * or its number eats one. In solo the run waits behind it; in co-op the town carries on.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, useTemplateRef } from 'vue';
import type { ArtBook } from '../art/types.ts';
import type { CandyId } from '../../shared/protocol.ts';
import type { HudState } from '../game/hud-state.ts';
import type { TransportKind } from '../network/transport.ts';
import MenuLink from './MenuLink.vue';
import SpriteImg from './SpriteImg.vue';
import { useGame } from './use-game.ts';

const PICK_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

const { hud, art, mode } = defineProps<{ hud: HudState; art: ArtBook; mode: TransportKind }>();

const game = useGame();
const cards = useTemplateRef<HTMLButtonElement[]>('cards');

const canEat = computed(() => hud.status === 'alive');
const waitNote = computed(() => (mode === 'solo' ? 'Paused.' : 'The town does not wait.'));
/** Boosts working whose candy is not in the bag any more: the cards already show the rest. */
const working = computed(() => hud.sugar.filter((sugar) => !hud.bag.some((stack) => stack.id === sugar.id)));

function eat(id: CandyId): void {
  game.eatCandy(id);
}

/** 1 to 9 eat the candy on that card, so a hand need not leave the keys. */
function onKey(event: KeyboardEvent): void {
  const index = PICK_KEYS.indexOf(event.key);
  const stack = hud.bag[index];
  const isPick = stack !== undefined && !event.repeat;
  if (!isPick) return;
  event.preventDefault();
  eat(stack.id);
}

onMounted(() => {
  window.addEventListener('keydown', onKey);
  // A pad or the arrow keys start on the first card.
  void nextTick(() => cards.value?.[0]?.focus({ preventScroll: true }));
});
onBeforeUnmount(() => window.removeEventListener('keydown', onKey));
</script>

<style scoped>
.bag {
  justify-content: flex-start;
  overflow-y: auto;
  background: rgba(7, 8, 12, 0.92);
  pointer-events: auto;
}

.bag-head {
  display: flex;
  align-items: center;
  gap: calc(var(--u) * 4);
}

.bag-title {
  font-size: calc(var(--u) * 10);
  line-height: 1;
  color: #f4d36b;
}

.bag-total {
  padding: 0 calc(var(--u) * 2);
  border: calc(var(--u) * 0.5) solid var(--bone-dim);
  color: var(--bone);
  font-size: calc(var(--u) * 6);
}

.bag-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(calc(var(--u) * 64), 1fr));
  gap: calc(var(--u) * 4);
  width: min(100%, calc(var(--u) * 340));
  margin: 0;
  padding: var(--u);
  list-style: none;
}

.bag-card {
  position: relative;
  display: grid;
  justify-items: center;
  gap: calc(var(--u) * 1.5);
  width: 100%;
  height: 100%;
  padding: calc(var(--u) * 4) calc(var(--u) * 3);
  background: var(--ink-raised);
  border: none;
  color: var(--bone);
  font: inherit;
  text-align: center;
  cursor: pointer;
}

.bag-card:hover,
.bag-card:focus-visible {
  --edge: #f4d36b;
  background: rgba(244, 211, 107, 0.14);
  outline: none;
}

.bag-card:disabled {
  opacity: 0.5;
  cursor: default;
}

.bag-card.is-working {
  --edge: var(--sick);
}

.bag-key {
  position: absolute;
  top: calc(var(--u) * 2);
  left: calc(var(--u) * 2);
  padding: 0 var(--u);
  border: calc(var(--u) * 0.5) solid currentColor;
  color: #f4d36b;
  font-size: calc(var(--u) * 4);
}

.bag-count {
  position: absolute;
  top: calc(var(--u) * 2);
  right: calc(var(--u) * 3);
  color: var(--bone);
  font-size: calc(var(--u) * 6);
}

.bag-name {
  color: #f4d36b;
  font-size: calc(var(--u) * 5);
}

.bag-stat {
  padding: 0 calc(var(--u) * 1.5);
  background: rgba(244, 211, 107, 0.16);
  color: #f4d36b;
  font-size: calc(var(--u) * 4);
  letter-spacing: 0.05em;
}

.bag-blurb {
  color: var(--bone-dim);
  font-size: calc(var(--u) * 4);
  line-height: 1.3;
}

.bag-left {
  color: var(--sick);
  font-size: calc(var(--u) * 4);
}

.bag-working {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: calc(var(--u) * 4);
  margin: 0;
  padding: 0;
  list-style: none;
  color: var(--sick);
  font-size: calc(var(--u) * 5);
}

.bag-working li {
  display: flex;
  align-items: center;
  gap: calc(var(--u) * 2);
}

.bag-close {
  margin-top: calc(var(--u) * 2);
}
</style>
