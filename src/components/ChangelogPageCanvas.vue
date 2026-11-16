<template>
  <ChangelogReaderCanvas v-if="selectedIssue" :key="selectedIssue.date" :issue="selectedIssue" :issues="issues" @turn="openIssue" @close="selectedIssue = null" />
  <ChangelogRackCanvas v-else :issues="issues" :cover="cover" @choose="openIssue" @close="emit('close')" />
</template>

<script setup lang="ts">
/**
 * Noise in the Night on the game canvas (the "In-game menus" switch): the issues rack, and each issue opened as a
 * printed sheet to turn.
 */
import { computed, onMounted, ref } from 'vue';
import { buildPaperCover } from '../art/books/paper-card.ts';
import type { ArtBook } from '../art/types.ts';
import { trackTitlePage } from '../game/analytics/index.ts';
import { changeIssues } from '../game/changelog.ts';
import type { ChangeIssue } from '../game/changelog.ts';
import ChangelogRackCanvas from './changelog/ChangelogRackCanvas.vue';
import ChangelogReaderCanvas from './changelog/ChangelogReaderCanvas.vue';

const props = defineProps<{
  art?: ArtBook | null;
}>();

const emit = defineEmits<{ close: [] }>();

const issues = changeIssues();
const selectedIssue = ref<ChangeIssue | null>(null);
const cover = computed(() => props.art?.ui.bookCovers?.changelog ?? buildPaperCover());

function openIssue(issue: ChangeIssue): void {
  selectedIssue.value = issue;
}

onMounted(() => trackTitlePage('changelog'));
</script>
