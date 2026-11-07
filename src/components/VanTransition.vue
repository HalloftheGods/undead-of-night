<template>
  <section
    v-if="frame"
    class="van-trip"
    :style="sceneStyle"
    role="img"
    :aria-label="label"
  >
    <div class="van-trip-skyline" :style="skylineStyle" />
    <div class="van-trip-road" :style="roadStyle">
      <div class="van-trip-lane" :style="laneStyle" />
    </div>
    <template v-if="van">
      <SpriteImg v-for="(puff, index) in puffs" :key="index" class="van-trip-puff" :sprite="puff.sprite" :style="puff.style" />
      <div class="van-trip-van" :style="vanStyle">
        <div class="van-trip-beam" :style="beamStyle" />
        <SpriteImg class="van-trip-part" :sprite="van.body" :style="bodyStyle" />
        <SpriteImg v-for="(spot, index) in van.wheelAt" :key="index" class="van-trip-part" :sprite="van.wheel[frame.wheel]" :style="at(spot)" />
      </div>
    </template>
    <div class="van-trip-bar is-top" />
    <div class="van-trip-bar is-bottom" />
  </section>
</template>

<script setup lang="ts">
// The van driving across the screen between the bunker and a town. It only watches where the world
// was built, so it never holds up the sim; the cover is whole from the first frame because the
// world under it has already been rebuilt.
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import type { ArtBook } from '../art/types.ts';
import { clipFrameAt, spriteDataUrl } from '../engine/sprite-cache.ts';
import { motion } from '../game/motion.ts';
import { noteVanCover, stageCut } from '../game/stage-cut.ts';
import { nextRun, runOver, skipRun, tripFor, vanCues, vanFrame, vanPixel, vanPuffs, vanTimeline } from '../game/van-transition.ts';
import type { VanRun, VanTrip } from '../game/van-transition.ts';
import SpriteImg from './SpriteImg.vue';
import { useGame } from './use-game.ts';

const props = defineProps<{ inBunker: boolean | null; art: ArtBook | null }>();
const game = useGame();

/** The road the wheels stand on, down the window. */
const GROUND_SHARE = 0.66;
/** Road dashes and skyline scroll at these shares of the van's own pace. */
const LANE_PACE = 1.2;
const SKYLINE_PACE = 0.3;
const BEAM_REACH_PX = 60;
const PUFF_DRIFT_PX = 8;
const PUFF_RISE_PX = 6;

const reduced = motion.reduced;
const run = shallowRef<VanRun | null>(null);
const elapsed = ref(0);
const view = ref({ w: window.innerWidth, h: window.innerHeight });
/** Where the party was last known to be; null outside a home session, so its first sighting plays nothing. */
let seen: boolean | null = props.inBunker;
let heard = -1;
let raf = 0;
/** Ends the drive on time even where frames stop coming, so the cover can never stick. */
let deadline: ReturnType<typeof setTimeout> | undefined;

const frame = computed(() => (run.value ? vanFrame(run.value.trip, elapsed.value, reduced.value) : null));
const van = computed(() => props.art?.ui.vanSide ?? null);
const px = computed(() => (van.value ? vanPixel(view.value.w, view.value.h, van.value.body.w, van.value.body.h) : 2));
const groundY = computed(() => Math.round(view.value.h * GROUND_SHARE));
/** Rows from the top of the body to the bottom of the wheels. */
const standH = computed(() => (van.value ? van.value.wheelAt[0].y + van.value.wheel[0].h : 0));
const label = computed(() => (run.value?.trip === 'leaving' ? 'The van drives out to town' : 'The van drives home'));

/** How far the scenery has slid behind the van, in css px, snapped to whole art pixels. */
function slid(pace: number): number {
  const f = frame.value;
  const moved = f ? -f.facing * f.travelled * view.value.w * pace : 0;
  return Math.round(moved / px.value) * px.value;
}

