<template>
  <section class="px-title-scale mag-screen" :aria-label="CHANGELOG_TITLE" @pointerdown="pages.beginSwipe" @pointerup="pages.finishSwipe">
    <PrintedBook :book="open" :turn :mode :leaves>
      <template #page="{ leaf, side, folio }">
        <ChangeLeafPage :leaf :side :folio :notes="CHANGE_NOTES" :version @open="pages.goTo" />
      </template>
    </PrintedBook>

    <nav class="mag-nav" aria-label="Changelog pages">
      <MenuLink class="mag-nav-link" @press="emit('close')">Back</MenuLink>
      <span class="mag-nav-page" aria-live="polite">{{ label }}</span>
      <MenuLink class="mag-nav-link" silent :disabled="atStart" @press="pages.flipPages(-1)">Prev</MenuLink>
      <MenuLink class="mag-nav-link is-next" silent :disabled="atEnd" @press="pages.flipPages(1)">Next</MenuLink>
    </nav>
  </section>
</template>

<script setup lang="ts">
/** The changelog, opened from the version number on the title: what's new, as a printed book like Records. */
import { onMounted } from 'vue';
import { trackTitlePage } from '../game/analytics/index.ts';
import { CHANGE_NOTES, CHANGELOG_TITLE, changeLeaves } from '../game/changelog.ts';
import ChangeLeafPage from './changelog/ChangeLeafPage.vue';
import MenuLink from './MenuLink.vue';
import PrintedBook from './magazine/PrintedBook.vue';
import './magazine/magazine.css';
import './magazine/magazine-blocks.css';
import './records/record-book.css';
import './changelog/changelog.css';
import { useBookPages } from './use-book-pages.ts';
import { useGame } from './use-game.ts';

const { version } = defineProps<{ version: string }>();
const emit = defineEmits<{ close: [] }>();
const game = useGame();

const leaves = changeLeaves();
const pages = useBookPages(leaves, () => game.playUi('click'), () => emit('close'));
const { open, turn, mode, label, atStart, atEnd } = pages.view;

onMounted(() => trackTitlePage('changelog'));
</script>
