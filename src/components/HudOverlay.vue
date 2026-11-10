<template>
  <section class="hud">
    <header class="hud-top">
      <!-- What is carried, across the top left like the item row of a Zelda screen. -->
      <div class="hud-vitals">
        <div class="hud-items">
          <div class="hud-chip hud-medkits" :class="{ 'is-none': hud.medkits === 0 }">
            <kbd v-if="glyph('KeyH')" class="hud-keycap keys-only">{{ glyph('KeyH') }}</kbd>
            <SpriteImg :sprite="art.ui.pickupIcons.medkit" />
            <span>{{ hud.medkits }}</span>
          </div>
          <div v-if="hud.bottles > 0" class="hud-chip hud-bottles">
            <kbd v-if="glyph('KeyG')" class="hud-keycap keys-only">{{ glyph('KeyG') }}</kbd>
            <SpriteImg :sprite="art.ui.bottle" />
            <span>{{ hud.bottles }}</span>
          </div>
          <div v-if="hud.fireworks > 0" class="hud-chip hud-bottles">
            <kbd v-if="glyph('KeyT')" class="hud-keycap keys-only">{{ glyph('KeyT') }}</kbd>
            <SpriteImg :sprite="art.ui.fireworks" />
            <span>{{ hud.fireworks }}</span>
          </div>
          <div v-if="hud.fountains > 0" class="hud-chip hud-bottles">
            <kbd v-if="glyph('KeyV')" class="hud-keycap keys-only">{{ glyph('KeyV') }}</kbd>
            <SpriteImg :sprite="art.ui.fountain" />
            <span>{{ hud.fountains }}</span>
          </div>
          <div v-if="hud.candyCount > 0" class="hud-chip hud-bottles hud-candy" :title="hud.bag.map((stack) => `${stack.name} x${stack.count}`).join(', ')">
            <kbd v-if="glyph('KeyX')" class="hud-keycap keys-only">{{ glyph('KeyX') }}</kbd>
            <span class="hud-candy-icon" aria-hidden="true" />
            <span>Candy {{ hud.candyCount }}</span>
          </div>
          <div v-if="hud.knife" class="hud-chip hud-knife">
            <kbd v-if="glyph('KeyF')" class="hud-keycap keys-only">{{ glyph('KeyF') }}</kbd>
            <SpriteImg :sprite="art.ui.pickupIcons.knife" />
          </div>
        </div>
        <ul v-if="hud.sugar.length > 0" class="hud-chip hud-sugar" aria-label="Candy working">
          <li v-for="sugar in hud.sugar" :key="sugar.name">
            <span>{{ sugar.name }}</span>
            <span class="hud-sugar-left">{{ sugar.left }}s</span>
          </li>
        </ul>
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

      <!-- Survival Moodles (Hunger, Thirst, Bleeding, Infection, Fatigue) -->
      <aside v-if="hasMoodles" class="hud-moodles" aria-label="Survival moodles">
        <div
          v-for="moodle in hud.moodles"
          :key="moodle.id"
          class="hud-moodle-badge"
          :class="`is-${moodle.severity}`"
          :title="`${moodle.label} (${Math.round(moodle.value)}%)`"
        >
          <SpriteImg v-if="art.ui.moodles && art.ui.moodles[moodle.id]" :sprite="art.ui.moodles[moodle.id]" />
          <span class="hud-moodle-text">{{ moodle.label }}</span>
        </div>
      </aside>
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
      <div class="hud-bottom-centre">
        <!-- Horde information and town goals positioned above the weapons for central visibility -->
        <div class="hud-centre">
          <div class="hud-chip hud-night">
            <span class="hud-sub">{{ levelLine(hud.level) }}</span>
            <span class="hud-wave" :class="horde.loud ? 'is-threat' : 'is-quiet'">{{ horde.title }}</span>
            <span v-if="horde.detail" class="hud-sub is-threat">{{ horde.detail }}</span>
            <span class="hud-sub hud-goal" :class="{ 'is-van': hud.exitOpen }">{{ levelGoal(hud) }}</span>
          </div>

          <div v-if="home" class="hud-home">
            <TreasureChip v-if="!home.inBunker" :home />
            <QuestTracker :home />
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
          <span v-else-if="reloadPrompt(hud)" class="hud-sub is-threat keys-only">Press R</span>
        </div>
      </div>
    </footer>

    <!-- Right of centre: clear of the numbers above and of the thumb's buttons below. -->
    <div v-if="log.length" :key="log[log.length - 1].key" class="hud-feed">
      <EventFeed :log />
    </div>

    <!-- A first-run hint: said once, then gone (game/first-run-hints.ts). -->
    <p v-if="hintText" :key="hint?.key" class="hud-hint" role="status">{{ hintText }}</p>

    <!-- A bite from where the player was not looking: a short red bar on that edge. -->
    <span v-if="bite" :key="bite.key" class="hud-bite" :style="biteStyle" aria-hidden="true" />
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { hintText as wordHint } from '../game/first-run-hints.ts';
import { controlDevice, keyGlyph } from '../game/hud-keys.ts';
import type { ArtBook } from '../art/types.ts';
import type { HomeUi } from '../game/home-hud.ts';
import { ammoWarning, hordeStatus, reloadPrompt, switchKey } from '../game/hud-state.ts';
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
const { input, ui } = useGame();

