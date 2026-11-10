// Data definitions for the Books section library overlay.

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

export const BOOKS_CATALOG: readonly BookDef[] = [
  {
    id: 'howto',
    number: '01',
    tag: 'MANUAL',
    title: 'How to Play',
    subtitle: 'Field Operations & Tactics',
    description: 'Controls, stealth movement, melee shoves, weapons, ammunition, search spots and the rules of the night.',
    pagesCount: '4 Pages',
  },
  {
    id: 'candy',
    number: '02',
    tag: 'MAGAZINE',
    title: 'Candy Magazine',
    subtitle: 'The Sweet Tooth - Issue #1',
    description: 'Full-color catalog of confections, sugar rush speed boosts, nutrition facts, and special combat perks.',
    pagesCount: '16 Pages',
  },
  {
    id: 'guide',
    number: '03',
    tag: 'FIELD GUIDE',
    title: 'Town Guide',
    subtitle: 'Sector Maps & Architecture',
    description: 'Architectural surveys of town landmarks, gas stations, supply points, barricades, and danger zones across sectors.',
    pagesCount: '6 Pages',
  },
  {
    id: 'records',
    number: '04',
    tag: 'ARCHIVES',
    title: 'Records',
    subtitle: 'The Survivors Ledger',
    description: 'Official tallies of best scores, horde wave survival records, kill counts, and expedition logs.',
    pagesCount: 'Ledger',
  },
];
