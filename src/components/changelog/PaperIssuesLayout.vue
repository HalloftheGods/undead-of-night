<template>
  <TitlePage :heading="PAPER_TITLE" bare boxed @close="emit('close')">
    <template #lead>
      <div class="issues-rack-container">
        <BooksGridAtom>
          <BookStopAtom v-for="card in currentCards" :key="card.id">
            <BookCardButton
              :ariaLabel="`Open ${card.title}: ${card.subtitle}`"
              :active="activeCardId === card.id"
              @press="onChoose(card)"
              @hover="onHover(card.id)"
              @unhover="onUnhover"
            >
              <BookCardHead :number="card.number" :tag="card.tag" />
              <BookCardArt :src="coverSrc" :title="card.title" />
              <BookCardFoot :subtitle="card.subtitle" :pages-count="card.pagesCount" />
            </BookCardButton>
          </BookStopAtom>
        </BooksGridAtom>

        <nav v-if="totalSlides > 1" class="issues-slide-nav" aria-label="Issue slides">
          <MenuLink class="issues-nav-btn" silent :disabled="slideIndex === 0" @press="prevSlide">Prev Issues</MenuLink>
          <span class="issues-nav-indicator" aria-live="polite">Slide {{ slideIndex + 1 }} of {{ totalSlides }}</span>
          <MenuLink class="issues-nav-btn is-next" silent :disabled="slideIndex >= totalSlides - 1" @press="nextSlide">Next Issues</MenuLink>
        </nav>
      </div>
    </template>

    <BooksFeaturedAtom
      :title="featured.title"
      :subtitle="featured.subtitle"
      :description="featured.description"
      :tag="featured.tag"
      :pages-count="featured.pagesCount"
    />
  </TitlePage>
</template>

<script setup lang="ts">
/** The portrait-style issues rack: 5 issues to a slide, showing lead story, date, and issue number. */
import { computed, ref } from 'vue';
import { ISSUES_PER_SLIDE, issueToCardDef, PAPER_TITLE } from '../../game/changelog.ts';
import type { ChangeIssue, IssueCardDef } from '../../game/changelog.ts';
import BookCardArt from '../books/atoms/BookCardArt.vue';
import BookCardButton from '../books/atoms/BookCardButton.vue';
import BookCardFoot from '../books/atoms/BookCardFoot.vue';
import BookCardHead from '../books/atoms/BookCardHead.vue';
import BooksFeaturedAtom from '../books/atoms/BooksFeaturedAtom.vue';
import BooksGridAtom from '../books/atoms/BooksGridAtom.vue';
import BookStopAtom from '../books/atoms/BookStopAtom.vue';
import '../books/books.css';
import MenuLink from '../MenuLink.vue';
import TitlePage from '../TitlePage.vue';
import { useGame } from '../use-game.ts';
import './changelog.css';

const props = defineProps<{
  issues: readonly ChangeIssue[];
  coverSrc?: string;
}>();

const emit = defineEmits<{
  choose: [issue: ChangeIssue];
  close: [];
}>();

const game = useGame();
const slideIndex = ref(0);
const hoveredId = ref<string | null>(null);

const allCards = computed<readonly IssueCardDef[]>(() => {
  return props.issues.map(issueToCardDef);
});

const totalSlides = computed(() => {
  const count = allCards.value.length;
  return Math.max(1, Math.ceil(count / ISSUES_PER_SLIDE));
});

const currentCards = computed<readonly IssueCardDef[]>(() => {
  const start = slideIndex.value * ISSUES_PER_SLIDE;
  return allCards.value.slice(start, start + ISSUES_PER_SLIDE);
});

const activeCardId = computed(() => {
  return hoveredId.value ?? currentCards.value[0]?.id ?? null;
});

const featured = computed<IssueCardDef>(() => {
  const targetId = activeCardId.value;
  const match = targetId ? allCards.value.find((card) => card.id === targetId) : undefined;
  return match ?? allCards.value[0];
});

function onChoose(card: IssueCardDef): void {
  game.playUi('click');
  emit('choose', card.issue);
}

function onHover(id: string): void {
  const isSame = hoveredId.value === id;
  if (isSame) return;
  game.playUi('hover');
  hoveredId.value = id;
}

function onUnhover(): void {
  hoveredId.value = null;
}

function prevSlide(): void {
  const isAtFirst = slideIndex.value <= 0;
  if (isAtFirst) return;
  game.playUi('click');
  slideIndex.value -= 1;
  hoveredId.value = null;
}

function nextSlide(): void {
  const isAtLast = slideIndex.value >= totalSlides.value - 1;
  if (isAtLast) return;
  game.playUi('click');
  slideIndex.value += 1;
  hoveredId.value = null;
}
</script>