/** Who is playing, read as the HUD repaints (a hud beat lands every 100 ms). */
const device = computed(() => {
  void hud;
  return controlDevice(ui.value.touch, input.lastDevice);
});
const hint = computed(() => ui.value.hint ?? null);
const bite = computed(() => ui.value.bite ?? null);
const hintText = computed(() => (hint.value ? wordHint(hint.value.id, { hordes: hint.value.hordes }, { device: device.value, padId: input.gamepad.id }) : ''));

/** The mark sits on the screen edge in the bite's direction: an ellipse just inside the frame, turned to point out. */
const biteStyle = computed(() => {
  const angle = bite.value?.angle ?? 0;
  const x = 50 + Math.cos(angle) * 49;
  const y = 50 + Math.sin(angle) * 49;
  return { left: `${x}%`, top: `${y}%`, '--turn': `${angle}rad` };
});

function glyph(code: string): string | null {
  return keyGlyph(code, device.value, input.gamepad.id);
}

const isLow = computed(() => hud.health / hud.maxHealth < LOW_HEALTH);
const hasMoodles = computed(() => (hud.moodles?.length ?? 0) > 0);
const bar = computed(() => weaponBar(hud));
const ammo = computed(() => ammoWarning(hud));
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

/*
 * The top bar keeps vitals on the left and run numbers on the right, keeping
 * the upper center completely open for clear gameplay vision.
 */
.hud-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  width: 100%;
  gap: calc(var(--u) * 4);
}

.hud-vitals {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: calc(var(--u) * 2);
  min-width: 0;
  flex: 0 1 auto;
}

/* Health, kills, points: stacked down the right edge */
.hud-stack {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: calc(var(--u) * 2);
  min-width: 0;
  flex: 0 0 auto;
}

/*
 * Bottom foot of the screen: centers the horde info, town goals, and weapon bar.
 */
.hud-bottom {
  display: flex;
  justify-content: center;
  align-items: flex-end;
  width: 100%;
}

.hud-bottom-centre {
  position: absolute;
  bottom: calc(var(--u) * 5);
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: calc(var(--u) * 2);
  max-width: calc(100vw - var(--u) * 10);
  pointer-events: none;
}

.hud-centre {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: calc(var(--u) * 2);
  max-width: 100%;
}

.hud-night {
  align-items: center;
  text-align: center;
}

.hud-home {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--u);
}

.hud-weapon {
  align-items: center;
  pointer-events: auto;
}

/*
 * The run log is docked bottom right, clear of the centred guns, and fades a few seconds after its
 * last line. It is click-through once faded; L (or the tab bar) still opens the full log.
 */
.hud-feed {
  position: absolute;
  right: calc(var(--u) * 5);
  bottom: calc(var(--u) * 5);
  animation: feed-life 6s steps(12) forwards;
}

.is-touch .hud-feed {
  bottom: calc(var(--tabbar) + var(--u) * 3);
  max-width: 30vw;
}

@keyframes feed-life {
  0%, 66% { opacity: 1; }
  100% { opacity: 0; visibility: hidden; }
}

