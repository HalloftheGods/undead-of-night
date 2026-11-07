<template>
  <article ref="pageRef" class="mag-page cl-leaf" :class="[`mag-color-${leaf.color}`, `is-${side}`]">
    <header class="mag-running-head">
      <span>{{ CHANGELOG_TITLE }}</span>
      <span>{{ leaf.head }}</span>
    </header>

    <div v-if="leaf.kind === 'front'" class="mag-flow cl-front">
      <header class="mag-head">
        <p class="mag-head-kicker"><span class="mag-head-number">{{ folio }}</span>Patch notes</p>
        <h3 class="mag-head-title">{{ CHANGELOG_TITLE }}</h3>
        <p class="mag-head-deck">Everything new in town since the last time you looked.</p>
      </header>
      <p class="cl-version">v{{ version }}</p>
      <ol class="cl-contents">
        <li v-for="note in notes" :key="note.id">
          <button class="cl-contents-line" type="button" @click="emit('open', notePage(note.id, notes) - 1)">
            <span class="cl-kind" :class="`is-${note.kind}`">{{ KIND_LABELS[note.kind] }}</span>
            <span class="cl-contents-title">{{ note.title }}</span>
            <span class="cl-contents-page">{{ notePage(note.id, notes) }}</span>
          </button>
        </li>
      </ol>
    </div>

    <div v-else class="mag-flow cl-notes">
      <section v-for="(note, index) in leaf.notes" :key="note.id" class="cl-note" :aria-label="note.title">
        <p class="mag-head-kicker">
          <span v-if="index === 0" class="mag-head-number">{{ folio }}</span>{{ noteDate(note.date) }}
        </p>
        <span class="rb-stamp cl-stamp" :class="`is-${note.kind}`">{{ KIND_LABELS[note.kind] }}</span>
        <h3 class="cl-title">{{ note.title }}</h3>
        <p class="mag-head-deck">{{ note.deck }}</p>
        <ul class="cl-points">
          <li v-for="point in note.points" :key="point">{{ point }}</li>
        </ul>
      </section>
    </div>

    <footer class="mag-folio">{{ folio }}</footer>
  </article>
</template>

<script setup lang="ts">
/** One page of the changelog: the front page with its contents, or two notes. Laid out like How to Play and fitted the same way. */
import { useTemplateRef } from 'vue';
import { CHANGELOG_TITLE, KIND_LABELS, notePage, noteDate } from '../../game/changelog.ts';
import type { ChangeLeaf, ChangeNote } from '../../game/changelog.ts';
import { usePageFit } from '../../game/magazine-fit.ts';

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
