<template>
  <TitlePage heading="Dev: Zombie Sprites" size="extra-wide" @close="emit('close')">
    <p v-if="!art" class="sprites-note">The art is still loading.</p>
    <v-sheet v-else color="transparent" class="sprites-layout">
      <nav class="sprites-row" aria-label="Zombie type">
        <PixelButton v-for="t in types" :key="t" :class="{ 'is-active': t === type }" @press="type = t">{{ t }}</PixelButton>
      </nav>
      <nav class="sprites-row" aria-label="Facing">
        <PixelButton v-for="(name, i) in FACINGS" :key="name" :class="{ 'is-active': i === facing }" @press="facing = i">{{ name }}</PixelButton>
      </nav>
      <v-sheet color="transparent" class="sprites-grid">
        <figure v-for="a in ZOMBIE_ANIMATIONS" :key="a" class="sprites-card px-frame">
          <canvas :ref="(el) => bind(a, el as HTMLCanvasElement | null)" class="sprites-canvas" :width="SIZE" :height="SIZE" />
          <figcaption>{{ a }}</figcaption>
        </figure>
      </v-sheet>
    </v-sheet>
  </TitlePage>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import type { ArtBook } from '../../art/types.ts';
import { FACINGS, ZOMBIE_ANIMATIONS, frameAt, zombieTypes } from '../../game/dev/zombie-sprites.ts';
import type { ZombieAnimation } from '../../game/dev/zombie-sprites.ts';
import { spriteCanvas } from '../../engine/sprite-cache.ts';
import PixelButton from '../PixelButton.vue';
import TitlePage from '../TitlePage.vue';

const props = withDefaults(defineProps<{ art?: ArtBook | null }>(), { art: null });
const emit = defineEmits<{ close: [] }>();

const SIZE = 192;
const SCALE = 3;
const types = props.art ? zombieTypes(props.art) : [];
const type = ref(types[0] ?? 'walker');
const facing = ref(2);
const canvases = new Map<ZombieAnimation, HTMLCanvasElement>();
let frame = 0;

function bind(animation: ZombieAnimation, el: HTMLCanvasElement | null): void {
  if (el) canvases.set(animation, el);
  else canvases.delete(animation);
}

function draw(time: number): void {
  const zombie = props.art?.zombies[type.value as keyof ArtBook['zombies']];
  if (zombie) {
    for (const [animation, canvas] of canvases) {
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;
      const sprite = frameAt(zombie, animation, facing.value, time / 1000);
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, SIZE, SIZE);
      // The anchor (the feet) sits low in the box so a lying body and a standing one both fit.
      ctx.drawImage(spriteCanvas(sprite), Math.round(SIZE / 2 - sprite.ax * SCALE), Math.round(SIZE * 0.75 - sprite.ay * SCALE), sprite.w * SCALE, sprite.h * SCALE);
    }
  }
  frame = requestAnimationFrame(draw);
}

onMounted(() => {
  frame = requestAnimationFrame(draw);
});
onBeforeUnmount(() => cancelAnimationFrame(frame));
</script>

<style scoped>
.sprites-layout { display: flex; flex-direction: column; gap: 12px; }
.sprites-row { display: flex; flex-wrap: wrap; gap: 6px; }
.sprites-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; }
.sprites-card { margin: 0; text-align: center; }
.sprites-canvas { image-rendering: pixelated; width: 100%; max-width: 192px; }
.is-active { outline: 2px solid #ffd24a; }
</style>
