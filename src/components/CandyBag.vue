<template>
  <section class="px-screen px-title-scale bag" aria-label="Candy bag" @mousedown.stop @pointerdown.stop @touchstart.stop>
    <h2 class="px-heading bag-heading">Candy Bag <span class="bag-total">{{ hud.candyCount }}</span></h2>

    <ol v-if="hud.bag.length > 0" class="bag-cards" :style="layout" aria-label="Candy">
      <li v-for="(stack, index) in hud.bag" :key="stack.id">
        <button
          ref="cards"
          type="button"
          class="bag-card px-frame"
          :class="{ 'is-working': stack.left > 0 }"
          :disabled="!canEat"
          :aria-label="`Eat ${stack.name}, ${stack.count} left. ${stack.blurb}`"
          @click="eat(stack.id)"
          @mouseenter="point(stack.id)"
          @mouseleave="pointed = null"
          @focus="pointed = stack.id"
        >
          <span class="bag-head">
            <span class="bag-number" aria-hidden="true">{{ index < PICK_KEYS.length ? PICK_KEYS[index] : '' }}</span>
            <span class="bag-stat">{{ stack.stat }}</span>
            <span class="bag-count">x{{ stack.count }}</span>
          </span>
          <span class="bag-art">
            <img :src="spriteDataUrl(art.ui.candies[stack.id])" alt="" draggable="false" />
            <span v-if="stack.left > 0" class="bag-left">{{ stack.left }}s</span>
            <span class="bag-title" :style="titleStyle(stack)"><span class="bag-brand">{{ stack.name }}</span></span>
          </span>
        </button>
      </li>
    </ol>

    <div class="bag-info" aria-live="polite">
      <template v-if="featured">
        <p class="bag-info-name" :style="brandStyle(featured.id)"><span class="bag-brand">{{ featured.name }}</span></p>
        <p class="bag-info-line">{{ featured.blurb }}</p>
        <p class="bag-info-time" :class="{ 'is-working': featured.left > 0 }">{{ featuredTime }}</p>
      </template>
      <template v-else>
        <p class="bag-info-name">Empty</p>
        <p class="bag-info-line">Search homes, and the candy bowls by every front door.</p>
      </template>
      <p class="px-label bag-info-note">
        {{ waitNote }} <span class="keys-only">Click a candy or press its number to eat it. X to close.</span><span class="touch-only">Tap a candy to eat it.</span>
      </p>
    </div>
    <MenuLink class="bag-close" @press="game.toggleBag()">Close</MenuLink>
  </section>
</template>

<script setup lang="ts">
/**
 * The candy bag, laid out like the Play page and Level Select: no box, every candy carried as a portrait card with
 * its name along the bottom, and the one pointed at told in a few centred lines under them. A click, a tap or its
 * number eats one. In solo the run waits behind it; in co-op the town carries on.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue';
import type { ArtBook } from '../art/types.ts';
import type { CandyId } from '../../shared/protocol.ts';
import { CANDY_SEC } from '../../shared/candy.ts';
import { spriteDataUrl } from '../engine/sprite-cache.ts';
import type { CandyStack } from '../game/candy-bag.ts';
import type { HudState } from '../game/hud-state.ts';
import { brandStyle } from '../game/candy-brands.ts';
import { longestWord } from '../game/setup-picks.ts';
import type { TransportKind } from '../network/transport.ts';
import MenuLink from './MenuLink.vue';
import { useGame } from './use-game.ts';

const PICK_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
/** Most cards to a row: every kind fits two rows of seven on a wide screen, rows of three on a tall one. */
const WIDE_COLUMNS = 7;
const TALL_COLUMNS = 3;

const { hud, art, mode } = defineProps<{ hud: HudState; art: ArtBook; mode: TransportKind }>();

const game = useGame();
const cards = useTemplateRef<HTMLButtonElement[]>('cards');
const pointed = ref<CandyId | null>(null);
const tall = ref(window.innerHeight > window.innerWidth);

const canEat = computed(() => hud.status === 'alive');
const waitNote = computed(() => (mode === 'solo' ? 'Paused.' : 'The town does not wait.'));

