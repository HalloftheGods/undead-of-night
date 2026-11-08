// What's new: the book that opens from the version number on the title screen. The notes themselves live in
// change-notes.ts; add an update at the top of CHANGE_NOTES there.

import { CHANGE_NOTES } from './change-notes.ts';
import type { ChangeKind, ChangeNote } from './change-notes.ts';

export { CHANGE_NOTES };
export type { ChangeKind, ChangeNote };

export const CHANGELOG_TITLE = "What's New";

export const KIND_LABELS: Readonly<Record<ChangeKind, string>> = { new: 'New', better: 'Better', fixed: 'Fixed' };

export type LeafColor = 'tomato' | 'teal' | 'violet' | 'mustard' | 'pink' | 'sky' | 'lime';

const COLORS: readonly LeafColor[] = ['tomato', 'teal', 'violet', 'mustard', 'pink', 'sky', 'lime'];

/** How many notes share a page. */
export const NOTES_PER_LEAF = 2;

export type ChangeLeaf =
  | { readonly kind: 'front'; readonly id: string; readonly head: string; readonly color: LeafColor }
  | { readonly kind: 'notes'; readonly id: string; readonly head: string; readonly color: LeafColor; readonly notes: readonly ChangeNote[] };

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "7 Nov 2026" from "2026-11-07". */
export function noteDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  return `${day} ${MONTH_NAMES[month - 1]} ${year}`;
}

/** The front page, then the notes two to a page, newest first. */
export function changeLeaves(notes: readonly ChangeNote[] = CHANGE_NOTES): readonly ChangeLeaf[] {
  const pages: ChangeLeaf[] = [{ kind: 'front', id: 'front', head: 'Contents', color: 'tomato' }];
  for (let at = 0; at < notes.length; at += NOTES_PER_LEAF) {
    const here = notes.slice(at, at + NOTES_PER_LEAF);
    const color = COLORS[pages.length % COLORS.length];
    pages.push({ kind: 'notes', id: `notes-${here[0].id}`, head: noteDate(here[0].date), color, notes: here });
  }
  return pages;
}

/** The page each note is on, for the front page's contents. Page 1 is the front page. */
export function notePage(id: string, notes: readonly ChangeNote[] = CHANGE_NOTES): number {
  const at = notes.findIndex((note) => note.id === id);
  return at < 0 ? 1 : 2 + Math.floor(at / NOTES_PER_LEAF);
}
