<template>
  <section class="cl-note" :class="{ 'is-lead': lead }" :aria-label="note.title">
    <p class="mag-head-kicker">
      <span v-if="folio" class="mag-head-number">{{ folio }}</span>{{ noteDate(note.date) }}
    </p>
    <span class="rb-stamp cl-stamp" :class="`is-${note.kind}`">{{ KIND_LABELS[note.kind] }}</span>
    <h3 class="cl-title">{{ note.title }}</h3>
    <p class="mag-head-deck">{{ note.deck }}</p>
    <ul class="cl-points">
      <li v-for="point in note.points" :key="point">{{ point }}</li>
    </ul>
  </section>
</template>

<script setup lang="ts">
/** One story in the paper: the front page lead or a story inside. */
import { KIND_LABELS, noteDate } from '../../game/changelog.ts';
import type { ChangeNote } from '../../game/changelog.ts';

defineProps<{ note: ChangeNote; folio?: number; lead?: boolean }>();
</script>
