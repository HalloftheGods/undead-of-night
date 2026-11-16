<template><span hidden /></template>

<script setup lang="ts">
/**
 * One printed issue of Noise in the Night drawn on the game canvas with the page kit (the "In-game menus" switch), as
 * a newsprint sheet: the front page first, then the inside stories two to a page, turned with Prev and Next Page.
 * Prev and Next Issue step through the paper's issues, oldest to newest.
 */
import { computed, ref } from 'vue';
import type { PageItem, PageModel, PagePanel } from '../../engine/page-ui.ts';
import { issueLeaves, KIND_LABELS, noteDate, PAPER_TITLE } from '../../game/changelog.ts';
import type { ChangeIssue, ChangeLeaf, ChangeNote } from '../../game/changelog.ts';
import { useCanvasPage } from '../use-canvas-page.ts';

const props = defineProps<{ issue: ChangeIssue; issues: readonly ChangeIssue[] }>();
const emit = defineEmits<{
  close: [];
  turn: [issue: ChangeIssue];
}>();

const leaves = computed<readonly ChangeLeaf[]>(() => issueLeaves(props.issue));
const pageAt = ref(0);
const lastPage = computed(() => Math.max(0, leaves.value.length - 1));

/** The issues in order, oldest first, so Prev is the older paper and Next the newer one. */
const ordered = computed<readonly ChangeIssue[]>(() => [...props.issues].reverse());
const at = computed(() => ordered.value.findIndex((each) => each.date === props.issue.date));
const older = computed<ChangeIssue | undefined>(() => (at.value > 0 ? ordered.value[at.value - 1] : undefined));
const newer = computed<ChangeIssue | undefined>(() => ordered.value[at.value + 1]);

function pointLines(points: readonly string[]): PageItem[] {
  return points.map((point): PageItem => ({ kind: 'text', text: `- ${point}`, tone: 'bone' }));
}

function notePanel(note: ChangeNote): PagePanel {
  const items: PageItem[] = [
    { kind: 'stat', label: 'Kind', value: KIND_LABELS[note.kind] },
    { kind: 'text', text: note.deck, tone: 'accent' },
    ...pointLines(note.points),
  ];
  return { heading: note.title, items };
}

function frontPanels(leaf: Extract<ChangeLeaf, { kind: 'front' }>): PagePanel[] {
  const { issue } = leaf;
  const lead: PageItem[] = [
    { kind: 'stat', label: 'Released', value: noteDate(issue.date) },
    { kind: 'stat', label: 'Issue', value: `No. ${issue.issueNumber}` },
    { kind: 'text', text: issue.lead.deck, tone: 'accent' },
    ...pointLines(issue.lead.points),
  ];
  const inside: PageItem[] = issue.stories.length
    ? issue.stories.map((story): PageItem => ({ kind: 'text', text: `- ${story.title}`, tone: 'bone' }))
    : [{ kind: 'text', text: 'No inside stories.', tone: 'dim' }];
  return [
    { heading: issue.lead.title, items: lead },
    { heading: 'Inside', items: inside },
  ];
}

const pages = computed<readonly PagePanel[][]>(() =>
  leaves.value.map((leaf) => (leaf.kind === 'front' ? frontPanels(leaf) : leaf.kind === 'stories' ? leaf.notes.map(notePanel) : [])),
);

const model = computed<PageModel>(() => {
  const panels = pages.value[pageAt.value] ?? [];
  const pageStat: PageItem = { kind: 'stat', label: 'Page', value: `${pageAt.value + 1} of ${leaves.value.length}` };
  const [first, ...rest] = panels;
  const shown: PagePanel[] = first ? [{ heading: first.heading, items: [pageStat, ...first.items] }, ...rest] : [];
  // The easter egg: the byline on the last page is the typeface's own name.
  const isLastPage = pageAt.value === lastPage.value;
  const last = shown[shown.length - 1];
  if (isLastPage && last) {
    shown[shown.length - 1] = {
      heading: last.heading,
      items: [...last.items, { kind: 'text', text: 'Words and type by Apple Kid.', tone: 'dim' }, { kind: 'logo' }],
    };
  }
  return {
    heading: PAPER_TITLE,
    paper: { masthead: pageAt.value === 0 },
    panels: shown,
    buttons: [
      { id: 'prevIssue', label: 'Prev Issue', enabled: older.value !== undefined, primary: false },
      { id: 'prev', label: 'Prev Page', enabled: pageAt.value > 0, primary: false },
      { id: 'back', label: 'Back', enabled: true, primary: false },
      { id: 'next', label: 'Next Page', enabled: pageAt.value < lastPage.value, primary: false },
      { id: 'nextIssue', label: 'Next Issue', enabled: newer.value !== undefined, primary: false },
    ],
  };
});

function press(id: string): void {
  if (id === 'back') emit('close');
  else if (id === 'prev' && pageAt.value > 0) pageAt.value -= 1;
  else if (id === 'next' && pageAt.value < lastPage.value) pageAt.value += 1;
  else if (id === 'prevIssue' && older.value) emit('turn', older.value);
  else if (id === 'nextIssue' && newer.value) emit('turn', newer.value);
}

useCanvasPage(model, { press }, () => emit('close'));
</script>
