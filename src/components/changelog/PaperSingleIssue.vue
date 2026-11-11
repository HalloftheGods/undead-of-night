<template>
  <section class="px-title-scale mag-screen" :aria-label="issueLabel(issue)" @pointerdown="pages.beginSwipe" @pointerup="pages.finishSwipe">
    <PrintedBook :book="open" :turn :mode :leaves>
      <template #page="{ leaf, side, folio }">
        <ChangeLeafPage :key="leaf.id" :leaf :side :folio :notes="issue.stories" :version="issue.version" />
      </template>
    </PrintedBook>

    <nav class="mag-nav" aria-label="Issue pages">
      <MenuLink class="mag-nav-link" @press="emit('close')">Back</MenuLink>
      <span class="mag-nav-page" aria-live="polite">{{ label }}</span>
      <MenuLink class="mag-nav-link" silent :disabled="atStart" @press="pages.flipPages(-1)">Prev</MenuLink>
      <MenuLink class="mag-nav-link is-next" silent :disabled="atEnd" @press="pages.flipPages(1)">Next</MenuLink>
    </nav>
  </section>
</template>

<script setup lang="ts">
/** The printed newspaper reader for a single selected issue of Noise in the Night. */
import { issueLabel, issueLeaves } from '../../game/changelog.ts';
import type { ChangeIssue } from '../../game/changelog.ts';
import MenuLink from '../MenuLink.vue';
import PrintedBook from '../magazine/PrintedBook.vue';
import '../magazine/magazine.css';
import '../magazine/magazine-blocks.css';
import '../records/record-book.css';
import './changelog.css';
import { useBookPages } from '../use-book-pages.ts';
import { useGame } from '../use-game.ts';
import ChangeLeafPage from './ChangeLeafPage.vue';

const props = defineProps<{ issue: ChangeIssue }>();
const emit = defineEmits<{ close: [] }>();
const game = useGame();

const leaves = issueLeaves(props.issue);
const pages = useBookPages(leaves, () => game.playUi('click'), () => emit('close'));
const { open, turn, mode, label, atStart, atEnd } = pages.view;
</script>
