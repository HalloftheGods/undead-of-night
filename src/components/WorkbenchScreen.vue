<template>
  <section class="px-screen">
    <div class="px-panel px-frame bench" :style="{ '--card-w': CARD_W }">
      <SceneCard :sprite="art.ui.stations.bench" name="Workbench" :line="benchNote(bench)">
        <WorkbenchStats v-if="alive && shown" :weapon="shown" :gear :icons="art.ui" :trial="trialUpgrade" />
        <p v-else-if="!alive" class="px-note bench-left">Left behind. You rejoin in the next town with a pistol.</p>
      </SceneCard>
      <template v-if="alive && focused">
        <div class="bench-strip">
          <div class="bench-col">
            <h3 class="bench-label"><b class="bench-step">1</b>Pick a gun</h3>
            <WorkbenchGuns ref="guns" :owned="hud.owned" :chosen :gear :icons="art.ui.weaponIcons" @choose="choose" @preview="preview" />
          </div>
          <div class="bench-col bench-col-parts">
            <h3 class="bench-label">Parts you carry</h3>
            <WorkbenchParts :parts="gear.parts" :icons="art.ui.pickupIcons" />
          </div>
        </div>
        <h3 class="bench-label">
          <b class="bench-step">2</b>Fit upgrades to the {{ WEAPONS[focused].label }}
          <span class="bench-label-aside">{{ free }} of {{ GUN_SLOTS[focused] }} slots free</span>
        </h3>
        <WorkbenchGun :weapon="focused" :owned="hud.owned" :gear :art @peek="peekUpgrade" />
        <h3 class="bench-label">Special rounds<span class="bench-label-aside">one kit per gun</span></h3>
        <WorkbenchEffect :key="focused" :weapon="focused" :owned="hud.owned" :gear :art @peek="peekEffect" />
      </template>
      <footer class="bench-foot">
        <p class="px-note bench-wait" role="status" aria-live="polite">{{ note }}</p>
        <template v-if="alive">
          <PixelButton v-if="bench.walkUp" class="bench-act" primary @press="game.home.closeStation()">Close</PixelButton>
          <PixelButton v-else class="bench-act" :primary="!bench.youReady" @press="toggleReady">{{ bench.youReady ? 'Not ready yet' : 'Ready' }}</PixelButton>
        </template>
      </footer>
    </div>
  </section>
</template>

<script setup lang="ts">
/**
 * The workbench, laid out like the survivor select: the bench's framed scene and the gun in focus beside it
 * (its bars, slots and rounds), over the guns in hand to pick from, the parts carried, and the upgrade and
 * kit tiles that work on the picked gun. Pointing at a gun previews it; the tiles always work the picked one.
 */
import { computed, onMounted, onUnmounted, ref, useTemplateRef, watch } from 'vue';
import { WEAPONS } from '../../shared/constants.ts';
import { GUN_SLOTS } from '../../shared/gun-upgrade-data.ts';
import type { GunUpgrade } from '../../shared/gun-upgrade-data.ts';
import { effectOf, slotsUsed } from '../../shared/gun-upgrades.ts';
import type { WeaponId } from '../../shared/protocol.ts';
import { GUN_EFFECTS } from '../../shared/round-effect-data.ts';
import type { GunEffect } from '../../shared/round-effect-data.ts';
import { CARD_W } from '../art/difficulty-card.ts';
import type { ArtBook } from '../art/types.ts';
import { effectHint, effectView } from '../game/bench-effects.ts';
import type { EffectOption } from '../game/bench-effects.ts';
import { benchHint, benchNote, benchRows, hasWorkLeft, NO_GEAR, slotsFree, upgradeHint } from '../game/bench-view.ts';
import type { BenchHud, BenchRow } from '../game/bench-view.ts';
import type { HudState } from '../game/hud-state.ts';
import PixelButton from './PixelButton.vue';
import SceneCard from './SceneCard.vue';
import { useGame } from './use-game.ts';
import WorkbenchEffect from './WorkbenchEffect.vue';
import WorkbenchGun from './WorkbenchGun.vue';
import WorkbenchGuns from './WorkbenchGuns.vue';
import WorkbenchParts from './WorkbenchParts.vue';
import WorkbenchStats from './WorkbenchStats.vue';

const { hud, bench, art } = defineProps<{ hud: HudState; bench: BenchHud; art: ArtBook }>();
const game = useGame();
const guns = useTemplateRef<InstanceType<typeof WorkbenchGuns>>('guns');

const gear = computed(() => hud.gear ?? NO_GEAR);
const alive = computed(() => hud.status === 'alive');
const waiting = computed(() => {
  const timer = bench.secondsLeft === null ? '' : `The van leaves in ${bench.secondsLeft}s. `;
  const others = bench.youReady && bench.waitingFor > 0 ? `Waiting for ${bench.waitingFor}.` : '';
  return `${timer}${others}`.trim();
});

const picked = ref<WeaponId | null>(null);
const previewed = ref<number | null>(null);
/** The pick stays on its gun while the snapshot changes; a gun no longer in hand falls back to the first. */
const chosen = computed(() => Math.max(0, hud.owned.indexOf(picked.value ?? hud.owned[0])));
const focused = computed<WeaponId | null>(() => hud.owned[chosen.value] ?? null);
const shown = computed<WeaponId | null>(() => hud.owned[previewed.value ?? chosen.value] ?? focused.value);

