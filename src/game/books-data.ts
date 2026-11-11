// Data definitions for the Books section library overlay.

import { changeIssues, issueLabel, PAPER_TITLE } from './changelog.ts';
import type { TitlePage } from './title-menu.ts';

export interface BookDef {
  readonly id: TitlePage;
  readonly number: string;
  readonly tag: string;
  readonly title: string;
  readonly subtitle: string;
  readonly description: string;
  readonly pagesCount: string;
}

const PAPER_ISSUES = changeIssues();

export const BOOKS_CATALOG: readonly BookDef[] = [
  {
    id: 'changelog',
    number: '01',
    tag: 'NEWSPAPER',
    title: PAPER_TITLE,
    subtitle: issueLabel(PAPER_ISSUES[0]),
    description: "The town's daily paper: every update to the game, one issue per day, with back issues to the very first night.",
    pagesCount: `${PAPER_ISSUES.length} Issues`,
  },
  {
    id: 'howto',
    number: '02',
    tag: 'MANUAL',
    title: 'How to Play',
    subtitle: 'Field Operations & Tactics',
    description: 'Controls, stealth movement, melee shoves, weapons, ammunition, search spots and the rules of the night.',
    pagesCount: '4 Pages',
  },
  {
    id: 'candy',
    number: '03',
    tag: 'MAGAZINE',
    title: 'Candy Magazine',
    subtitle: 'The Sweet Tooth - Issue #1',
    description: 'Full-color catalog of confections, sugar rush speed boosts, nutrition facts, and special combat perks.',
    pagesCount: '16 Pages',
  },
  {
    id: 'guide',
    number: '04',
    tag: 'FIELD GUIDE',
    title: 'Town Guide',
    subtitle: 'Sector Maps & Architecture',
    description: 'Architectural surveys of town landmarks, gas stations, supply points, barricades, and danger zones across sectors.',
    pagesCount: '19 Pages',
  },
  {
    id: 'records',
    number: '05',
    tag: 'ARCHIVES',
    title: 'Records',
    subtitle: 'The Survivors Ledger',
    description: 'Official tallies of best scores, horde wave survival records, kill counts, and expedition logs.',
    pagesCount: 'Ledger',
  },
];
