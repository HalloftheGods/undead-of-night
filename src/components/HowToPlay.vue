<template>
  <section class="px-title-scale mag-screen" aria-label="How to Play">
    <MagazineBook
      :book="view.book"
      :turn="view.turn"
      :mode="view.mode"
      @pointerdown="reader.beginSwipe"
      @pointerup="reader.finishSwipe"
    />
    <MagazineNav
      :label="view.label"
      :at-start="view.atStart"
      :at-end="view.atEnd"
      @back="emit('close')"
      @prev="reader.movePages(-1)"
      @next="reader.movePages(1)"
      @contents="reader.goToPage(CONTENTS_PAGE)"
    />
  </section>
</template>

<script setup lang="ts">
import { provide } from 'vue';
import { buildArtBook } from '../art/index.ts';
import { trackTitlePage } from '../game/analytics/index.ts';
import { isLevelUnlocked, loadFurthestProgress } from '../game/level-progress.ts';
import { MAGAZINE_LINKS, useMagazineReader } from '../game/magazine-controller.ts';
import { buildMagazine, CONTENTS_PAGE } from '../game/magazine-pages.ts';
import MagazineBook from './magazine/MagazineBook.vue';
import MagazineNav from './magazine/MagazineNav.vue';
import './magazine/magazine.css';
import './magazine/magazine-blocks.css';
import './magazine/magazine-figures.css';
import './magazine/magazine-galleries.css';
import './magazine/magazine-cover.css';
import './magazine/magazine-layouts.css';
import './magazine/magazine-landscape.css';
import { useGame } from './use-game.ts';

const emit = defineEmits<{ close: [] }>();
const game = useGame();
trackTitlePage('howto');
const progress = loadFurthestProgress();
const activeMap = game.currentMap ?? undefined;
const magazine = buildMagazine(buildArtBook(), (level) => isLevelUnlocked(level, progress), undefined, activeMap);
const reader = useMagazineReader(magazine, () => game.playUi('click'), () => emit('close'));
const view = reader.view;

provide(MAGAZINE_LINKS, { goToPage: reader.goToPage });
</script>
