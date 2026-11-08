// The Play page's picks: how you play, how hard, and who. Each shows its current choice as a portrait and opens a list
// of its options. The words and order live here; the pictures come from the art book in the component.

import { CHARACTERS } from '../../shared/characters.ts';
import { DIFFICULTIES } from '../../shared/difficulty.ts';
import type { DifficultyId } from '../../shared/difficulty.ts';
import { MODE_CARDS } from './mode-select-view.ts';
import type { PlayMode } from './play-flow.ts';

export type PickKey = 'mode' | 'difficulty' | 'who';

/** One entry in a pick's list. `id` is the mode, the difficulty id, or the survivor's index as text. */
export interface PickOption {
  readonly id: string;
  readonly name: string;
}

export interface SetupPick {
  readonly key: PickKey;
  /** 1-based, for the stepper's badge. */
  readonly number: number;
  readonly label: string;
  readonly options: readonly PickOption[];
  /** Index into options of the current choice. */
  readonly chosen: number;
}

export interface SetupChoices {
  readonly mode: PlayMode;
  readonly difficulty: DifficultyId;
  readonly survivor: number;
}

const MODE_OPTIONS: readonly PickOption[] = MODE_CARDS.map((card) => ({ id: card.mode, name: card.label }));
const DIFFICULTY_OPTIONS: readonly PickOption[] = DIFFICULTIES.map((each) => ({ id: each.id, name: each.label }));
const SURVIVOR_OPTIONS: readonly PickOption[] = CHARACTERS.map((each, index) => ({ id: String(index), name: each.name }));

/** Where `id` sits in `options`, or the first option when it is not there. */
function indexOf(options: readonly PickOption[], id: string): number {
  return Math.max(0, options.findIndex((each) => each.id === id));
}

/** The three picks, in the order the page shows them, each marked with what is chosen now. */
export function setupPicks(choices: SetupChoices): readonly SetupPick[] {
  return [
    { key: 'mode', number: 1, label: 'Mode', options: MODE_OPTIONS, chosen: indexOf(MODE_OPTIONS, choices.mode) },
    { key: 'difficulty', number: 2, label: 'Difficulty', options: DIFFICULTY_OPTIONS, chosen: indexOf(DIFFICULTY_OPTIONS, choices.difficulty) },
    { key: 'who', number: 3, label: 'Survivor', options: SURVIVOR_OPTIONS, chosen: indexOf(SURVIVOR_OPTIONS, String(choices.survivor)) },
  ];
}

/** The option a pick is set to. */
export function chosenOption(pick: SetupPick): PickOption {
  return pick.options[pick.chosen];
}

/**
 * Arrow keys in an open list: Up and Down step one, Left and Right too (the list wraps into columns on a wide screen),
 * Home and End jump to the ends. Steps wrap around. Any other key leaves the focus where it is.
 */
export function stepFocus(at: number, count: number, key: string): number {
  const last = count - 1;
  const moves: Readonly<Record<string, number>> = { ArrowDown: at + 1, ArrowRight: at + 1, ArrowUp: at - 1, ArrowLeft: at - 1, Home: 0, End: last };
  const to = moves[key];
  const isNotAMove = to === undefined;
  if (isNotAMove) return at;
  return (to + count) % count;
}
