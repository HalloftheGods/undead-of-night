<template>
  <section class="hud">
    <header class="hud-top">
      <div class="hud-chip hud-night">
        <span class="hud-sub">{{ levelLine(hud.level) }}</span>
        <span class="hud-wave" :class="horde.loud ? 'is-threat' : 'is-quiet'">{{ horde.title }}</span>
        <span v-if="horde.detail" class="hud-sub is-threat">{{ horde.detail }}</span>
        <span class="hud-sub" :class="{ 'is-van': hud.exitOpen }">{{ levelGoal(hud) }}</span>
      </div>

      <div v-if="home" class="hud-home">
        <TreasureChip v-if="!home.inBunker" :home />
        <QuestTracker :home />
      </div>

      <!--
        The three numbers a run is read by, in the order they are asked for: am I alive, how
        many have I put down, what is it worth. Health leads, because it is the one that is
        glanced at under fire.
      -->
      <div class="hud-stack">
        <div class="hud-chip hud-health" :class="{ 'is-low': isLow }">
          <SpriteImg :sprite="art.ui.heart" />
          <div class="px-meter hud-health-meter" :style="fill(hud.health, hud.maxHealth)"><span /></div>
          <span class="hud-health-value">{{ Math.ceil(hud.health) }}</span>
        </div>
        <div class="hud-chip hud-kills">
          <SpriteImg :sprite="art.ui.zombieHead" />
          <span>{{ hud.kills }}</span>
        </div>
        <div class="hud-chip hud-score">
          <span>{{ hud.score }}</span>
          <span v-if="mode === 'coop'" class="hud-sub" :class="signalWeak ? 'is-threat' : 'is-good'">
            {{ signalWeak ? 'Signal weak' : 'Linked' }}
          </span>
        </div>
      </div>
    </header>

    <BossBar v-if="hud.boss" :boss="hud.boss" />
    <KeepsakeOffer v-if="hud.keepsakeOffer" :offer="hud.keepsakeOffer" />

    <ul v-if="hud.teammates.length" class="hud-team">
      <li v-for="mate in hud.teammates" :key="mate.id" class="hud-chip hud-mate" :style="{ '--mate': mate.color }">
        <span :class="{ 'is-threat': mate.status !== 'alive' }">{{ mate.name }}</span>
        <span class="hud-sub">{{ mate.character }}</span>
        <span v-if="mate.status !== 'alive'" class="hud-sub is-threat">{{ mate.status }}</span>
        <div v-else class="px-meter hud-team-meter" :style="fill(mate.health, mate.maxHealth)"><span /></div>
      </li>
    </ul>

    <p v-if="place" :key="place.key" class="hud-place">{{ place.label }}</p>

    <footer class="hud-bottom">
      <div class="hud-vitals">
        <ul v-if="hud.sugar.length > 0" class="hud-chip hud-sugar" aria-label="Candy working">
          <li v-for="sugar in hud.sugar" :key="sugar.name">
            <span>{{ sugar.name }}</span>
            <span class="hud-sugar-left">{{ sugar.left }}s</span>
          </li>
        </ul>
        <div class="hud-chip hud-medkits" :class="{ 'is-none': hud.medkits === 0 }">
          <SpriteImg :sprite="art.ui.pickupIcons.medkit" />
          <span>{{ hud.medkits }}</span>
          <span class="hud-slot-key keys-only">H</span>
        </div>
        <div v-if="hud.bottles > 0" class="hud-chip hud-bottles">
          <SpriteImg :sprite="art.ui.bottle" />
          <span>{{ hud.bottles }}</span>
          <span class="hud-slot-key keys-only">G</span>
        </div>
        <div v-if="hud.fireworks > 0" class="hud-chip hud-bottles">
          <SpriteImg :sprite="art.ui.fireworks" />
          <span>{{ hud.fireworks }}</span>
          <span class="hud-slot-key keys-only">T</span>
        </div>
        <div v-if="hud.fountains > 0" class="hud-chip hud-bottles">
          <SpriteImg :sprite="art.ui.fountain" />
          <span>{{ hud.fountains }}</span>
          <span class="hud-slot-key keys-only">V</span>
        </div>
        <div v-if="hud.candyCount > 0" class="hud-chip hud-bottles hud-candy" :title="hud.bag.map((stack) => `${stack.name} x${stack.count}`).join(', ')">
          <span class="hud-candy-icon" aria-hidden="true" />
          <span>Candy {{ hud.candyCount }}</span>
          <span class="hud-slot-key keys-only">X</span>
        </div>
        <div v-if="hud.knife" class="hud-chip hud-knife">
          <SpriteImg :sprite="art.ui.pickupIcons.knife" />
          <span class="hud-slot-key keys-only">F</span>
        </div>
      </div>

      <!-- Centred at every width, and every slot a real tap target that sends its number key. -->
      <div class="hud-chip hud-weapon">
        <ul class="hud-slots">
          <li v-for="slot in bar" :key="slot.weapon">
            <button
              class="hud-slot"
              :class="{ 'is-active': slot.active, 'is-missing': !slot.owned }"
              type="button"
              :aria-label="slot.label"
              :aria-pressed="slot.active"
              @mousedown.stop
              @touchstart.stop
              @click="hold(slot)"
            >
              <span class="hud-slot-key keys-only">{{ slot.key }}</span>
              <SpriteImg :sprite="art.ui.weaponIcons[slot.weapon]" />
              <span v-if="slot.rounds !== null" class="hud-slot-rounds">{{ slot.rounds }}</span>
              <GunFitPips :fit="hud.gear?.fits[slot.weapon]" />
            </button>
          </li>
        </ul>
        <div class="hud-ammo" :class="`is-${ammo}`">
          <span class="hud-ammo-mag">{{ hud.ammo }}</span>
          <span class="hud-ammo-spare">/ {{ hud.reserve }}</span>
        </div>
        <span v-if="effect" class="hud-effect" :class="`is-${effect.effect}`">{{ effect.label }}</span>
        <div v-if="hud.reload > 0" class="px-meter hud-reload" :style="fill(hud.reload, 1)"><span /></div>
        <template v-else-if="ammo === 'empty'">
          <strong class="hud-empty">Empty</strong>
          <span class="hud-sub"><span class="keys-only">F: </span>{{ hud.knife ? 'Shove & Stab' : 'Shove' }}</span>
        </template>
        <span v-else-if="swapKey !== null" class="hud-sub is-threat keys-only">Press {{ swapKey }}</span>
        <span v-else-if="hud.ammo === 0" class="hud-sub is-threat keys-only">Press R</span>
      </div>
    </footer>

    <!-- Right of centre: clear of the numbers above and of the thumb's buttons below. -->
    <EventFeed v-if="log.length" class="hud-feed" :log />
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { ArtBook } from '../art/types.ts';
import type { HomeUi } from '../game/home-hud.ts';
import { ammoState, hordeStatus, switchKey } from '../game/hud-state.ts';
import type { HudState, PlaceBanner } from '../game/hud-state.ts';
import { weaponBar } from '../game/weapon-bar.ts';
import type { BarSlot } from '../game/weapon-bar.ts';
import { useGame } from './use-game.ts';
import { levelGoal, levelLine } from '../game/level-hud.ts';
import type { TransportKind } from '../network/transport.ts';
import { effectOf } from '../../shared/gun-upgrades.ts';
import { GUN_EFFECTS } from '../../shared/round-effect-data.ts';
import BossBar from './BossBar.vue';
import KeepsakeOffer from './KeepsakeOffer.vue';
import EventFeed from './log/EventFeed.vue';
import type { LogEntry } from '../game/event-log.ts';
import GunFitPips from './GunFitPips.vue';
import SpriteImg from './SpriteImg.vue';
import QuestTracker from './QuestTracker.vue';
import TreasureChip from './TreasureChip.vue';

