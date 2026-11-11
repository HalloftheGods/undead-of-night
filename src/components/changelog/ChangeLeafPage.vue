<template>
  <article ref="pageRef" class="mag-page cl-leaf" :class="[`mag-color-${leaf.color}`, `is-${side}`]">
    <header class="mag-running-head">
      <span>{{ PAPER_TITLE }}</span>
      <span>{{ leaf.head }}</span>
    </header>

    <ChangeIndex v-if="leaf.kind === 'index'" :notes :version @open="emit('open', $event)" />
    <ChangeFront v-else-if="leaf.kind === 'front'" :issue="leaf.issue" :folio />
    <div v-else class="mag-flow cl-notes">
      <ChangeStory v-for="(note, index) in leaf.notes" :key="note.id" :note :folio="index === 0 ? folio : undefined" />
    </div>

    <footer class="mag-folio">{{ folio }}</footer>
  </article>
</template>

<script setup lang="ts">
/** One page of Noise in the Night: the back issues index, an issue's front page, or two stories. Fitted like How to Play. */
import { useTemplateRef } from 'vue';
import { PAPER_TITLE } from '../../game/changelog.ts';
import type { ChangeLeaf, ChangeNote } from '../../game/changelog.ts';
import { usePageFit } from '../../game/magazine-fit.ts';
import ChangeFront from './ChangeFront.vue';
import ChangeIndex from './ChangeIndex.vue';
import ChangeStory from './ChangeStory.vue';

interface ChangeLeafPageProps {
  leaf: ChangeLeaf;
  side: 'left' | 'right';
  folio: number;
  notes: readonly ChangeNote[];
  version: string;
}

defineProps<ChangeLeafPageProps>();
const emit = defineEmits<{ open: [index: number] }>();

const pageRef = useTemplateRef<HTMLElement>('pageRef');
usePageFit(pageRef);
</script>