/** As many to a row as fit six, and the rows that takes, so the cards size to fill the screen without scrolling. */
const layout = computed(() => {
  const most = tall.value ? TALL_COLUMNS : WIDE_COLUMNS;
  const columns = Math.min(most, Math.max(1, hud.bag.length));
  const rows = Math.ceil(hud.bag.length / columns);
  return { '--columns': columns, '--rows': rows };
});

/** The candy the lines under the cards tell: the one pointed at, else the first in the bag. */
const featured = computed(() => hud.bag.find((stack) => stack.id === pointed.value) ?? hud.bag[0] ?? null);
const featuredTime = computed(() => {
  const stack = featured.value;
  if (!stack) return '';
  const working = stack.left > 0;
  return working ? `Working: ${stack.left}s left. Eat another for more.` : `Lasts about a horde (${CANDY_SEC}s).`;
});

/** A name's custom properties: how long its longest word is, for the fit, and its brand's lettering. */
function titleStyle(stack: CandyStack): Record<string, string | number> {
  return { '--chars': longestWord(stack.name), ...brandStyle(stack.id) };
}

function point(id: CandyId): void {
  game.playUi('hover');
  pointed.value = id;
}

function eat(id: CandyId): void {
  game.playUi('click');
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

function measure(): void {
  tall.value = window.innerHeight > window.innerWidth;
}

onMounted(() => {
  window.addEventListener('keydown', onKey);
  window.addEventListener('resize', measure);
  // A pad or the arrow keys start on the first card.
  void nextTick(() => cards.value?.[0]?.focus({ preventScroll: true }));
});
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey);
  window.removeEventListener('resize', measure);
});
</script>

<style scoped>
.bag {
  gap: calc(var(--u) * 5);
  background: rgba(7, 8, 12, 0.88);
  pointer-events: auto;
}

.bag-heading {
  display: flex;
  align-items: center;
  gap: calc(var(--u) * 4);
  margin: 0;
}

.bag-total {
  padding: 0 calc(var(--u) * 2);
  background: var(--amber);
  color: var(--ink);
  font-size: 0.5em;
  line-height: 1.4;
}

/* Up to six to a row, as big as the screen allows with the heading above and the lines and Close below. */
.bag-cards {
  --card: min(
    calc(var(--u) * 72),
    calc((100vw - var(--u) * 24) / var(--columns) - var(--u) * 4),
    calc(((100vh - var(--u) * 120) / var(--rows) - var(--u) * 14) * 0.78)
  );
  display: grid;
  grid-template-columns: repeat(var(--columns), var(--card));
  justify-content: center;
  gap: calc(var(--u) * 4);
  margin: 0;
  padding: 0;
  list-style: none;
}

