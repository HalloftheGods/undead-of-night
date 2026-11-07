<template>
  <section class="px-screen px-title-scale px-page" :aria-label="heading">
    <div class="px-sheet px-frame" :class="{ 'is-wide': size === 'wide', 'is-extra-wide': size === 'extra-wide', 'is-steady': steady }">
      <h2 class="px-heading px-sheet-heading">{{ heading }}</h2>
      <slot name="lead" />
      <div class="px-sheet-body">
        <slot />
      </div>
      <div class="px-sheet-foot">
        <PixelButton v-if="boxed" class="px-sheet-back" @press="emit('close')">Back</PixelButton>
        <MenuLink v-else @press="emit('close')">Back</MenuLink>
        <div class="px-sheet-actions">
          <slot name="actions" />
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue';
import { isConfirmKey } from '../game/title-menu.ts';
import MenuLink from './MenuLink.vue';
import PixelButton from './PixelButton.vue';

interface TitlePageProps {
  heading: string;
  size?: 'normal' | 'wide' | 'extra-wide';
  /** Back as a boxed button, to sit level with boxed Next and Start buttons. */
  boxed?: boolean;
  /** One height for every step of a walk, so the sheet and its buttons stay put as the steps change. */
  steady?: boolean;
}

withDefaults(defineProps<TitlePageProps>(), { size: 'normal', boxed: false, steady: false });
const emit = defineEmits<{ close: [] }>();

function onKey(event: KeyboardEvent): void {
  // An Enter held down must not ride focus into the button that starts a run.
  const heldEnter = isConfirmKey(event.code) && event.repeat;
  const leaving = event.code === 'Escape' && !event.repeat;
  if (heldEnter) event.preventDefault();
  if (leaving) emit('close');
}

onMounted(() => window.addEventListener('keydown', onKey));
onBeforeUnmount(() => window.removeEventListener('keydown', onKey));
</script>
