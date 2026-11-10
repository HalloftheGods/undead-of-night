// Where the title screen is: the open page, whether an invite link brought the player here, and the level picked on the Levels page. Every move is decided here.

import type { TitlePage } from './title-menu.ts';

export interface TitleNav {
  readonly page: TitlePage | null;
  /** An invite link opened Play, and the room decides the style. It settles that first visit only: leaving the page ends it. */
  readonly invited: boolean;
  /** Set when a level was picked on the Levels page, so Play starts there and Back returns to the Levels page. */
  readonly startLevel: number | null;
  /** Set when a book was opened from the Books library overlay, so Back returns to Books. */
  readonly fromBooks?: boolean;
}

export const TITLE_HOME: TitleNav = { page: null, invited: false, startLevel: null, fromBooks: false };

/** Arriving on an invite link (?join=): Play, already open. */
export const INVITE_LANDING: TitleNav = { page: 'play', invited: true, startLevel: null, fromBooks: false };

export function openPage(nav: TitleNav, page: TitlePage): TitleNav {
  return { ...nav, page, fromBooks: false };
}

export function openBook(nav: TitleNav, page: TitlePage): TitleNav {
  return { ...nav, page, fromBooks: true };
}

export function pickLevel(nav: TitleNav, level: number): TitleNav {
  return { ...nav, page: 'play', startLevel: level, fromBooks: false };
}

/** Back from Play: to the Levels page if a level sent the player there, else the title. Either way the invite is spent. */
export function closePlay(nav: TitleNav): TitleNav {
  const cameFromLevels = nav.startLevel !== null;
  return { page: cameFromLevels ? 'levels' : null, invited: false, startLevel: null, fromBooks: false };
}

/** Back from a book to the Books overlay if opened from it, else the title. */
export function closeBook(nav: TitleNav): TitleNav {
  return { ...nav, page: nav.fromBooks ? 'books' : null, fromBooks: false, invited: false };
}

/** Back from any other page to the title. */
export function closePage(nav: TitleNav): TitleNav {
  return { ...nav, page: null, invited: false, fromBooks: false };
}
