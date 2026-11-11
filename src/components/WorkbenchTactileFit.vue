<template>
  <div
    class="tactile-overlay"
    role="dialog"
    aria-modal="true"
    :aria-label="`Install ${partTitle} on ${gunTitle}`"
    @keydown.esc="onCancel"
    @keydown.enter="onQuickFit"
  >
    <div class="tactile-card px-frame" tabindex="-1">
      <header class="tactile-head">
        <h2 class="tactile-title">WORKBENCH: INSTALL {{ partTitle }}</h2>
        <p class="tactile-prompt">{{ instructionText }}</p>
      </header>

      <div
        ref="stageRef"
        class="tactile-stage"
        :class="[`is-${kind}`, { 'is-locked': isLocked, 'is-active': isInteracting }]"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
      >
        <div class="stage-weapon">
          <SpriteImg :sprite="weaponSprite" />
        </div>

        <!-- Suppressor Twist Area -->
        <template v-if="kind === 'suppressor'">
          <div ref="anchorRef" class="mount-target mount-threads">
            <div class="thread-lines" aria-hidden="true" />
          </div>
          <div
            class="interactive-part part-twist"
            :style="twistStyle"
            aria-hidden="true"
          >
            <SpriteImg :sprite="partSprite" />
            <div v-if="!isLocked" class="rotation-hint" />
          </div>
        </template>

        <!-- Magazine Insertion Track -->
        <template v-else-if="kind === 'magazine'">
          <div ref="anchorRef" class="mount-target mount-well">
            <div class="well-guideline" aria-hidden="true" />
          </div>
          <div
            class="interactive-part part-drag"
            :style="dragStyle"
            aria-hidden="true"
          >
            <SpriteImg :sprite="partSprite" />
            <div v-if="!isLocked" class="arrow-up" />
          </div>
        </template>

        <!-- Angled Grip Rail Track -->
        <template v-else-if="kind === 'grip'">
          <div ref="anchorRef" class="mount-target mount-rail">
            <div class="rail-notches" aria-hidden="true">
              <span v-for="n in 5" :key="n" class="rail-tooth" />
            </div>
          </div>
          <div
            class="interactive-part part-slide"
            :style="slideStyle"
            aria-hidden="true"
          >
            <SpriteImg :sprite="partSprite" />
            <div v-if="!isLocked" class="arrow-right" />
          </div>
        </template>

        <div class="stage-status" :class="{ 'is-locked': isLocked }">
          {{ statusText }}
        </div>
      </div>

      <div class="tactile-progress-bar">
        <div class="progress-fill" :style="{ width: `${progressPercent}%` }" />
      </div>

      <footer class="tactile-foot">
        <PixelButton @press="onCancel">Cancel (Esc)</PixelButton>
        <PixelButton primary @press="onQuickFit">Quick Fit (Enter)</PixelButton>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Interactive tactile gun part fitting rig.
 * Players perform physical pointer gestures matching the mechanical part:
 * - Suppressor: hold and rotate clockwise in circles to screw onto muzzle threads.
 * - Magazine: drag straight upward into the receiver magazine well.
 * - Angled Grip: slide horizontally along the handguard rail until locked.
 */
import { computed, onMounted, onUnmounted, ref, useTemplateRef } from 'vue';
import { WEAPONS } from '../../shared/constants.ts';
import type { GunUpgrade, PartId } from '../../shared/gun-upgrade-data.ts';
import type { WeaponId } from '../../shared/protocol.ts';
import type { ArtBook, PixelSprite } from '../art/types.ts';
import {
  DragSlotGestureState,
  SlideRailGestureState,
  toTactileKind,
  TwistGestureState,
  type TactileKind,
} from '../game/workbench-gesture.ts';
import PixelButton from './PixelButton.vue';
import SpriteImg from './SpriteImg.vue';
import { useGame } from './use-game.ts';

interface TactileProps {
  weapon: WeaponId;
  upgrade: GunUpgrade;
  art: ArtBook;
}

const { weapon, upgrade, art } = defineProps<TactileProps>();
const emit = defineEmits<{ fit: []; cancel: [] }>();
const game = useGame();

const stageRef = useTemplateRef<HTMLDivElement>('stageRef');
const anchorRef = useTemplateRef<HTMLDivElement>('anchorRef');

const kind = computed<TactileKind>(() => toTactileKind(upgrade) ?? 'suppressor');
const gunTitle = computed(() => WEAPONS[weapon].label);

const partTitle = computed(() => {
  const currentKind = kind.value;
  if (currentKind === 'suppressor') return 'Suppressor';
  if (currentKind === 'magazine') return 'Extended Magazine';
  return 'Angled Grip';
});

const instructionText = computed(() => {
  const currentKind = kind.value;
  if (currentKind === 'suppressor') return 'Hold and rotate clockwise to twist onto barrel threads';
  if (currentKind === 'magazine') return 'Drag straight up into the magazine well';
  return 'Slide along the rail until locked into detent';
});