.hud-hint {
  position: absolute;
  top: 24%;
  left: 0;
  right: 0;
  width: fit-content;
  max-width: 90%;
  margin: 0 auto;
  padding: var(--u) calc(var(--u) * 5);
  background: rgba(11, 12, 16, 0.78);
  color: var(--amber);
  text-align: center;
  animation: hint-life 6s steps(12) both;
}

@keyframes hint-life {
  0% { opacity: 0; }
  8% { opacity: 1; }
  88% { opacity: 1; }
  100% { opacity: 0; }
}

/* A short red bar on the screen edge the bite came from. */
.hud-bite {
  position: absolute;
  width: calc(var(--u) * 24);
  height: calc(var(--u) * 4);
  margin: calc(var(--u) * -2) 0 0 calc(var(--u) * -12);
  background: var(--blood-bright);
  transform: translate(-50%, -50%) rotate(calc(var(--turn) + 90deg));
  animation: bite-life 0.7s steps(7) both;
}

@keyframes bite-life {
  0% { opacity: 1; }
  100% { opacity: 0; }
}

/* A phone gives the town and the horde one compact line centered above the weapons */
.is-touch .hud-night {
  flex-direction: row;
  align-items: baseline;
  justify-content: center;
  gap: calc(var(--u) * 2);
  padding: var(--u) calc(var(--u) * 3);
  white-space: nowrap;
}

/* On a phone the item chips lose their key cap (keys-only) and sit tight, so the row stays short. */
.is-touch .hud-items {
  gap: var(--u);
}

.is-touch .hud-night .hud-goal:not(.is-van) {
  display: none;
}

.hud-keycap {
  display: inline-flex;
  justify-content: center;
  align-items: center;
  min-width: calc(var(--u) * 6);
  padding: 0 var(--u);
  border: calc(var(--u) * 0.5) solid var(--amber);
  color: var(--amber);
  font: inherit;
  line-height: 1.1;
  text-align: center;
}

/* Fingers: the bottom cluster stands on the tab bar across the foot of the screen (--tabbar, touch-ui.css). */
.is-touch .hud-bottom-centre {
  bottom: calc(var(--tabbar) + var(--u) * 2);
  max-width: calc(100vw - var(--u) * 4);
  gap: var(--u);
}

.is-touch .hud-stack {
  gap: var(--u);
}

.is-touch .hud-chip {
  padding: var(--u) calc(var(--u) * 2.5);
}

.is-touch .hud-health-meter {
  width: min(calc(var(--u) * 40), 24vw);
}

.is-touch .hud-slots {
  gap: var(--u);
  flex-wrap: wrap;
  justify-content: center;
}

.is-touch .hud-slot {
  min-width: var(--tap, 40px);
  min-height: var(--tap, 40px);
  padding: calc(var(--u) * 0.5);
}

.is-touch .hud-ammo-mag {
  font-size: calc(var(--u) * 9);
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
  top: calc(var(--u) * 72);
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

/* Vertical stack of carried items going down the screen, starting with shortcut keycap */
.hud-items {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: calc(var(--u) * 1.5);
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

.hud-moodles {
  position: absolute;
  right: calc(var(--u) * 5);
  top: calc(var(--u) * 5);
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: calc(var(--u) * 2);
  pointer-events: auto;
}

.hud-moodle-badge {
  display: flex;
  align-items: center;
  gap: calc(var(--u) * 2);
  padding: calc(var(--u) * 1) calc(var(--u) * 2);
  background: rgba(13, 11, 22, 0.85);
  border: calc(var(--u) * 0.5) solid var(--bone-dark, #444);
  image-rendering: pixelated;
}

.hud-moodle-text {
  font-size: calc(var(--u) * 3);
  font-family: inherit;
  font-weight: 700;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

.hud-moodle-badge.is-low {
  border-color: #8c8c56;
  color: #faf2d4;
}

.hud-moodle-badge.is-medium {
  border-color: #e8701c;
  color: #ffc03c;
}

.hud-moodle-badge.is-high {
  border-color: #b82a30;
  color: #e85c40;
}

.hud-moodle-badge.is-critical {
  border-color: #e85c40;
  background: rgba(58, 15, 42, 0.95);
  color: #ffc03c;
}
</style>
