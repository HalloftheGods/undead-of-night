<template>
  <div class="mag-flow cl-front">
    <header class="cl-masthead">
      <h3 class="cl-masthead-title">{{ PAPER_TITLE }}</h3>
      <p class="cl-dateline">
        <span class="mag-head-number">{{ folio }}</span>
        <span>{{ issueLabel(issue) }}</span>
        <span>{{ noteDate(issue.date) }}</span>
      </p>
    </header>
    <ChangeStory :note="issue.lead" lead />
    <aside v-if="hasStories" class="cl-inside" aria-label="Inside this issue">
      <p class="cl-inside-head">Inside</p>
      <ul class="cl-inside-list">
        <li v-for="story in teased" :key="story.id">
          <span class="cl-kind" :class="`is-${story.kind}`">{{ KIND_LABELS[story.kind] }}</span>
          {{ story.title }}
        </li>
      </ul>
      <p v-if="untold > 0" class="cl-inside-more">and {{ untold }} more inside</p>
    </aside>
  </div>
</template>

<script setup lang="ts">
/** An issue's front page: masthead, dateline, the lead story and a few headlines from inside. */
import { INSIDE_HEADLINES, issueLabel, KIND_LABELS, noteDate, PAPER_TITLE } from '../../game/changelog.ts';
import type { ChangeIssue } from '../../game/changelog.ts';
import ChangeStory from './ChangeStory.vue';

const { issue } = defineProps<{ issue: ChangeIssue; folio: number }>();

const hasStories = issue.stories.length > 0;
const teased = issue.stories.slice(0, INSIDE_HEADLINES);
const untold = issue.stories.length - teased.length;
</script>
