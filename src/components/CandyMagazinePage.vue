<template>
  <MagazineScreenSection
    :title="CANDY_MAGAZINE_TITLE"
    @pointerdown="pages.beginSwipe"
    @pointerup="pages.finishSwipe"
  >
    <PrintedBook
      class="cm-book"
      :class="{ 'is-cover': isCover, 'is-solo': isSolo }"
      :book="open"
      :turn="turn"
      :mode="mode"
      :leaves="leaves"
    >
      <template #page="{ leaf, side, folio }">
        <CandyLeafPage
          :key="leaf.id"
          :leaf="leaf"
          :side="side"
          :folio="folio"
          :art="art"
          @open="pages.goTo"
        />
      </template>
    </PrintedBook>

    <MagazineNavBar>
      <MenuLink class="mag-nav-link" @press="emit('close')">Back</MenuLink>
      <MagazineNavLabel :label="label" />
      <MenuLink
        class="mag-nav-link"
        silent
        :disabled="atStart"
        @press="pages.flipPages(-1)"
      >
        Prev
      </MenuLink>
      <MenuLink
        class="mag-nav-link is-next"
        silent
        :disabled="atEnd"
        @press="pages.flipPages(1)"
      >
        Next
      </MenuLink>
    </MagazineNavBar>
  </MagazineScreenSection>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { buildArtBook } from '../art/index.ts';
import { trackTitlePage } from '../game/analytics/index.ts';
import {
  CANDY_MAGAZINE_TITLE,
  candyMagazineLeaves,
} from '../game/candy-magazine-data.ts';
import MagazineNavBar from './candy-magazine/atoms/MagazineNavBar.vue';
import MagazineNavLabel from './candy-magazine/atoms/MagazineNavLabel.vue';
import MagazineScreenSection from './candy-magazine/atoms/MagazineScreenSection.vue';
import CandyLeafPage from './candy-magazine/templates/CandyLeafPage.vue';
import { useCandyMagazinePages } from './candy-magazine/use-candy-magazine-pages.ts';
import PrintedBook from './magazine/PrintedBook.vue';
import MenuLink from './MenuLink.vue';
import { useGame } from './use-game.ts';
import './candy-magazine/candy-magazine.css';

const emit = defineEmits<{ close: [] }>();

const game = useGame();
const art = buildArtBook();
const leaves = candyMagazineLeaves();

const onTurn = () => game.playUi('click');
const onClose = () => emit('close');
const pages = useCandyMagazinePages(leaves, onTurn, onClose);

const { open, turn, mode, label, atStart, atEnd, isCover, isSolo } = pages.view;

onMounted(() => trackTitlePage('candy'));
</script>