const LOW_HEALTH = 0.34;

interface HudOverlayProps {
  hud: HudState;
  art: ArtBook;
  mode: TransportKind;
  signalWeak: boolean;
  place: PlaceBanner | null;
  home: HomeUi | null;
  log: readonly LogEntry[];
}

const { hud } = defineProps<HudOverlayProps>();
const { input } = useGame();

const isLow = computed(() => hud.health / hud.maxHealth < LOW_HEALTH);
const bar = computed(() => weaponBar(hud));
const ammo = computed(() => ammoState(hud));
const swapKey = computed(() => switchKey(hud));
const horde = computed(() => hordeStatus(hud));
const effect = computed(() => {
  const held = effectOf(hud.gear?.fits[hud.weapon]);
  return held === null ? null : { effect: held, label: GUN_EFFECTS[held].label };
});

function fill(value: number, max: number): Record<string, string> {
  return { '--fill': `${Math.max(0, Math.min(100, (value / max) * 100))}%` };
}

/** A tap on a slot is that number key pressed and let go, which is what the sim answers to. */
function hold(slot: BarSlot): void {
  input.padDown(slot.code);
  input.padUp(slot.code);
}
</script>

<style scoped>
.hud {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: calc(var(--u) * 5);
  pointer-events: none;
}

/* The town on the left, the trip in the middle, the run's numbers on the right. */
.hud-top {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  grid-template-areas: 'night home stack';
  align-items: start;
  gap: calc(var(--u) * 5);
}

