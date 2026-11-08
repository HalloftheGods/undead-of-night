<template>
  <section class="px-title-scale mag-screen" :aria-label="TOWN_GUIDE_TITLE" @pointerdown="pages.beginSwipe" @pointerup="pages.finishSwipe">
    <div class="mag-book" :class="`is-${mode}`">
      <div :key="shownKey" class="mag-open rb-open" :class="{ 'is-solo': mode === 'single' }">
        <GuideLeafPage
          v-for="(leaf, index) in shown"
          :key="leaf.id"
          :leaf
          :leaves
          :art
          :side="mode === 'single' || index === 0 ? 'left' : 'right'"
          :folio="firstFolio + index"
          @open="pages.goTo"
        />
      </div>
    </div>

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
const { mode, shown, shownKey, label, atStart, atEnd, firstFolio } = pages.view;

onMounted(() => trackTitlePage('guide'));
</script>