const weaponSprite = computed<PixelSprite>(() => art.ui.weaponIcons[weapon]);

const partSprite = computed<PixelSprite>(() => {
  const currentKind = kind.value;
  const partName: PartId = currentKind === 'grip' ? 'grip' : currentKind;
  return art.ui.pickupIcons[partName];
});

const twistGesture = new TwistGestureState();
const dragGesture = new DragSlotGestureState();
const slideGesture = new SlideRailGestureState();

const progress = ref(0);
const isLocked = ref(false);
const isInteracting = ref(false);
let completionTimer: ReturnType<typeof setTimeout> | undefined;

const progressPercent = computed(() => Math.round(progress.value * 100));

const statusText = computed(() => {
  if (isLocked.value) return 'LOCKED & MOUNTED';
  if (!isInteracting.value) return 'READY TO FIT';
  const currentKind = kind.value;
  if (currentKind === 'suppressor') return `THREADING: ${progressPercent.value}%`;
  if (currentKind === 'magazine') return `INSERTING: ${progressPercent.value}%`;
  return `SLIDING: ${progressPercent.value}%`;
});

// Suppressor twist transforms
const twistStyle = computed(() => {
  const pct = progress.value;
  // Rotates 720deg (2 full turns) and moves 40px left onto barrel threads
  const angleDeg = pct * 720;
  const advancePx = (1 - pct) * 44;
  return {
    transform: `translate(${advancePx}px, 0) rotate(${angleDeg}deg)`,
  };
});

// Magazine vertical drag transforms
const dragStyle = computed(() => {
  const pct = progress.value;
  const offsetPx = (1 - pct) * 80;
  return {
    transform: `translate(0, ${offsetPx}px)`,
  };
});

// Grip horizontal slide transforms
const slideStyle = computed(() => {
  const pct = progress.value;
  const offsetPx = (1 - pct) * 90;
  return {
    transform: `translate(${offsetPx}px, 0)`,
  };
});

function pulseHaptic(pattern: number | number[]): void {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch {
      // Ignored if vibration is unsupported or restricted
    }
  }
}

function onRatchet(): void {
  game.playSfx('dry_click');
  pulseHaptic(8);
}

function onLock(): void {
  isLocked.value = true;
  progress.value = 1;
  pulseHaptic([20, 40, 25]);

  const currentKind = kind.value;
  if (currentKind === 'suppressor') {
    game.playSfx('bolt_rack');
  } else if (currentKind === 'magazine') {
    game.playSfx('mag_in');
  } else {
    game.playSfx('slide_drop');
  }

  clearTimeout(completionTimer);
  completionTimer = setTimeout(() => {
    emit('fit');
  }, 380);
}

function getAnchorCenter(): { cx: number; cy: number } {
  const anchorEl = anchorRef.value;
  if (!anchorEl) return { cx: 0, cy: 0 };
  const rect = anchorEl.getBoundingClientRect();
  return {
    cx: rect.left + rect.width / 2,
    cy: rect.top + rect.height / 2,
  };
}

function onPointerDown(event: PointerEvent): void {
  if (isLocked.value) return;
  isInteracting.value = true;

  const stageEl = stageRef.value;
  if (stageEl && 'setPointerCapture' in stageEl) {
    stageEl.setPointerCapture(event.pointerId);
  }

  const currentKind = kind.value;
  if (currentKind === 'suppressor') {
    const { cx, cy } = getAnchorCenter();
    twistGesture.start(event.clientX, event.clientY, cx, cy);
  } else if (currentKind === 'magazine') {
    dragGesture.start(event.clientY);
  } else {
    slideGesture.start(event.clientX);
  }
}

function onPointerMove(event: PointerEvent): void {
  if (!isInteracting.value || isLocked.value) return;

  const currentKind = kind.value;
  let status = { progress: 0, locked: false, ratcheted: false };

  if (currentKind === 'suppressor') {
    const { cx, cy } = getAnchorCenter();
    status = twistGesture.update(event.clientX, event.clientY, cx, cy);
  } else if (currentKind === 'magazine') {
    status = dragGesture.update(event.clientY);
  } else {
    status = slideGesture.update(event.clientX);
  }

  progress.value = status.progress;
  if (status.ratcheted) {
    onRatchet();
  }
  if (status.locked) {
    onLock();
  }
}

function onPointerUp(event: PointerEvent): void {
  isInteracting.value = false;
  const stageEl = stageRef.value;
  if (stageEl && 'releasePointerCapture' in stageEl && stageEl.hasPointerCapture(event.pointerId)) {
    stageEl.releasePointerCapture(event.pointerId);
  }
}

function onQuickFit(): void {
  if (isLocked.value) return;
  onLock();
}

function onCancel(): void {
  clearTimeout(completionTimer);
  emit('cancel');
}

onMounted(() => {
  twistGesture.reset();
  dragGesture.reset();
  slideGesture.reset();
});

onUnmounted(() => {
  clearTimeout(completionTimer);
});
</script>

