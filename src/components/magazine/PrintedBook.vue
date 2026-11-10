<template>
  <div class="mag-book" :class="[`is-${mode}`, { 'is-solo': shown.solo !== null }]">
    <div ref="openRef" class="mag-open rb-open" :class="{ 'is-solo': shown.solo !== null }">
      <slot v-if="shown.solo" name="page" :leaf="shown.solo" side="left" :folio="folioOf(shown.solo)" />
      <template v-else>
        <slot v-if="shown.left" name="page" :leaf="shown.left" side="left" :folio="folioOf(shown.left)" />
        <slot v-if="shown.right" name="page" :leaf="shown.right" side="right" :folio="folioOf(shown.right)" />
      </template>
    </div>

    <div v-if="turn" :key="turnKey" class="mag-leaf" :class="[`is-${turn.leaf}`, `is-${turn.direction}`]" aria-hidden="true">
      <div class="mag-leaf-face">
        <slot name="page" :leaf="turn.front" :side="turn.leaf === 'left' ? 'left' : 'right'" :folio="folioOf(turn.front)" />
      </div>
      <div v-if="turn.back" class="mag-leaf-face is-back">
        <slot name="page" :leaf="turn.back" :side="turn.leaf === 'left' ? 'right' : 'left'" :folio="folioOf(turn.back)" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts" generic="T extends { readonly id: string }">
import { computed, useTemplateRef, watch } from 'vue';
import type { BookMode, BookTurn, OpenLeaves } from '../../game/book-turn.ts';
import { fitSpread } from '../../game/magazine-fit.ts';

defineSlots<{
  page(props: { leaf: T; side: 'left' | 'right'; folio: number }): unknown;
}>();

const props = defineProps<{
  book: OpenLeaves<T>;
  turn: BookTurn<T> | null;
  mode: BookMode;
  leaves: readonly T[];
}>();

const openRef = useTemplateRef<HTMLElement>('openRef');
const shown = computed(() => props.turn?.under ?? props.book);
const turnKey = computed(() => `${props.turn?.front.id}-${props.turn?.back?.id ?? 'none'}-${props.turn?.direction}`);

function folioOf(leaf: T): number {
  return props.leaves.indexOf(leaf) + 1;
}

watch(
  [() => props.turn, () => shown.value],
  ([turn]) => {
    const isResting = turn === null;
    if (isResting && openRef.value) {
      fitSpread(openRef.value);
    }
  },
  { flush: 'post' },
);
</script>
