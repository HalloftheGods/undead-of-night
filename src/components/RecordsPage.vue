<template>
  <section class="px-title-scale mag-screen" aria-label="Records" @pointerdown="pages.beginSwipe" @pointerup="pages.finishSwipe">
    <PrintedBook :book="open" :turn :mode :leaves="RECORD_LEAVES">
      <template #page="{ leaf, side, folio }">
        <RecordLeaf :key="leaf.id" :leaf :side :folio :book />
      </template>
    </PrintedBook>

    <nav class="mag-nav" aria-label="Record book pages">
      <MenuLink class="mag-nav-link" @press="emit('close')">Back</MenuLink>
      <span class="mag-nav-page" aria-live="polite">{{ label }}</span>
      <MenuLink class="mag-nav-link" silent :disabled="atStart" @press="pages.flipPages(-1)">Prev</MenuLink>
      <MenuLink class="mag-nav-link is-next" silent :disabled="atEnd" @press="pages.flipPages(1)">Next</MenuLink>
    </nav>
  </section>
</template>

<script setup lang="ts">
/** Records as a printed record book: personal bests, the ledger, the Daily Night, the last seven nights and the stamps. */
import { computed, onMounted } from 'vue';
import { trackTitlePage } from '../game/analytics/index.ts';
import { loadDailyLog } from '../game/daily-night.ts';
import type { UiState } from '../game/hud-state.ts';
import { dailySummary, RECORD_LEAVES, stampCards, stampTally, weekLines } from '../game/record-book.ts';
import { loadStamps } from '../game/stamps.ts';
import { recordRows, recordSections } from '../game/title-menu.ts';
import MenuLink from './MenuLink.vue';
import PrintedBook from './magazine/PrintedBook.vue';
import RecordLeaf from './records/RecordLeaf.vue';
import type { RecordBookData } from './records/RecordLeaf.vue';
import './magazine/magazine.css';
import './magazine/magazine-blocks.css';
import './records/record-book.css';
import { useBookPages } from './use-book-pages.ts';
import { useGame } from './use-game.ts';

const { ui } = defineProps<{ ui: UiState }>();
const emit = defineEmits<{ close: [] }>();
const game = useGame();

const log = loadDailyLog();
const stampBook = loadStamps();
const book = computed<RecordBookData>(() => ({
  sections: recordSections(ui.best, ui.bestTrip),
  rows: recordRows(ui.leaderboard),
  daily: dailySummary(log),
  week: weekLines(log),
  stamps: { stamps: stampCards(stampBook, 'stamps'), more_stamps: stampCards(stampBook, 'more_stamps') },
  tally: stampTally(stampBook),
}));

const pages = useBookPages(RECORD_LEAVES, () => game.playUi('click'), () => emit('close'));
const { open, turn, mode, label, atStart, atEnd } = pages.view;

onMounted(() => trackTitlePage('records'));
</script>