.hud-night {
  grid-area: night;
  justify-self: start;
}

.hud-home {
  display: flex;
  flex-direction: column;
  grid-area: home;
  justify-self: center;
  gap: var(--u);
}

/* Health, kills, points: one column down the right edge, each line as wide as it needs. */
.hud-stack {
  display: flex;
  flex-direction: column;
  grid-area: stack;
  justify-self: end;
  align-items: flex-end;
  gap: calc(var(--u) * 2);
}

/* What is carried, bottom left, out of the way of the guns. */
.hud-bottom {
  display: flex;
  align-items: flex-end;
}

/*
 * The guns sit in the middle of the foot of the screen at every width, where the thumb and the
 * eye both expect them. Pinned rather than laid out, so a long vitals column never shoves them.
 */
.hud-weapon {
  position: absolute;
  bottom: calc(var(--u) * 5);
  left: 50%;
  align-items: center;
  transform: translateX(-50%);
}

/* The log reads down the right edge, between the numbers above and the buttons below. */
.hud-feed {
  position: absolute;
  top: 50%;
  right: calc(var(--u) * 5);
  transform: translateY(-50%);
}

/* Fingers: the guns stand on the tab bar across the foot of the screen (--tabbar, touch-ui.css). */
.is-touch .hud-weapon {
  bottom: calc(var(--tabbar) + var(--u) * 3);
}

.hud-chip {
  display: flex;
  flex-direction: column;
  gap: var(--u);
  padding: calc(var(--u) * 2) calc(var(--u) * 4);
  background: rgba(11, 12, 16, 0.78);
}

.hud-wave {
  color: var(--bone);
  font-weight: 700;
}

.hud-wave.is-quiet {
  color: var(--bone-dim);
  font-weight: 400;
}

.hud-place {
  position: absolute;
  top: 14%;
  left: 0;
  right: 0;
  width: fit-content;
  margin: 0 auto;
  padding: var(--u) calc(var(--u) * 5);
  background: rgba(11, 12, 16, 0.78);
  color: var(--bone);
  text-transform: uppercase;
  animation: place-life 2.2s steps(11) both;
}

@keyframes place-life {
  0% { opacity: 0; }
  10% { opacity: 1; }
  80% { opacity: 1; }
  100% { opacity: 0; }
}

.hud-sub {
  color: var(--bone-dim);
}

.is-threat {
  color: var(--blood-bright);
}

.is-good {
  color: var(--sick);
}

.is-van {
  color: var(--amber);
}

.hud-score {
  align-items: flex-end;
  color: var(--amber);
  font-weight: 700;
}

.hud-kills {
  flex-direction: row;
  align-items: center;
  gap: calc(var(--u) * 2);
  font-weight: 700;
}

.hud-team {
  position: absolute;
  left: calc(var(--u) * 5);
  top: calc(var(--u) * 56);
  display: flex;
  flex-direction: column;
  gap: calc(var(--u) * 2);
  list-style: none;
}

/* The same colour marks this teammate on the map. */
.hud-mate {
  border-left: calc(var(--u) * 1.5) solid var(--mate);
}

.hud-team-meter {
  width: calc(var(--u) * 36);
  height: calc(var(--u) * 2);
}

.hud-vitals {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: calc(var(--u) * 2);
}

.hud-medkits,
.hud-bottles,
.hud-knife {
  flex-direction: row;
  align-items: center;
  gap: calc(var(--u) * 2);
}