<style scoped>
.tactile-overlay {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(5, 6, 10, 0.88);
  backdrop-filter: blur(2px);
  padding: calc(var(--u) * 6);
  animation: px-fade-in 120ms steps(3);
}

.tactile-card {
  --edge: var(--bone-dim);
  display: flex;
  flex-direction: column;
  gap: calc(var(--u) * 4);
  width: calc(var(--u) * 190);
  max-width: 100%;
  padding: calc(var(--u) * 4);
  background: var(--ink-raised);
  color: var(--bone);
  outline: none;
}

.tactile-head {
  display: flex;
  flex-direction: column;
  gap: var(--u);
  text-align: center;
}

.tactile-title {
  margin: 0;
  color: var(--amber);
  font-size: calc(var(--u) * 8);
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.tactile-prompt {
  margin: 0;
  color: var(--bone-dim);
  font-size: calc(var(--u) * 6);
  text-transform: uppercase;
}

/* Interactive Rig Stage */
.tactile-stage {
  --sprite-px: max(var(--dpx, 1px), round(nearest, calc(var(--u) * 2), var(--dpx, 1px)));
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  height: calc(var(--u) * 90);
  background: var(--ink);
  border: var(--u) solid var(--ink-line);
  user-select: none;
  touch-action: none;
  cursor: grab;
}

.tactile-stage.is-active {
  cursor: grabbing;
}

.tactile-stage.is-locked {
  border-color: var(--amber);
  background: rgba(232, 163, 61, 0.08);
}

.stage-weapon {
  position: absolute;
  left: 20%;
  top: 40%;
  transform: translateY(-50%);
  pointer-events: none;
}

.mount-target {
  position: absolute;
  pointer-events: none;
}

.interactive-part {
  position: absolute;
  pointer-events: none;
  transition: filter 120ms linear;
}

/* Suppressor Alignment */
.mount-threads {
  left: 12%;
  top: 38%;
  width: calc(var(--u) * 14);
  height: calc(var(--u) * 12);
  border: 1px dashed var(--amber);
}

.part-twist {
  left: 10%;
  top: 36%;
}

.rotation-hint {
  position: absolute;
  inset: calc(var(--u) * -6);
  border: 2px dashed rgba(232, 163, 61, 0.4);
  border-radius: 50%;
  pointer-events: none;
  animation: spin 3s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Magazine Alignment */
.mount-well {
  left: 42%;
  top: 38%;
  width: calc(var(--u) * 16);
  height: calc(var(--u) * 20);
  border-bottom: 2px dashed var(--amber);
}

.part-drag {
  left: 42%;
  top: 38%;
}

.arrow-up {
  position: absolute;
  top: calc(var(--u) * -8);
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: calc(var(--u) * 3) solid transparent;
  border-right: calc(var(--u) * 3) solid transparent;
  border-bottom: calc(var(--u) * 5) solid var(--amber);
  animation: bounce-up 1s ease infinite alternate;
}

@keyframes bounce-up {
  from { transform: translate(-50%, 0); }
  to { transform: translate(-50%, calc(var(--u) * -3)); }
}

/* Grip Alignment */
.mount-rail {
  left: 36%;
  top: 48%;
  width: calc(var(--u) * 44);
  height: calc(var(--u) * 6);
  border-top: 1px dashed var(--amber);
}

.rail-notches {
  display: flex;
  justify-content: space-between;
  width: 100%;
}

.rail-tooth {
  width: calc(var(--u) * 2);
  height: calc(var(--u) * 3);
  background: var(--ink-line);
}

.part-slide {
  left: 34%;
  top: 46%;
}

.arrow-right {
  position: absolute;
  right: calc(var(--u) * -8);
  top: 50%;
  transform: translateY(-50%);
  width: 0;
  height: 0;
  border-top: calc(var(--u) * 3) solid transparent;
  border-bottom: calc(var(--u) * 3) solid transparent;
  border-left: calc(var(--u) * 5) solid var(--amber);
  animation: bounce-right 1s ease infinite alternate;
}

@keyframes bounce-right {
  from { transform: translate(0, -50%); }
  to { transform: translate(calc(var(--u) * 3), -50%); }
}

.stage-status {
  position: absolute;
  bottom: calc(var(--u) * 2);
  left: 50%;
  transform: translateX(-50%);
  font-size: calc(var(--u) * 5);
  letter-spacing: 0.1em;
  color: var(--bone-dim);
  text-transform: uppercase;
}

.stage-status.is-locked {
  color: var(--amber);
  font-weight: 700;
}

/* Progress bar */
.tactile-progress-bar {
  height: calc(var(--u) * 4);
  background: var(--ink);
  border: var(--u) solid var(--ink-line);
}

.progress-fill {
  height: 100%;
  background: var(--amber);
  transition: width 60ms linear;
}

/* Footer buttons */
.tactile-foot {
  display: flex;
  justify-content: space-between;
  gap: calc(var(--u) * 3);
}
</style>