/** What is pointed at or tabbed to: read back from the live rows, so the line never goes stale after a fit. */
const peek = ref<{ upgrade: GunUpgrade } | { effect: GunEffect } | null>(null);
/** The last thing fitted, said for a few seconds so a press is never silent. */
const flash = ref<string | null>(null);
let flashTimer: ReturnType<typeof setTimeout> | undefined;

const free = computed(() => (focused.value ? slotsFree(focused.value, gear.value.fits[focused.value]) : 0));

const peekRow = computed(() => {
  const at = peek.value;
  const asked = at !== null && 'upgrade' in at;
  if (!asked || !focused.value) return null;
  return benchRows(focused.value, hud.owned, gear.value).find((row) => row.upgrade === at.upgrade) ?? null;
});

const peekOption = computed(() => {
  const at = peek.value;
  const asked = at !== null && 'effect' in at;
  if (!asked || !focused.value) return null;
  return effectView(focused.value, hud.owned, gear.value).options.find((option) => option.effect === at.effect) ?? null;
});

/** The upgrade whose result the bars and slots show as a preview: only one that can really be fitted. */
const trialUpgrade = computed(() => (peekRow.value && !peekRow.value.blocked ? peekRow.value.upgrade : null));

/** A fresh fit, then what is pointed at, then the van's clock, then what to do next; a bench with work left says so. */
const note = computed(() => {
  if (flash.value) return flash.value;
  if (peekRow.value) return upgradeHint(peekRow.value);
  if (peekOption.value) return effectHint(peekOption.value);
  if (bench.walkUp) return benchHint(bench);
  if (bench.youReady) return waiting.value;
  const left = hasWorkLeft(hud.owned, gear.value) ? 'You still hold parts you can fit. ' : '';
  return `${waiting.value} ${left}${benchHint(bench)}`.trim();
});

/** Moving to another tile ends the last fit's message, so the new tile is never talked over. */
function peekUpgrade(row: BenchRow | null): void {
  peek.value = row ? { upgrade: row.upgrade } : null;
  if (row) flash.value = null;
}

function peekEffect(option: EffectOption | null): void {
  peek.value = option ? { effect: option.effect } : null;
  if (option) flash.value = null;
}

function say(text: string): void {
  flash.value = text;
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => (flash.value = null), 3000);
}

// A rank or a kit that lands on the gun in focus is said out loud; switching guns is not a fit.
watch(
  () => [focused.value, focused.value ? slotsUsed(gear.value.fits[focused.value]) : 0, focused.value ? effectOf(gear.value.fits[focused.value]) : null] as const,
  ([gun, used, effect], [before, usedBefore, effectBefore]) => {
    if (gun === null || gun !== before) return;
    const name = WEAPONS[gun].label;
    if (used > usedBefore) say(`Fitted to the ${name}. ${slotsFree(gun, gear.value.fits[gun])} slots free.`);
    else if (effect !== null && effect !== effectBefore) say(`${GUN_EFFECTS[effect].label} loaded in the ${name}.`);
  },
);

function choose(index: number): void {
  game.playUi('click');
  picked.value = hud.owned[index] ?? null;
}

function preview(index: number | null): void {
  const pointing = index !== null;
  if (pointing) game.playUi('hover');
  previewed.value = index;
}

function toggleReady(): void {
  game.bench.send({ kind: 'ready', ready: !bench.youReady });
}

onMounted(() => guns.value?.focus());
onUnmounted(() => clearTimeout(flashTimer));
</script>

<style scoped>
/* As wide as the scene (rounded as SpriteImg rounds it), the column and the gaps; a phone gets the window. */
.bench {
  --scene-px: max(var(--dpx, 1px), round(nearest, calc(var(--u) * 4), var(--dpx, 1px)));
  display: flex;
  flex-direction: column;
  gap: calc(var(--u) * 4);
  width: calc(var(--scene-px) * var(--card-w) + var(--u) * 220);
  max-width: 100%;
  container: select / inline-size;
}

.bench-left {
  width: calc(var(--u) * 180);
}

.bench-strip {
  display: flex;
  gap: calc(var(--u) * 3);
}

.bench-col-parts {
  flex: 1;
}

/* Every row of the bench says what it is for, so three rows of tiles are not one grey heap. */
.bench-label {
  display: flex;
  align-items: center;
  gap: calc(var(--u) * 3);
  margin: 0;
  padding-inline: var(--u);
  color: var(--bone);
  font-size: calc(var(--u) * 6);
  font-weight: 400;
  text-transform: uppercase;
}

.bench-step {
  display: inline-grid;
  place-items: center;
  width: calc(var(--u) * 8);
  height: calc(var(--u) * 8);
  background: var(--amber);
  color: var(--ink);
  font-size: calc(var(--u) * 6);
}

.bench-label-aside {
  margin-left: auto;
  color: var(--bone-dim);
  font-size: calc(var(--u) * 5);
}

/* Held at the bottom of the window, so Ready is never a scroll away on a phone on its side. */
.bench-foot {
  position: sticky;
  bottom: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: calc(var(--u) * 4);
  padding-block: calc(var(--u) * 2);
  background: var(--ink);
}

/* Two lines are always kept, so the hint changing from a tile to a clock never moves the screen. */
.bench-wait {
  display: -webkit-box;
  flex: 1;
  min-height: 2lh;
  max-width: none;
  margin: 0;
  overflow: hidden;
  font-size: calc(var(--u) * 6);
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.bench-act {
  width: auto;
  padding-inline: calc(var(--u) * 10);
}

/* A phone has no room beside the guns: the parts go under them. */
@container select (max-width: 420px) {
  .bench-strip {
    flex-direction: column;
  }
}
</style>
