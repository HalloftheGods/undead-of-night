<template><span hidden /></template>

<script setup lang="ts">
/**
 * The Noise in the Night issues rack drawn on the game canvas with the page kit (the "In-game menus" switch): five
 * portrait cards to a slide, and the lead of the card the pointer or keys are on, under them.
 */
import { computed, ref } from 'vue';
import type { PixelSprite } from '../../art/types.ts';
import type { PageCard, PageModel, PagePanel } from '../../engine/page-ui.ts';
import { ISSUES_PER_SLIDE, issueToCardDef, noteDate, PAPER_TITLE } from '../../game/changelog.ts';
import type { ChangeIssue } from '../../game/changelog.ts';
import { useCanvasPage } from '../use-canvas-page.ts';

const props = defineProps<{
  issues: readonly ChangeIssue[];
  cover: PixelSprite;
}>();

const emit = defineEmits<{
  choose: [issue: ChangeIssue];
  close: [];
}>();

/** The bitmap font has no middle dot, so the separator is a dash. */
function pageCount(text: string): string {
  return text.replace('·', '-');
}

const slideIndex = ref(0);
const highlight = ref(0);

const totalSlides = computed(() => Math.max(1, Math.ceil(props.issues.length / ISSUES_PER_SLIDE)));

const shown = computed<readonly ChangeIssue[]>(() => {
  const start = slideIndex.value * ISSUES_PER_SLIDE;
  return props.issues.slice(start, start + ISSUES_PER_SLIDE);
});

const cards = computed<readonly PageCard[]>(() =>
  shown.value.map((issue) => {
    const card = issueToCardDef(issue);
    return { id: issue.date, badge: card.number, tag: card.tag, art: props.cover, caption: card.subtitle, detail: pageCount(card.pagesCount) };
  }),
);

const featured = computed<ChangeIssue | undefined>(() => shown.value[highlight.value] ?? shown.value[0]);

const panels = computed<readonly PagePanel[]>(() => {
  const rack: PagePanel = {
    heading: `Issues ${slideIndex.value + 1} of ${totalSlides.value}`,
    items: [{ kind: 'cards', id: 'issues', cards: cards.value }],
  };
  const issue = featured.value;
  if (!issue) return [rack];
  return [
    rack,
    {
      heading: issue.lead.title,
      items: [
        { kind: 'text', text: issue.lead.deck, tone: 'dim' },
        { kind: 'stat', label: 'Released', value: noteDate(issue.date) },
        { kind: 'stat', label: 'Issue', value: `No. ${issue.issueNumber}` },
        { kind: 'stat', label: 'Coverage', value: pageCount(issueToCardDef(issue).pagesCount) },
      ],
    },
  ];
});

const model = computed<PageModel>(() => ({
  heading: PAPER_TITLE,
  width: 420,
  panels: panels.value,
  buttons: [
    { id: 'back', label: 'Back', enabled: true, primary: false },
    { id: 'prev', label: 'Prev Issues', enabled: slideIndex.value > 0, primary: false },
    { id: 'next', label: 'Next Issues', enabled: slideIndex.value < totalSlides.value - 1, primary: false },
  ],
}));

function press(id: string): void {
  if (id === 'back') {
    emit('close');
    return;
  }
  if (id === 'prev' && slideIndex.value > 0) {
    slideIndex.value -= 1;
    highlight.value = 0;
  } else if (id === 'next' && slideIndex.value < totalSlides.value - 1) {
    slideIndex.value += 1;
    highlight.value = 0;
  }
}

function choose(id: string, option: string): void {
  if (id !== 'issues') return;
  const issue = props.issues.find((each) => each.date === option);
  if (issue) emit('choose', issue);
}

function card(_id: string, index: number): void {
  highlight.value = index;
}

useCanvasPage(model, { press, choose, card }, () => emit('close'));
</script>
