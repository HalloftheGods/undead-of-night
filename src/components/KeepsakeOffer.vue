<template>
  <section class="keepsake-offer" aria-label="Choose a keepsake" @mousedown.stop @pointerdown.stop @touchstart.stop>
    <p class="keepsake-offer-title">Choose a keepsake</p>
    <p class="keepsake-offer-deck">Yours for the rest of the run.</p>
    <ul class="keepsake-offer-cards">
      <li v-for="(card, index) in offer" :key="card.id">
        <button type="button" class="keepsake-card" @click="pick(card.id)">
          <span v-if="!keys.readPadInCharge()" class="keepsake-card-key keys-only">{{ formatKeyCode(keepsakeCodes[index] ?? '') }}</span>
          <strong class="keepsake-card-name">{{ card.name }}</strong>
          <span class="keepsake-card-blurb">{{ card.blurb }}</span>
        </button>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
/** The three keepsakes on offer after every second town: a click, a tap or J, K, L takes one. */
import { onBeforeUnmount, onMounted } from 'vue';
import type { KeepsakeId } from '../../shared/protocol.ts';
import type { KeepsakeCard } from '../game/hud-state.ts';
import { useGame } from './use-game.ts';
import { useKeyLabels } from './use-key-labels.ts';
import { formatKeyCode, loadKeyBindings } from '../game/controls-prefs.ts';

interface OfferProps {
  offer: readonly KeepsakeCard[];
}

const { offer } = defineProps<OfferProps>();
const game = useGame();

const keys = useKeyLabels();
/** The three keys that take the first, second and third card, from the controls page. */
const keepsakeCodes = loadKeyBindings().keepsake;

function pick(id: KeepsakeId): void {
  game.input.pickKeepsake(id);
}

function onKey(event: KeyboardEvent): void {
  const card = offer[keepsakeCodes.indexOf(event.code)];
  if (!card) return;
  event.preventDefault();
  pick(card.id);
}

onMounted(() => window.addEventListener('keydown', onKey));
onBeforeUnmount(() => window.removeEventListener('keydown', onKey));
</script>

<style scoped>
.keepsake-offer {
  position: absolute;
  top: 18%;
  left: 50%;
  transform: translateX(-50%);
  width: min(92vw, calc(var(--u) * 260));
  padding: calc(var(--u) * 5);
  background: rgba(11, 12, 16, 0.9);
  border: calc(var(--u) * 1) solid #f4d36b;
  pointer-events: auto;
  text-align: center;
}

.keepsake-offer-title {
  margin: 0;
  color: #f4d36b;
  font-size: calc(var(--u) * 9);
  text-transform: uppercase;
}

.keepsake-offer-deck {
  margin: calc(var(--u) * 1) 0 calc(var(--u) * 4);
  color: var(--bone-dim);
  font-size: calc(var(--u) * 5);
}

.keepsake-offer-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(calc(var(--u) * 70), 1fr));
  gap: calc(var(--u) * 3);
  margin: 0;
  padding: 0;
  list-style: none;
}

.keepsake-card {
  display: grid;
  gap: calc(var(--u) * 2);
  width: 100%;
  height: 100%;
  padding: calc(var(--u) * 4);
  background: rgba(244, 211, 107, 0.08);
  border: calc(var(--u) * 1) solid var(--bone-dim);
  color: var(--bone);
  font: inherit;
  cursor: pointer;
}

.keepsake-card:hover,
.keepsake-card:focus-visible {
  border-color: #f4d36b;
  background: rgba(244, 211, 107, 0.18);
}

.keepsake-card-key {
  justify-self: center;
  padding: 0 calc(var(--u) * 2);
  border: calc(var(--u) * 0.5) solid currentColor;
  color: #f4d36b;
  font-size: calc(var(--u) * 5);
}

.keepsake-card-name {
  font-size: calc(var(--u) * 6);
  color: #f4d36b;
}

.keepsake-card-blurb {
  font-size: calc(var(--u) * 5);
  line-height: 1.3;
}
</style>
