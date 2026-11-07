<template>
  <section class="px-title-scale mag-screen" :aria-label="CHANGELOG_TITLE" @pointerdown="pages.beginSwipe" @pointerup="pages.finishSwipe">
    <div class="mag-book" :class="`is-${mode}`">
      <div :key="shownKey" class="mag-open rb-open" :class="{ 'is-solo': mode === 'single' }">
        <ChangeLeafPage
          v-for="(leaf, index) in shown"
          :key="leaf.id"
          :leaf
          :side="mode === 'single' || index === 0 ? 'left' : 'right'"
          :folio="firstFolio + index"
          :notes="CHANGE_NOTES"
          :version
          @open="pages.goTo"
        />
      </div>
    </div>

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
const { mode, shown, shownKey, label, atStart, atEnd, firstFolio } = pages.view;

onMounted(() => trackTitlePage('changelog'));
</script>
