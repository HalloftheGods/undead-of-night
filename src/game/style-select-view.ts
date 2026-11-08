// The Style step's plain parts: what each card says, and the facts listed beside it. Campaign and Arcade are the two ways to play a run.

import type { GameStyle } from '../../shared/game-style.ts';
import { STYLE_LABELS } from './play-flow.ts';

export interface StyleCard {
  readonly style: GameStyle;
  readonly label: string;
  /** One line for the nameplate. */
  readonly line: string;
}

/** One row beside the big card, a short value. */
export interface StyleFact {
  readonly key: string;
  readonly label: string;
  readonly value: string;
}

/** In roster order: Arcade then Campaign, matching the title menu. */
export const STYLE_CARDS: readonly StyleCard[] = [
  { style: 'arcade', label: STYLE_LABELS.arcade, line: 'Ten levels in a row with a workbench in the van. The game as it always was.' },
  { style: 'campaign', label: STYLE_LABELS.campaign, line: 'Live in a bunker. Go out on trips, bring treasure home, forge it and trade.' },
];

const FACTS: Readonly<Record<GameStyle, readonly StyleFact[]>> = {
  campaign: [
    { key: 'plays', label: 'Plays', value: 'Trip by trip' },
    { key: 'between', label: 'Between', value: 'Bunker' },
    { key: 'dying', label: 'Dying', value: 'Lose your haul' },
    { key: 'continue', label: 'Saves', value: 'Gear and gold' },
  ],
  arcade: [
    { key: 'plays', label: 'Plays', value: 'Ten in a row' },
    { key: 'between', label: 'Between', value: 'Van bench' },
    { key: 'dying', label: 'Dying', value: 'Ends the run' },
    { key: 'continue', label: 'Saves', value: 'Level reached' },
  ],
};

/** Under the server field in co-op: a room has one style, so the choice on the first page is an offer. */
export const STYLE_ROOM_NOTE = 'The first player into an empty room sets its style. Everyone who joins after plays that style.';

export function styleFacts(style: GameStyle): readonly StyleFact[] {
  return FACTS[style];
}

/** Where a style sits in STYLE_CARDS, so the roster can mark it chosen. */
export function styleIndex(style: GameStyle): number {
  return Math.max(0, STYLE_CARDS.findIndex((each) => each.style === style));
}
