<template>
  <section class="px-title-scale mag-screen" :aria-label="TOWN_GUIDE_TITLE" @pointerdown="pages.beginSwipe" @pointerup="pages.finishSwipe">
    <PrintedBook :book="open" :turn :mode :leaves>
      <template #page="{ leaf, side, folio }">
        <GuideLeafPage :key="leaf.id" :leaf :leaves :art :side :folio @open="pages.goTo" />
      </template>
    </PrintedBook>

    <nav class="mag-nav" aria-label="Town Guide pages">
      <MenuLink class="mag-nav-link" @press="emit('close')">Back</MenuLink>
      <span class="mag-nav-page" aria-live="polite">{{ label }}</span>
      <MenuLink class="mag-nav-link" silent :disabled="atStart" @press="pages.flipPages(-1)">Prev</MenuLink>
      <MenuLink class="mag-nav-link is-next" silent :disabled="atEnd" @press="pages.flipPages(1)">Next</MenuLink>
    </nav>
  </section>
</template>

<script setup lang="ts">
/** The Town Guide, opened from the main menu: what each kind of building holds, as a printed book like the changelog. */
import { onMounted } from 'vue';
import { buildArtBook } from '../art/index.ts';
import { trackTitlePage } from '../game/analytics/index.ts';
import { guideLeaves, TOWN_GUIDE_TITLE } from '../game/town-guide.ts';
import GuideLeafPage from './guide/GuideLeafPage.vue';
import MenuLink from './MenuLink.vue';
import PrintedBook from './magazine/PrintedBook.vue';
import './magazine/magazine.css';
import './magazine/magazine-blocks.css';
import './records/record-book.css';
import './guide/town-guide.css';
import { useBookPages } from './use-book-pages.ts';
import { useGame } from './use-game.ts';

const emit = defineEmits<{ close: [] }>();
const game = useGame();
const art = buildArtBook();

const leaves = guideLeaves();
const pages = useBookPages(leaves, () => game.playUi('click'), () => emit('close'));
const { open, turn, mode, label, atStart, atEnd } = pages.view;

onMounted(() => trackTitlePage('guide'));
</script>
