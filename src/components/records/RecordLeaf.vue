<template>
  <article ref="pageRef" class="mag-page rb-leaf" :class="[`mag-color-${leaf.color}`, `is-${side}`]">
    <header class="mag-running-head">
      <span>{{ RECORD_BOOK_TITLE }}</span>
      <span>{{ leaf.head }}</span>
    </header>

    <div class="mag-flow">
      <header class="mag-head">
        <p class="mag-head-kicker"><span class="mag-head-number">{{ folio }}</span>{{ KICKERS[leaf.id] }}</p>
        <h3 class="mag-head-title">{{ leaf.head }}</h3>
        <p class="mag-head-deck">{{ DECKS[leaf.id] }}</p>
      </header>

      <div v-if="leaf.id === 'bests'" class="rb-bests">
        <section v-for="section in book.sections" :key="section.style" class="rb-card" :aria-label="section.heading">
          <p class="rb-tab">{{ section.heading }}</p>
          <p class="rb-big">{{ section.stats[0].value }}<span class="rb-big-tag">{{ section.stats[0].tag }}</span></p>
          <dl class="rb-lines">
            <div v-for="stat in section.stats.slice(1)" :key="stat.tag" class="rb-line">
              <dt>{{ stat.tag }}</dt>
              <dd>{{ stat.value }}</dd>
            </div>
          </dl>
          <p v-if="section.stats[0].value === '0'" class="rb-stamp is-grey">No run yet</p>
        </section>
      </div>

      <table v-else-if="leaf.id === 'ledger'" class="rb-ledger">
        <thead>
          <tr>
            <th>#</th>
            <th class="is-name">Callsign</th>
            <th>Hordes</th>
            <th>Kills</th>
            <th>Time</th>
            <th>Date</th>
            <th class="is-score">Score</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in book.rows" :key="row.key">
            <td class="is-rank">{{ row.rank }}</td>
            <td class="is-name">
              {{ row.name }}<span class="rb-kind">{{ row.label }}</span>
            </td>
            <td>{{ row.hordes }}</td>
            <td>{{ row.kills }}</td>
            <td>{{ row.time }}</td>
            <td>{{ row.date }}</td>
            <td class="is-score">{{ row.score }}</td>
          </tr>
          <tr v-for="blank in blanks" :key="`blank-${blank}`" class="is-blank">
            <td class="is-rank">#{{ book.rows.length + blank }}</td>
            <td class="is-name">{{ blank === 1 && book.rows.length === 0 ? 'The first line is yours.' : '' }}</td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td class="is-score"></td>
          </tr>
        </tbody>
      </table>

      <div v-else-if="leaf.id === 'daily'" class="rb-daily">
        <section class="rb-ticket" aria-label="Tonight">
          <p class="rb-tab">Tonight, {{ book.daily.tonight.label }}</p>
          <p class="rb-ticket-title">{{ book.daily.tonight.title }}</p>
          <p class="rb-ticket-line">{{ book.daily.tonight.line }}</p>
          <p class="rb-ticket-line">
            {{ book.daily.tonight.played ? `Counted: ${book.daily.tonight.played.score} points` : 'Not played yet. The first run counts.' }}
          </p>
          <p v-if="book.daily.tonight.played" class="rb-stamp">Counted</p>
        </section>
        <dl class="rb-daily-stats">
          <div class="rb-daily-stat">
            <dt>Streak</dt>
            <dd class="rb-big">{{ book.daily.streak }}<span class="rb-big-tag">{{ book.daily.streak === 1 ? 'night in a row' : 'nights in a row' }}</span></dd>
          </div>
          <div class="rb-daily-stat">
            <dt>Best night</dt>
            <dd class="rb-big">
              {{ book.daily.best?.score ?? '-' }}
              <span class="rb-big-tag">{{ book.daily.best ? `${book.daily.best.label}, ${townName(book.daily.best.level)}` : 'None counted yet' }}</span>
            </dd>
          </div>
          <div class="rb-daily-stat">
            <dt>Nights logged</dt>
            <dd class="rb-big">{{ book.daily.nights }}<span class="rb-big-tag">kept on this device</span></dd>
          </div>
        </dl>
      </div>

      <div v-else-if="isStampLeaf" class="rb-stamps">
        <p class="rb-tab">{{ book.tally }}</p>
        <ul class="rb-stamp-grid">
          <li v-for="card in stampsHere" :key="card.id" class="rb-stamp-card" :class="{ 'is-earned': card.earned !== null }">
            <span class="rb-ring" :style="{ '--tilt': `${card.tilt}deg` }">
              <span class="rb-ring-name">{{ card.name }}</span>
              <span v-if="card.earned" class="rb-ring-date">{{ card.earned }}</span>
            </span>
            <span class="rb-ring-how">{{ card.how }}</span>
          </li>
        </ul>
      </div>

      <ol v-else class="rb-week">
        <li v-for="line in book.week" :key="line.key" class="rb-week-line">
          <span class="rb-week-day">
            <strong>{{ line.weekday }}</strong>
            {{ line.label }}
          </span>
          <span class="rb-week-detail">{{ line.detail }}</span>
          <span class="rb-week-score">{{ line.score }}</span>
          <span class="rb-stamp is-small" :class="`is-${line.stamp}`">{{ STAMPS[line.stamp] }}</span>
        </li>
      </ol>
    </div>

    <footer class="mag-folio">{{ folio }}</footer>
  </article>
