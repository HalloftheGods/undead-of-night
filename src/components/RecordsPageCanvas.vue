<template><span hidden /></template>

<script setup lang="ts">
/**
 * Records drawn on the game canvas with the page kit instead of the printed record book (the "In-game menus" switch):
 * the personal bests, the ledger, the Nightly Run, the last seven nights and the stamps, as panels that scroll.
 */
import { computed } from 'vue';
import { townName } from '../../shared/levels.ts';
import type { PageItem, PageModel, PagePanel } from '../engine/page-ui.ts';
import { loadDailyLog } from '../game/daily-night.ts';
import type { UiState } from '../game/hud-state.ts';
import { dailySummary, stampCards, stampTally, weekLines } from '../game/record-book.ts';
import { loadStamps } from '../game/stamps.ts';
import { recordRows, recordSections } from '../game/title-menu.ts';
import { useCanvasPage } from './use-canvas-page.ts';

const { ui } = defineProps<{ ui: UiState }>();
const emit = defineEmits<{ close: [] }>();

const log = loadDailyLog();
const stampBook = loadStamps();

const STAMP_WORDS = { counted: 'Counted', missed: 'Missed', open: 'Open' } as const;

const panels = computed<readonly PagePanel[]>(() => {
  const daily = dailySummary(log);
  const best = daily.best ? `${daily.best.score} (${daily.best.label}, ${townName(daily.best.level)})` : 'None counted';
  const bestMp = daily.bestMp ? `${daily.bestMp.teamScore} (${daily.bestMp.label}, ${daily.bestMp.partySize}P)` : 'None counted';
  const rows = recordRows(ui.leaderboard);
  const ledger: readonly PageItem[] = rows.length
    ? rows.map((row) => ({ kind: 'stat', label: `${row.rank} ${row.name} - ${row.label}`, value: `${row.score} - ${row.hordes} hordes - ${row.kills} kills - ${row.time} - ${row.date}` }))
    : [{ kind: 'text', text: 'No runs on the ledger yet.', tone: 'dim' }];
  const stamps = [...stampCards(stampBook, 'stamps'), ...stampCards(stampBook, 'more_stamps')];
  return [
    ...recordSections(ui.best, ui.bestTrip).map((section) => ({
      heading: section.heading,
      items: section.stats.map((stat): PageItem => ({ kind: 'stat', label: stat.tag, value: stat.value })),
    })),
    { heading: 'Ledger', items: ledger },
    {
      heading: 'Nightly Run',
      items: [
        { kind: 'stat', label: 'Streak', value: daily.streak === 1 ? '1 night' : `${daily.streak} nights` },
        { kind: 'stat', label: 'Best solo', value: best },
        { kind: 'stat', label: 'Best MP team', value: bestMp },
        { kind: 'stat', label: 'Nights logged', value: String(daily.nights) },
        { kind: 'text', text: `${daily.tonight.label}: ${daily.tonight.line}`, tone: 'dim' },
      ],
    },
    {
      heading: 'Last seven nights',
      items: weekLines(log).map((line): PageItem => ({
        kind: 'stat',
        label: `${line.weekday} ${line.label}`,
        value: [line.score, line.detail, STAMP_WORDS[line.stamp]].filter((part) => part !== '').join(' - '),
      })),
    },
    {
      heading: `Stamps ${stampTally(stampBook)}`,
      items: stamps.map((card): PageItem => ({ kind: 'stat', label: card.name, value: card.earned ?? card.how })),
    },
  ];
});

const model = computed<PageModel>(() => ({
  heading: "Survivor's Record Book",
  panels: panels.value,
  buttons: [{ id: 'back', label: 'Back', enabled: true, primary: false }],
}));

useCanvasPage(model, { press: () => emit('close') }, () => emit('close'));
</script>
