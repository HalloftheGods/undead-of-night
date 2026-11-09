<template>
  <!--
    The catcher takes the tap or click that closes the ring. It fires no shot, but the left thumb
    walks straight through it (data-touch-walk, game/touch-input.ts): the ring does not hold the run.
  -->
  <section
    class="backpack"
    data-touch-walk
    aria-label="Backpack"
    @pointerdown="onDown"
    @mousedown.stop
    @contextmenu.prevent
  >
    <div class="backpack-ring" data-touch-ui :style="{ '--slots': slots.length }">
      <span class="backpack-cord" aria-hidden="true" />
      <p v-if="lit" class="backpack-say">{{ lit.name }}</p>
      <button
        v-for="(slot, index) in slots"
        :key="slot.code"
        class="backpack-slot px-frame"
        :class="{ 'is-on': hovered === slot.code, 'is-spent': !slot.ready, 'is-wide': slot.art === 'gun' }"
        :style="{ '--angle': `${slotAngle(index, slots.length)}deg`, '--step': index }"
        type="button"
        :aria-label="slot.label"
        :disabled="!slot.ready"
        @pointerenter="hovered = slot.code"
        @pointerleave="letGo(slot.code)"
        @focus="hovered = slot.code"
        @click="pick(slot)"
      >
        <SpriteImg :sprite="spriteOf(slot)" />
        <span v-if="slot.count !== null" class="backpack-count">{{ slot.count }}</span>
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import type { ArtBook, PixelSprite } from '../art/types.ts';
import { slotAngle, stepSlot, wheelSlots } from '../game/backpack-wheel.ts';
import type { WheelSlot } from '../game/backpack-wheel.ts';
import type { HudState } from '../game/hud-state.ts';
import { WHEEL_COOLDOWN_MS } from '../game/input-manager.ts';
import SpriteImg from './SpriteImg.vue';

/** The button that opens the ring also closes it (game/input-manager.ts). */
const MIDDLE_BUTTON = 1;

const props = defineProps<{ hud: HudState; art: ArtBook }>();
const emit = defineEmits<{ close: []; action: [code: string] }>();

const hovered = ref<string | null>(null);
/** When the wheel last stepped the highlight, for the cooldown. */
let lastWheelAt = 0;

const slots = computed<WheelSlot[]>(() => wheelSlots(props.hud));
/** The slot under the finger, which is the only one that says its name. */
const lit = computed<WheelSlot | null>(() => slots.value.find((slot) => slot.code === hovered.value) ?? null);

/** The picture the game draws this thing with everywhere else. */
function spriteOf(slot: WheelSlot): PixelSprite {
  const { ui } = props.art;
  switch (slot.art) {
    case 'gun':
      return ui.weaponIcons[slot.weapon ?? props.hud.weapon];
    case 'medkit':
      return ui.pickupIcons.medkit;
    case 'bottle':
      return ui.bottle;
    case 'fireworks':
      return ui.fireworks;
    case 'fountain':
      return ui.fountain;
    case 'candy':
      return ui.candy;
    case 'map':
      return ui.townMap;
  }
}

/** Only the finger that lit a slot puts it out, so sliding across the ring never leaves two lit. */
function letGo(code: string): void {
  const stillMine = hovered.value === code;
  if (stillMine) hovered.value = null;
}

function pick(slot: WheelSlot): void {
  if (!slot.ready) return;
  emit('action', slot.code);
}

/**
 * A press outside the ring closes it, and so does a second middle press wherever it lands: the
 * catcher stops `mousedown`, so the middle-click that opens the ring never reaches the game again.
 */
function onDown(event: PointerEvent): void {
  const outside = event.target === event.currentTarget;
  const middle = event.button === MIDDLE_BUTTON;
  if (outside || middle) emit('close');
}

function onKeyDown(event: KeyboardEvent): void {
  const quit = event.key === 'Escape';
  if (quit) {
    emit('close');
    return;
  }
  // Enter or Space uses whatever the wheel walked to, so stepping the ring is not a dead end.
  const commit = event.key === 'Enter' || event.key === ' ';
  const hasPick = commit && lit.value !== null;
  if (!hasPick) return;
  // A slot can also hold focus, and the browser would click it: this is the one pick either way.
  event.preventDefault();
  pick(lit.value!);
}

/**
 * The scroll wheel walks the ring instead of cycling guns. Caught on the way down and stopped
 * here, so the game's own wheel listener (game/input-manager.ts, on the window, bubbling) never
 * sees it: what is under the hand is the ring, not the guns.
 */
function onWheel(event: WheelEvent): void {
  const still = event.deltaY === 0;
  if (still) return;
  event.preventDefault();
  event.stopPropagation();
  // One notch per cooldown, the same pace the wheel cycles guns at: a trackpad sends a flurry.
  const now = performance.now();
  const tooSoon = now - lastWheelAt < WHEEL_COOLDOWN_MS;
  if (tooSoon) return;
  lastWheelAt = now;
  hovered.value = stepSlot(slots.value, hovered.value, Math.sign(event.deltaY));
}