/* A wrapped sweet: an orange middle with twisted ends, drawn in boxes like the rest of the pixel HUD. */
.hud-candy-icon {
  width: calc(var(--u) * 8);
  height: calc(var(--u) * 4);
  background:
    linear-gradient(var(--candy-wrap, #e8742a), var(--candy-wrap, #e8742a)) center / calc(var(--u) * 4) 100% no-repeat,
    linear-gradient(#f4d36b, #f4d36b) left center / calc(var(--u) * 2) calc(var(--u) * 2) no-repeat,
    linear-gradient(#f4d36b, #f4d36b) right center / calc(var(--u) * 2) calc(var(--u) * 2) no-repeat;
}

.hud-candy span:nth-child(2) {
  font-size: calc(var(--u) * 5);
}

.hud-sugar {
  margin: 0;
  list-style: none;
  color: #f4d36b;
  font-size: calc(var(--u) * 5);
}

.hud-sugar li {
  display: flex;
  justify-content: space-between;
  gap: calc(var(--u) * 4);
}

.hud-sugar-left {
  color: var(--bone);
}

.hud-medkits.is-none {
  color: var(--bone-dim);
}

.hud-medkits.is-none .sprite-img {
  opacity: 0.4;
}

.hud-health {
  flex-direction: row;
  align-items: center;
  gap: calc(var(--u) * 3);
}

.hud-health-meter {
  width: calc(var(--u) * 60);
  height: calc(var(--u) * 4);
}

/* Fixed room for three digits, so the bar beside it does not shuffle on every hit. */
.hud-health-value {
  min-width: calc(var(--u) * 14);
  font-weight: 700;
  text-align: right;
}

.hud-health.is-low .hud-health-value {
  color: var(--blood-bright);
}

.hud-health.is-low .px-meter > span {
  background: var(--blood-bright);
  animation: px-blink 0.6s steps(2) infinite;
}

.hud-weapon {
  align-items: center;
}

.hud-slots {
  display: flex;
  gap: calc(var(--u) * 3);
  list-style: none;
}

.hud-slot {
  display: flex;
  align-items: center;
  gap: var(--u);
  border: 0;
  padding: var(--u);
  background: none;
  color: inherit;
  font: inherit;
  opacity: 0.55;
  /* The rest of the HUD is click-through; only these slots take a press. */
  pointer-events: auto;
  cursor: pointer;
}

.hud-slot.is-active {
  opacity: 1;
  background: var(--ink-line);
}

.hud-slot.is-missing {
  opacity: 0.18;
}

.hud-slot:focus-visible {
  outline: calc(var(--u) * 0.5) solid var(--amber);
  outline-offset: var(--u);
}

/* A finger needs the whole tap target; a mouse does not, and the HUD stays small for it. */
.is-touch .hud-slot {
  justify-content: center;
  min-width: var(--tap, 44px);
  min-height: var(--tap, 44px);
  background: rgba(23, 24, 31, 0.6);
  touch-action: manipulation;
}

.is-touch .hud-slot.is-active {
  background: var(--ink-line);
}

.hud-slot-key {
  color: var(--amber);
}

.hud-slot-rounds {
  color: var(--bone-dim);
}

.hud-effect {
  color: var(--amber);
}

.hud-effect.is-acid {
  color: var(--sick);
}

.hud-effect.is-incendiary {
  color: var(--blood-bright);
}

.hud-effect.is-piercing {
  color: var(--bone);
}

.hud-effect.is-tranq {
  color: var(--bone-dim);
}

.hud-ammo {
  display: flex;
  align-items: baseline;
  gap: calc(var(--u) * 2);
}

.hud-ammo-mag {
  font-size: calc(var(--u) * 12);
  font-weight: 700;
  line-height: 1;
}

.hud-ammo-spare {
  color: var(--bone-dim);
}

.hud-ammo.is-low .hud-ammo-mag,
.hud-ammo.is-low .hud-ammo-spare {
  color: var(--amber);
}

.hud-ammo.is-empty .hud-ammo-mag,
.hud-ammo.is-empty .hud-ammo-spare {
  color: var(--blood-bright);
}

.hud-empty {
  color: var(--blood-bright);
  text-transform: uppercase;
  animation: px-blink 0.8s steps(2) infinite;
}

.hud-reload {
  width: 100%;
  height: calc(var(--u) * 2);
}

.hud-reload > span {
  background: var(--amber);
}
</style>