</template>

<script setup lang="ts">
/** One leaf of the record book, laid out like a page of the How to Play magazine and fitted the same way. */
import { computed, useTemplateRef } from 'vue';
import { townName } from '../../../shared/levels.ts';
import { usePageFit } from '../../game/magazine-fit.ts';
import { RECORD_BOOK_TITLE } from '../../game/record-book.ts';
import type { DailySummary, Leaf, LeafId, StampCard, WeekLine } from '../../game/record-book.ts';
import type { RecordRow, RecordSection } from '../../game/title-menu.ts';

export interface RecordBookData {
  readonly sections: readonly RecordSection[];
  readonly rows: readonly RecordRow[];
  readonly daily: DailySummary;
  readonly week: readonly WeekLine[];
  readonly stamps: Readonly<Record<'stamps' | 'more_stamps', readonly StampCard[]>>;
  readonly tally: string;
}

interface LeafProps {
  leaf: Leaf;
  side: 'left' | 'right';
  folio: number;
  book: RecordBookData;
}

const { leaf, book } = defineProps<LeafProps>();

const KICKERS: Readonly<Record<LeafId, string>> = {
  bests: 'Your best',
  ledger: 'Top five',
  daily: 'One town a day',
  week: 'This week',
  stamps: 'Earned in play',
  more_stamps: 'The long haul',
};

const DECKS: Readonly<Record<LeafId, string>> = {
  bests: 'A Campaign trip and an Arcade run are never weighed against each other.',
  ledger: 'Every run worth writing down, best first.',
  daily: 'The same town for everyone, drawn fresh at midnight.',
  week: 'Only the first run of a day counts. The rest are practice.',
  stamps: 'Each one inked the day you earned it. An empty ring says how.',
  more_stamps: 'Bosses, bad nights and the road home.',
};

const STAMPS: Readonly<Record<WeekLine['stamp'], string>> = { counted: 'Counted', missed: 'Missed', open: 'Tonight' };

/** The ledger always shows five lines, ruled and waiting. */
const LEDGER_LINES = 5;
const blanks = computed(() => Array.from({ length: Math.max(0, LEDGER_LINES - book.rows.length) }, (_, index) => index + 1));

const isStampLeaf = computed(() => leaf.id === 'stamps' || leaf.id === 'more_stamps');
const stampsHere = computed(() => (leaf.id === 'more_stamps' ? book.stamps.more_stamps : book.stamps.stamps));

const pageRef = useTemplateRef<HTMLElement>('pageRef');
usePageFit(pageRef);
</script>
