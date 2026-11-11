<template>
  <PaperSingleIssue v-if="selectedIssue" :issue="selectedIssue" @close="selectedIssue = null" />
  <PaperIssuesLayout v-else :issues="issues" :cover-src="coverUrl" @choose="openIssue" @close="emit('close')" />
</template>

<script setup lang="ts">
/** Noise in the Night: daily issues rack with 5 to a slide, opening into individual printed issue broadsheets. */
import { computed, onMounted, ref } from 'vue';
import { buildPaperCover } from '../art/books/paper-card.ts';
import type { ArtBook } from '../art/types.ts';
import { spriteDataUrl } from '../engine/sprite-cache.ts';
import { trackTitlePage } from '../game/analytics/index.ts';
import { changeIssues } from '../game/changelog.ts';
import type { ChangeIssue } from '../game/changelog.ts';
import PaperIssuesLayout from './changelog/PaperIssuesLayout.vue';
import PaperSingleIssue from './changelog/PaperSingleIssue.vue';

const props = defineProps<{
  version?: string;
  art?: ArtBook | null;
}>();

const emit = defineEmits<{ close: [] }>();

const issues = changeIssues();
const selectedIssue = ref<ChangeIssue | null>(null);

const coverUrl = computed(() => {
  const sprite = props.art?.ui.bookCovers?.changelog ?? buildPaperCover();
  return spriteDataUrl(sprite);
});

function openIssue(issue: ChangeIssue): void {
  selectedIssue.value = issue;
}

onMounted(() => trackTitlePage('changelog'));
</script>
