// Noise in the Night: the daily paper that opens from the version number on the title and leads the News Stand.
// The notes themselves live in change-notes.ts; add an update at the top of CHANGE_NOTES there. Every ship day is
// one issue, numbered like the version: 2026-11-07 prints as issue 26.11.7.

import { CHANGE_NOTES } from './change-notes.ts';
import type { ChangeKind, ChangeNote } from './change-notes.ts';

export { CHANGE_NOTES };
export type { ChangeKind, ChangeNote };

export const PAPER_TITLE = 'Noise in the Night';

export const KIND_LABELS: Readonly<Record<ChangeKind, string>> = { new: 'New', better: 'Better', fixed: 'Fixed' };

export type LeafColor = 'tomato' | 'teal' | 'violet' | 'mustard' | 'pink' | 'sky' | 'lime';

const COLORS: readonly LeafColor[] = ['tomato', 'teal', 'violet', 'mustard', 'pink', 'sky', 'lime'];

/** How many stories share a page after an issue's front page. */
export const STORIES_PER_LEAF = 2;

/** How many headlines the front page teases under its lead. */
export const INSIDE_HEADLINES = 5;

export interface ChangeIssue {
  /** Chronological issue sequence number: earliest is 1, newest is N. */
  readonly issueNumber: number;
  /** The version the day shipped as, YY.M.D. */
  readonly version: string;
  /** The day it shipped, YYYY-MM-DD. */
  readonly date: string;
  /** The day's first note, run as the front page headline. */
  readonly lead: ChangeNote;
  /** The rest of the day's notes, in order. */
  readonly stories: readonly ChangeNote[];
}

interface LeafBase {
  readonly id: string;
  readonly head: string;
  readonly color: LeafColor;
}

export type ChangeLeaf =
  | (LeafBase & { readonly kind: 'index' })
  | (LeafBase & { readonly kind: 'front'; readonly issue: ChangeIssue })
  | (LeafBase & { readonly kind: 'stories'; readonly issue: ChangeIssue; readonly notes: readonly ChangeNote[] });

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function dateParts(date: string): readonly number[] {
  return date.split('-').map(Number);
}

/** "7 Nov 2026" from "2026-11-07". */
export function noteDate(date: string): string {
  const [year, month, day] = dateParts(date);
  return `${day} ${MONTH_NAMES[month - 1]} ${year}`;
}

/** "26.11.7" from "2026-11-07": the issue number, read the way the version is written. */
export function issueVersion(date: string): string {
  const [year, month, day] = dateParts(date);
  return `${year % 100}.${month}.${day}`;
}

/** "Issue #4 (v26.11.10)". */
export function issueLabel(issue: ChangeIssue): string {
  return `Issue #${issue.issueNumber} (v${issue.version})`;
}

/** One issue per ship day, newest first, numbered chronologically from 1 (earliest day). */
export function changeIssues(notes: readonly ChangeNote[] = CHANGE_NOTES): readonly ChangeIssue[] {
  const byDate = new Map<string, ChangeNote[]>();
  for (const note of notes) {
    const day = byDate.get(note.date) ?? [];
    day.push(note);
    byDate.set(note.date, day);
  }
  const chronologicalDates = [...byDate.keys()].sort();
  const chronologicalIssues = chronologicalDates.map((date, index) => {
    const [lead, ...stories] = byDate.get(date) ?? [];
    return {
      issueNumber: index + 1,
      version: issueVersion(date),
      date,
      lead,
      stories,
    };
  });
  return chronologicalIssues.reverse();
}

/** How many issue cards fit on one slide in the portrait issues view. */
export const ISSUES_PER_SLIDE = 5;

export interface IssueCardDef {
  readonly id: string;
  readonly number: string;
  readonly tag: string;
  readonly title: string;
  readonly subtitle: string;
  readonly description: string;
  readonly pagesCount: string;
  readonly issue: ChangeIssue;
}

export function issueToCardDef(issue: ChangeIssue): IssueCardDef {
  const number = String(issue.issueNumber).padStart(2, '0');
  const leafCount = 1 + Math.ceil(issue.stories.length / STORIES_PER_LEAF);
  const storyCount = issue.stories.length + 1;
  return {
    id: issue.version,
    number,
    tag: `v${issue.version}`,
    title: issue.lead.title,
    subtitle: noteDate(issue.date),
    description: issue.lead.deck,
    pagesCount: `${leafCount} ${leafCount === 1 ? 'Page' : 'Pages'} • ${storyCount} Stories`,
    issue,
  };
}

/** The leaves for a single issue: front page first, then stories two to a page. */
export function issueLeaves(issue: ChangeIssue): readonly ChangeLeaf[] {
  const head = issueLabel(issue);
  const pages: ChangeLeaf[] = [{ kind: 'front', id: `front-${issue.version}`, head, color: 'tomato', issue }];
  for (let at = 0; at < issue.stories.length; at += STORIES_PER_LEAF) {
    const here = issue.stories.slice(at, at + STORIES_PER_LEAF);
    const color = COLORS[pages.length % COLORS.length];
    pages.push({ kind: 'stories', id: `stories-${here[0].id}`, head, color, issue, notes: here });
  }
  return pages;
}

/** The back issues index, then each issue: its front page, then its stories two to a page. */
export function changeLeaves(notes: readonly ChangeNote[] = CHANGE_NOTES): readonly ChangeLeaf[] {
  const pages: ChangeLeaf[] = [{ kind: 'index', id: 'index', head: 'Back Issues', color: 'tomato' }];
  const nextColor = (): LeafColor => COLORS[pages.length % COLORS.length];
  for (const issue of changeIssues(notes)) {
    const head = issueLabel(issue);
    pages.push({ kind: 'front', id: `front-${issue.version}`, head, color: nextColor(), issue });
    for (let at = 0; at < issue.stories.length; at += STORIES_PER_LEAF) {
      const here = issue.stories.slice(at, at + STORIES_PER_LEAF);
      pages.push({ kind: 'stories', id: `stories-${here[0].id}`, head, color: nextColor(), issue, notes: here });
    }
  }
  return pages;
}

/** The page an issue's front page is on, for the back issues index. Page 1 is the index. */
export function issuePage(version: string, notes: readonly ChangeNote[] = CHANGE_NOTES): number {
  const isIssueFront = (leaf: ChangeLeaf): boolean => leaf.kind === 'front' && leaf.issue.version === version;
  const at = changeLeaves(notes).findIndex(isIssueFront);
  return at < 0 ? 1 : at + 1;
}
