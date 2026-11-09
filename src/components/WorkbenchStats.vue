<template>
  <div class="gun-panel">
    <p class="gun-head">
      <span class="gun-name">{{ WEAPONS[weapon].label }}</span>
      <span class="gun-used">{{ slotsUsed(fit) }}/{{ GUN_SLOTS[weapon] }} slots</span>
    </p>
    <p class="gun-quirk">{{ quirk ? `${quirk.label}: ${quirk.note}` : '' }}</p>
    <WorkbenchBars :bars :next />
    <ul class="gun-slots" :aria-label="`Slots on the ${WEAPONS[weapon].label}`">
      <li
        v-for="(slot, at) in slots"
        :key="at"
        class="gun-slot px-frame"
        :class="{ 'is-empty': slot === null, 'is-ghost': at === ghostAt }"
        :title="slot ? UPGRADES[slot].label : 'Empty slot'"
        :aria-label="slot ? UPGRADES[slot].label : 'Empty slot'"
      >
        <SpriteImg v-for="part in slotParts(slot, at)" :key="part" :sprite="icons.pickupIcons[part]" />
      </li>
    </ul>
    <p class="gun-rounds" :class="{ 'is-plain': effect === null }">
      <span class="gun-rounds-art">
        <SpriteImg v-if="effect" :sprite="icons.pickupIcons[GUN_EFFECTS[effect].kit]" />
      </span>
      <strong>{{ effect ? GUN_EFFECTS[effect].label : 'Plain rounds' }}</strong>
    </p>
    <p class="gun-rounds-note">{{ effect ? GUN_EFFECTS[effect].note : '' }}</p>
  </div>
</template>

<script setup lang="ts">
/**
 * The column beside the bench: the gun in focus as it fires with its work, its quirk, five slotted stat bars,
 * the slots its upgrades fill (each with the parts that went in) and the rounds it carries. Every line keeps
 * its room, so moving between guns moves nothing.
 */
import { computed } from 'vue';
import { WEAPONS } from '../../shared/constants.ts';
import { GUN_QUIRKS, GUN_SLOTS, UPGRADES } from '../../shared/gun-upgrade-data.ts';
import { effectOf, slotsUsed } from '../../shared/gun-upgrades.ts';
import type { PlayerGear } from '../../shared/gun-upgrades.ts';
import type { WeaponId } from '../../shared/protocol.ts';
import { GUN_EFFECTS } from '../../shared/round-effect-data.ts';
import type { UiArt } from '../art/types.ts';
import { gunBars, gunSlots, previewBars, upgradeParts } from '../game/bench-view.ts';
import type { GunUpgrade } from '../../shared/gun-upgrade-data.ts';
import SpriteImg from './SpriteImg.vue';
import WorkbenchBars from './WorkbenchBars.vue';

/** `trial` is the upgrade being pointed at: its bars and the slot it would fill show as a preview. */
const { weapon, gear, icons, trial = null } = defineProps<{ weapon: WeaponId; gear: PlayerGear; icons: UiArt; trial?: GunUpgrade | null }>();

const fit = computed(() => gear.fits[weapon]);
const quirk = computed(() => (fit.value?.quirk ? GUN_QUIRKS[fit.value.quirk] : null));
const bars = computed(() => gunBars(weapon, fit.value));
const slots = computed(() => gunSlots(weapon, fit.value));
const effect = computed(() => effectOf(fit.value));
const next = computed(() => (trial ? previewBars(weapon, fit.value, trial) : undefined));
/** The first empty slot, which a trial rank would take. */
const ghostAt = computed(() => (trial ? slots.value.indexOf(null) : -1));

/** The parts a slot shows: what its rank took, or a faint copy of the trial's while it is pointed at. */
function slotParts(slot: GunUpgrade | null, at: number) {
  if (slot) return upgradeParts(slot);
  return at === ghostAt.value && trial ? upgradeParts(trial) : [];
}
</script>

<style scoped>
.gun-panel {
  --sprite-px: max(var(--dpx, 1px), round(nearest, var(--u), var(--dpx, 1px)));
  display: flex;
  flex-direction: column;
  gap: calc(var(--u) * 3);
  width: calc(var(--u) * 180);
}

.gun-panel p {
  margin: 0;
}

.gun-head {
  display: flex;
  align-items: baseline;
  gap: calc(var(--u) * 4);
}

.gun-name {
  color: var(--amber);
  font-size: calc(var(--u) * 10);
  font-weight: 700;
  line-height: 1.2;
  text-transform: uppercase;
}

.gun-used {
  margin-left: auto;
  color: var(--bone-dim);
  font-size: calc(var(--u) * 6);
  text-transform: uppercase;
}

/* Two lines are always kept, so a gun without a quirk sits its bars where one with a quirk does. */
.gun-quirk {
  display: -webkit-box;
  min-height: 2lh;
  overflow: hidden;
  color: var(--sick);
  font-size: calc(var(--u) * 6);
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.gun-slots {
  display: flex;
  gap: calc(var(--u) * 2);
  margin: 0;
  padding: var(--u);
  list-style: none;
}

/* A slot is as tall as a part icon whether or not it holds one. */
.gun-slot {
  --edge: var(--amber);
  flex: 1 1 auto;
  display: flex;
  justify-content: center;
  gap: var(--u);
  min-width: calc(var(--u) * 20);
  height: calc(var(--sprite-px) * 15 + var(--u) * 4);
  padding: calc(var(--u) * 2);
  background: rgba(232, 163, 61, 0.14);
}

.gun-slot.is-empty {
  --edge: var(--ink-line);
  background: var(--ink-raised);
}

/* The slot a pointed-at rank would take: its parts shown faintly, in the amber of work to come. */
.gun-slot.is-ghost {
  --edge: var(--amber);
  background: var(--ink-raised);
}

.gun-slot.is-ghost img {
  opacity: 0.5;
}

.gun-rounds {
  display: flex;
  align-items: center;
  gap: calc(var(--u) * 3);
  color: var(--amber);
  text-transform: uppercase;
}

.gun-rounds.is-plain {
  color: var(--bone-dim);
}

.gun-rounds-art {
  width: calc(var(--sprite-px) * 15);
  height: calc(var(--sprite-px) * 15);
}

/* Two lines are always kept, so plain rounds sit the column as tall as an effect does. */
.gun-rounds-note {
  display: -webkit-box;
  min-height: 2lh;
  overflow: hidden;
  color: var(--bone-dim);
  font-size: calc(var(--u) * 6);
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
</style>