/** A tab or a call taking the window leaves nothing open over the town. */
function onAway(): void {
  emit('close');
}

/** Capture, so the step lands before the game's own wheel listener on the same window. */
const CATCH = { capture: true, passive: false } as const;

onMounted(() => {
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('blur', onAway);
  window.addEventListener('wheel', onWheel, CATCH);
});
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeyDown);
  window.removeEventListener('blur', onAway);
  window.removeEventListener('wheel', onWheel, CATCH);
});
</script>

<style scoped>
/* A catcher for the tap that closes the ring. It dims nothing: the town stays in view. */
.backpack {
  position: fixed;
  inset: 0;
  z-index: 25;
}

/*
 * The ring hangs off the survivor. `--player-x` and `--player-y` are written onto <html> every
 * frame by the run (game/player-anchor.ts), so the ring follows with no Vue work per frame;
 * before the first frame writes them it sits in the middle of the window. The clamp keeps a ring
 * opened in a corner whole and on screen.
 */
.backpack-ring {
  --chip: max(var(--tap, 44px), calc(var(--u) * 26));
  /* 2πr spread over the chips, with room between them, so a full backpack's slots never touch. */
  --reach: max(calc(var(--chip) * 1.45), calc(var(--chip) * var(--slots) * 0.22));
  --keep-in: calc(var(--reach) + var(--chip) / 2 + var(--u) * 2);
  position: fixed;
  top: clamp(var(--keep-in), var(--player-y, 50%), calc(100% - var(--keep-in)));
  left: clamp(var(--keep-in), var(--player-x, 50%), calc(100% - var(--keep-in)));
  width: 0;
  height: 0;
}

/* The strap the slots hang on: enough to read as one ring, not enough to hide a zombie. */
.backpack-cord {
  position: absolute;
  top: 0;
  left: 0;
  width: calc(var(--reach) * 2);
  height: calc(var(--reach) * 2);
  margin: calc(var(--reach) * -1);
  border: calc(var(--dpx, 1px) * 2) dashed rgba(168, 154, 128, 0.4);
  border-radius: 50%;
  pointer-events: none;
}

/* The lit slot's name, over the survivor's head where the game puts its other labels. */
.backpack-say {
  position: absolute;
  bottom: calc(var(--reach) * 0.25);
  left: 0;
  margin: 0;
  padding: 0 var(--u);
  background: rgba(11, 12, 16, 0.9);
  color: var(--bone);
  font-size: calc(var(--u) * 5);
  line-height: 1.4;
  white-space: nowrap;
  pointer-events: none;
  transform: translateX(-50%);
}

/*
 * The art is sized off the chip, not off `--u`: `--u` is 1.5px on a narrow phone and 2px on a
 * desktop, so SpriteImg's own unit times a scale would draw a 15-wide icon at 70px and the
 * 32-wide gun icon at nearly 200px, both far outside a 44px chip. A square icon takes 15 of the
 * chip's 21 columns; the gun icon is wide and short, so it takes 32 of 38. Both leave the notched
 * frame and the count badge in the clear.
 */
.backpack-slot {
  --edge: var(--bone-dim);
  --sprite-px: calc(var(--chip) / 21);
  display: grid;
  place-items: center;
  position: absolute;
  top: 0;
  left: 0;
  width: var(--chip);
  height: var(--chip);
  margin: calc(var(--chip) / -2);
  border: 0;
  padding: 0;
  background: rgba(11, 12, 16, 0.88);
  color: var(--bone);
  cursor: pointer;
  touch-action: none;
  transform: rotate(var(--angle)) translateX(var(--reach)) rotate(calc(var(--angle) * -1));
  animation: slot-arrive 150ms steps(3) both;
  animation-delay: calc(var(--step) * 25ms);
}

.backpack-slot.is-wide {
  --sprite-px: calc(var(--chip) / 38);
}

/* Whole device pixels where the browser can round, so the art stays crisp (as SpriteImg does). */
@supports (width: round(1px, 1px)) {
  .backpack-slot {
    --sprite-px: max(var(--dpx, 1px), round(nearest, calc(var(--chip) / 21), var(--dpx, 1px)));
  }

  .backpack-slot.is-wide {
    --sprite-px: max(var(--dpx, 1px), round(nearest, calc(var(--chip) / 38), var(--dpx, 1px)));
  }
}

.backpack-slot.is-on {
  --edge: var(--bone);
  background: var(--amber);
  color: var(--ink);
}

.backpack-slot.is-spent {
  cursor: default;
  opacity: 0.45;
}

/* Out of the survivor's chest onto the ring, one slot after the next. */
@keyframes slot-arrive {
  from {
    opacity: 0;
    transform: rotate(var(--angle)) translateX(0) rotate(calc(var(--angle) * -1));
  }
}

:root[data-motion='reduced'] .backpack-slot {
  animation: none;
}

.backpack-count {
  position: absolute;
  right: var(--u);
  bottom: 0;
  color: var(--amber);
  font-size: calc(var(--u) * 5);
  line-height: 1;
}

.backpack-slot.is-on .backpack-count {
  color: var(--ink);
}
</style>