/** Whole, it catches clicks so nothing under it is pressed unseen; lifting, it lets them through. */
const sceneStyle = computed((): Record<string, string | number> => {
  const cover = frame.value?.cover ?? 0;
  const whole = cover >= 1;
  return { '--vpx': `${px.value}px`, opacity: cover, pointerEvents: whole ? 'auto' : 'none' };
});
const skylineStyle = computed(() => {
  const sky = props.art?.ui.vanSide.skyline;
  if (!sky) return {};
  return {
    top: `${groundY.value - (sky.h + 3) * px.value}px`,
    height: `${sky.h * px.value}px`,
    backgroundImage: `url(${spriteDataUrl(sky)})`,
    backgroundSize: `${sky.w * px.value}px ${sky.h * px.value}px`,
    backgroundPositionX: `${slid(SKYLINE_PACE)}px`,
  };
});
const roadStyle = computed(() => ({ top: `${groundY.value - 3 * px.value}px` }));
const laneStyle = computed(() => ({ top: `${7 * px.value}px`, backgroundPositionX: `${slid(LANE_PACE)}px` }));

const vanStyle = computed(() => {
  const f = frame.value;
  const body = van.value?.body;
  const nothingToPlace = !f || !body;
  if (nothingToPlace) return {};
  const left = f.x * view.value.w - (body.w * px.value) / 2;
  return {
    width: `${body.w * px.value}px`,
    height: `${body.h * px.value}px`,
    top: `${groundY.value - standH.value * px.value}px`,
    transform: `translateX(${left}px) scaleX(${f.facing})`,
  };
});
const bodyStyle = computed(() => ({ transform: `translateY(${-(frame.value?.bob ?? 0) * px.value}px)` }));
const beamStyle = computed(() => {
  const lamp = van.value?.lamp;
  if (!lamp) return {};
  return {
    left: `${lamp.x * px.value}px`,
    top: `${(lamp.y - 6) * px.value}px`,
    width: `${Math.min(view.value.w * 0.45, BEAM_REACH_PX * px.value)}px`,
    height: `${14 * px.value}px`,
  };
});

function at(spot: { readonly x: number; readonly y: number }): Record<string, string> {
  return { left: `${spot.x * px.value}px`, top: `${spot.y * px.value}px` };
}

const puffs = computed(() => {
  const f = frame.value;
  const art = props.art;
  const body = van.value;
  const current = run.value;
  const standing = !f || !art || !body || !current;
  if (standing) return [];
  const clip = art.fx.smokePuff;
  const size = Math.max(1, Math.round(px.value / 2));
  const tail = f.facing * (body.exhaust.x * px.value - (body.body.w * px.value) / 2);
  const pipeY = groundY.value - (standH.value - body.exhaust.y) * px.value;
  return vanPuffs(current.trip, elapsed.value, reduced.value).map((puff) => {
    const sprite = clipFrameAt(clip, puff.age);
    const x = puff.x * view.value.w + tail - f.facing * puff.age * PUFF_DRIFT_PX * px.value;
    const y = pipeY - puff.age * PUFF_RISE_PX * px.value;
    return {
      sprite,
      style: {
        '--sprite-px': `${size}px`,
        left: `${x - sprite.ax * size}px`,
        top: `${y - sprite.ay * size}px`,
        opacity: 1 - puff.age,
      },
    };
  });
});

function stop(): void {
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
  clearTimeout(deadline);
}

function armDeadline(current: VanRun): void {
  clearTimeout(deadline);
  const left = current.startedMs + vanTimeline(current.trip, reduced.value).total - performance.now();
  deadline = setTimeout(() => {
    stop();
    step();
  }, Math.max(0, left) + 50);
}