.bag-card {
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

.bag-card:hover,
.bag-card:focus-visible {
  --edge: var(--amber);
}

.bag-card:disabled {
  cursor: default;
  opacity: 0.5;
}

.bag-head {
  display: flex;
  align-items: center;
  gap: calc(var(--u) * 1.5);
  min-width: 0;
  color: var(--bone-dim);
  font-size: calc(var(--u) * 3.5);
  white-space: nowrap;
}

.bag-number {
  display: grid;
  flex: none;
  place-items: center;
  width: calc(var(--u) * 6);
  height: calc(var(--u) * 6);
  background: var(--amber);
  color: var(--ink);
  font-weight: 700;
}

.bag-number:empty {
  background: var(--ink-line);
}

.bag-stat {
  overflow: hidden;
  text-overflow: ellipsis;
}

.bag-count {
  margin-left: auto;
  color: var(--bone);
}

/* The candy big in a dark frame, lit from below like a porch at night. */
.bag-art {
  position: relative;
  display: grid;
  place-items: start center;
  aspect-ratio: 56 / 72;
  overflow: hidden;
  background: radial-gradient(ellipse at 50% 45%, rgba(232, 163, 61, 0.18), transparent 65%), var(--ink);
}

.bag-art img {
  width: 76%;
  margin-top: 12%;
  image-rendering: pixelated;
}

.is-working .bag-art {
  background: radial-gradient(ellipse at 50% 45%, rgba(143, 191, 58, 0.22), transparent 65%), var(--ink);
}

.bag-left {
  position: absolute;
  top: calc(var(--u) * 1.5);
  right: calc(var(--u) * 1.5);
  padding: 0 var(--u);
  background: var(--sick);
  color: var(--ink);
  font-size: calc(var(--u) * 3.5);
}

/* The candy's name along the bottom of its picture, lettered like the logo on its wrapper (game/candy-brands.ts). */
.bag-title {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: calc(var(--u) * 6) var(--u) calc(var(--u) * 2.5);
  background: linear-gradient(to top, rgba(7, 8, 12, 0.92) 0%, rgba(7, 8, 12, 0.55) 60%, transparent 100%);
  font-size: min(clamp(calc(var(--u) * 4), 11cqi, calc(var(--u) * 10)), calc(88cqi / (var(--chars) * 1.35)));
  line-height: 1.4;
  text-align: center;
  text-wrap: balance;
}

/* A one-pixel edge all round, then a drop: each brand's own colours. */
.bag-brand {
  --px: max(1px, calc(var(--u) * 0.5));
  display: inline-block;
  color: var(--brand-fill, var(--bone));
  font-weight: 700;
  letter-spacing: var(--brand-spread, 0.1em);
  text-indent: var(--brand-spread, 0.1em);
  text-shadow:
    var(--px) 0 0 var(--brand-edge, var(--ink)),
    calc(var(--px) * -1) 0 0 var(--brand-edge, var(--ink)),
    0 var(--px) 0 var(--brand-edge, var(--ink)),
    0 calc(var(--px) * -1) 0 var(--brand-edge, var(--ink)),
    var(--px) var(--px) 0 var(--brand-edge, var(--ink)),
    calc(var(--px) * -1) var(--px) 0 var(--brand-edge, var(--ink)),
    var(--px) calc(var(--px) * -1) 0 var(--brand-edge, var(--ink)),
    calc(var(--px) * -1) calc(var(--px) * -1) 0 var(--brand-edge, var(--ink)),
    0 calc(var(--px) * 2.5) 0 var(--brand-drop, var(--ink));
  transform: rotate(var(--brand-turn, 0deg)) skewX(var(--brand-lean, 0deg));
}

.bag-card:hover .bag-brand,
.bag-card:focus-visible .bag-brand {
  transform: rotate(var(--brand-turn, 0deg)) skewX(var(--brand-lean, 0deg)) scale(1.06);
}

/* The pointed-at candy, told in a few centred lines. */
.bag-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: calc(var(--u) * 2);
  text-align: center;
}

.bag-info p {
  margin: 0;
}

.bag-info-name {
  font-size: calc(var(--u) * 9);
  text-transform: uppercase;
}

/* What it does, plain and big enough to read at a glance: no spread letters, on a dark band. */
.bag-info-line {
  padding: calc(var(--u) * 1.5) calc(var(--u) * 4);
  background: rgba(7, 8, 12, 0.9);
  color: var(--bone);
  font-size: calc(var(--u) * 8);
  letter-spacing: 0.03em;
  line-height: 1.35;
  text-transform: none;
}

.bag-info-time {
  color: var(--bone);
  font-size: calc(var(--u) * 6);
  letter-spacing: 0.03em;
  text-transform: none;
}

.bag-info-time.is-working {
  color: var(--sick);
}

.bag-info-note {
  color: var(--bone-dim);
}

/* A phone on its side: the lines under the cards shrink to make room. */
@media (max-height: 520px) {
  .bag {
    gap: calc(var(--u) * 2);
    padding: calc(var(--u) * 2);
  }

  .bag-cards {
    --card: min(
      calc(var(--u) * 72),
      calc((100vw - var(--u) * 16) / var(--columns) - var(--u) * 3),
      calc(((100vh - var(--u) * 80) / var(--rows) - var(--u) * 12) * 0.78)
    );
    gap: calc(var(--u) * 2);
  }

  .bag-info {
    gap: var(--u);
  }

  .bag-info-name {
    font-size: calc(var(--u) * 6);
  }

  .bag-info-line {
    padding: var(--u) calc(var(--u) * 3);
    font-size: calc(var(--u) * 7);
  }

  .bag-info-time {
    display: none;
  }
}
</style>
