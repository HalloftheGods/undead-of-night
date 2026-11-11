<template>
  <div class="mag-flow cl-index">
    <header class="cl-masthead">
      <h3 class="cl-masthead-title">{{ PAPER_TITLE }}</h3>
      <p class="mag-head-deck">The town's daily paper. One issue for every day the town changed.</p>
    </header>
    <p class="cl-version">v{{ version }}</p>
    <p class="cl-inside-head">Back Issues</p>
    <ol class="cl-contents">
      <li v-for="row in rows" :key="row.issue.version">
        <button class="cl-contents-line" type="button" @click="emit('open', row.page - 1)">
          <span class="cl-issue-number">{{ row.issue.version }}</span>
          <span class="cl-contents-title">{{ row.issue.lead.title }}</span>
          <span class="cl-contents-page">{{ row.page }}</span>
        </button>
      </li>
    </ol>
  </div>
</template>

<script setup lang="ts">
/** The paper's first page: the masthead, the running version and every back issue with the page it starts on. */
import { changeIssues, issuePage, PAPER_TITLE } from '../../game/changelog.ts';
import type { ChangeIssue, ChangeNote } from '../../game/changelog.ts';

const { notes } = defineProps<{ notes: readonly ChangeNote[]; version: string }>();
const emit = defineEmits<{ open: [index: number] }>();

const toRow = (issue: ChangeIssue) => ({ issue, page: issuePage(issue.version, notes) });
const rows = changeIssues(notes).map(toRow);
</script>