function step(): void {
  raf = 0;
  const current = run.value;
  if (!current) return;
  const now = performance.now();
  const ms = now - current.startedMs;
  for (const cue of vanCues(current, heard, ms, reduced.value)) game.audio.playVan(cue);
  heard = ms;
  const over = runOver(current, now, reduced.value);
  if (over) {
    run.value = null;
    return;
  }
  elapsed.value = ms;
  raf = requestAnimationFrame(step);
}

function begin(trip: VanTrip | null): void {
  const unseen = trip === null || document.visibilityState === 'hidden';
  if (unseen) return;
  const next = nextRun(run.value, trip, performance.now(), reduced.value);
  const same = next === run.value;
  if (same) return;
  stop();
  run.value = next;
  heard = -1;
  if (next) armDeadline(next);
  step();
}

/** A new fact about where the party is: from the stage the moment it builds, or from the HUD on its beat. */
function sight(inBunker: boolean | null): void {
  const trip = tripFor(seen, inBunker);
  seen = inBunker;
  begin(trip);
}

watch(() => run.value !== null, noteVanCover);
watch(() => props.inBunker, sight);
watch(stageCut, (cut) => {
  const inSession = cut !== null && seen !== null;
  if (inSession) sight(cut.inBunker);
});

/** A key or a click lifts the cover at once. Nothing is swallowed: the game still gets the press. */
function skip(event: KeyboardEvent | PointerEvent): void {
  const current = run.value;
  const held = event instanceof KeyboardEvent && event.repeat;
  const nothingToSkip = !current || held;
  if (nothingToSkip) return;
  const skipped = skipRun(current, performance.now(), reduced.value);
  run.value = skipped;
  armDeadline(skipped);
}

function onHidden(): void {
  const hidden = document.visibilityState === 'hidden';
  if (!hidden) return;
  stop();
  run.value = null;
}

function onResize(): void {
  view.value = { w: window.innerWidth, h: window.innerHeight };
}

onMounted(() => {
  window.addEventListener('keydown', skip);
  window.addEventListener('pointerdown', skip);
  window.addEventListener('resize', onResize);
  document.addEventListener('visibilitychange', onHidden);
});

onBeforeUnmount(() => {
  stop();
  window.removeEventListener('keydown', skip);
  window.removeEventListener('pointerdown', skip);
  window.removeEventListener('resize', onResize);
  document.removeEventListener('visibilitychange', onHidden);
});
</script>

<style scoped>
/* Night sky over the road, from the palette's ink and denim. */
.van-trip {
  position: fixed;
  inset: 0;
  z-index: 4;
  overflow: hidden;
  background: linear-gradient(180deg, #0d0b16 0%, #1b1728 30%, #222c52 66%, #0d0b16 66%);
}

.van-trip-skyline {
  position: absolute;
  left: 0;
  right: 0;
  background-repeat: repeat-x;
  image-rendering: pixelated;
}

.van-trip-road {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  background: #1c1f29;
  border-top: var(--vpx) solid #44444f;
}

.van-trip-lane {
  position: absolute;
  left: 0;
  right: 0;
  height: var(--vpx);
  background-image: linear-gradient(90deg, #a89a80 calc(var(--vpx) * 10), transparent calc(var(--vpx) * 10));
  background-size: calc(var(--vpx) * 24) 100%;
}

.van-trip-van {
  position: absolute;
  left: 0;
  transform-origin: center;
}

.van-trip-part,
.van-trip-beam,
.van-trip-puff {
  position: absolute;
}

.van-trip-part {
  --sprite-px: var(--vpx);
}

.van-trip-beam {
  clip-path: polygon(0 42%, 100% 0, 100% 100%, 0 58%);
  background: linear-gradient(90deg, rgb(250 242 212 / 0.5), rgb(250 242 212 / 0));
}

.van-trip-bar {
  position: absolute;
  left: 0;
  right: 0;
  height: 12%;
  background: #000;
}

.van-trip-bar.is-top {
  top: 0;
}

.van-trip-bar.is-bottom {
  bottom: 0;
}
</style>
