<template><span hidden /></template>

<script setup lang="ts">
/**
 * The zombie sprite viewer drawn on the game canvas with the page kit (the "In-game menus" switch): pick a type and a
 * facing, and each animation plays as the icon on its own row.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import type { ArtBook } from '../../art/types.ts';
import type { PageModel } from '../../engine/page-ui.ts';
import { FACINGS, ZOMBIE_ANIMATIONS, frameAt, zombieTypes } from '../../game/dev/zombie-sprites.ts';
import { useCanvasPage } from '../use-canvas-page.ts';

const props = withDefaults(defineProps<{ art?: ArtBook | null }>(), { art: null });
const emit = defineEmits<{ close: [] }>();

const types = props.art ? zombieTypes(props.art) : [];
const type = ref(types[0] ?? 'walker');
const facing = ref('2');
/** Seconds since the page opened; the rows redraw from it about ten times a second. */
const clock = ref(0);
const opened = performance.now();
let timer = 0;

onMounted(() => {
  timer = window.setInterval(() => {
    clock.value = (performance.now() - opened) / 1000;
  }, 100);
});
onBeforeUnmount(() => window.clearInterval(timer));

const model = computed<PageModel>(() => {
  const zombie = props.art?.zombies[type.value as keyof ArtBook['zombies']];
  return {
    heading: 'Dev: Zombie Sprites',
    panels: [
      {
        heading: 'Zombie',
        items: [
          { kind: 'choice', id: 'type', label: 'Type', options: types.map((t) => ({ id: t, label: t })), value: type.value },
          { kind: 'choice', id: 'facing', label: 'Facing', options: FACINGS.map((f, i) => ({ id: String(i), label: f })), value: facing.value },
        ],
      },
      {
        heading: 'Animations',
        items: zombie
          ? ZOMBIE_ANIMATIONS.map((a) => ({ kind: 'link' as const, id: `anim:${a}`, label: a, icon: frameAt(zombie, a, Number(facing.value), clock.value) }))
          : [{ kind: 'text' as const, text: 'The art is still loading.', tone: 'dim' as const }],
      },
    ],
    buttons: [{ id: 'back', label: 'Back', enabled: true, primary: false }],
  };
});

function press(id: string): void {
  if (id === 'back') emit('close');
}

function choose(id: string, option: string): void {
  if (id === 'type') type.value = option;
  else if (id === 'facing') facing.value = option;
}

useCanvasPage(model, { press, choose }, () => emit('close'));
</script>
