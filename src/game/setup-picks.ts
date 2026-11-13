// The Play page's picks: how you play, how hard, and who. Each shows its current choice as a portrait and opens a list
// of its options. The words and order live here; the pictures come from the art book in the component.

import { STAT_SLOTS } from "../../shared/character-stats.ts";
import { CHARACTERS } from "../../shared/characters.ts";
import { MAX_PLAYERS } from "../../shared/constants.ts";
import { DIFFICULTIES } from "../../shared/difficulty.ts";
import type { DifficultyDef, DifficultyId } from "../../shared/difficulty.ts";
import { statBarsOf } from "./character-select-view.ts";
import { MODE_CARDS } from "./mode-select-view.ts";
import {
  allocateEarnedAp,
  characterBadgeName,
  characterLevel,
  isCharacterMaxed,
  isCharacterRusty,
  pickWinningStat,
  type ProgressionBook
} from "../../shared/progression.ts";
import {
  checkApUpkeep,
  saveProgressionBook,
  type ProgressStorage
} from "../../shared/progression-save.ts";
import type { PixelSprite } from "../art/types.ts";
import type { PlayMode } from "./play-flow.ts";

export type PickKey = "mode" | "difficulty" | "who";

/** One slotted bar under an option, out of STAT_SLOTS. `strong` marks what the option is good at. */
export interface PickBar {
  readonly key: string;
  readonly label: string;
  readonly filled: number;
  readonly strong: boolean;
}

/** One entry in a pick's list. `id` is the mode, the difficulty id, or the survivor's index as text. */
export interface PickOption {
  readonly id: string;
  readonly name: string;
  readonly bars: readonly PickBar[];
  readonly level?: number;
  readonly isMaxed?: boolean;
  readonly isRusty?: boolean;
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

/** Solo seats one and keeps a Continue; Multiplayer seats a full room and starts fresh. */
function modeBars(mode: PlayMode): readonly PickBar[] {
  const isSolo = mode === "solo";
  return [
    { key: "players", label: "Players", filled: isSolo ? 1 : MAX_PLAYERS, strong: !isSolo },
    { key: "continue", label: "Continue", filled: isSolo ? STAT_SLOTS : 0, strong: isSolo }
  ];
}

type DifficultyDial = "ammo" | "zombieSpeed" | "zombieDamage" | "hordeSize";

const DIFFICULTY_DIALS: ReadonlyArray<{ readonly key: DifficultyDial; readonly label: string }> = [
  { key: "ammo", label: "Ammo" },
  { key: "zombieSpeed", label: "Speed" },
  { key: "zombieDamage", label: "Bite" },
  { key: "hordeSize", label: "Horde" }
];

/** Where a value sits between the easiest and hardest difficulty's, as 1 to STAT_SLOTS cells. */
export function dialSlots(key: DifficultyDial, value: number): number {
  const values = DIFFICULTIES.map((each) => each[key]);
  const low = Math.min(...values);
  const span = Math.max(...values) - low;
  const isFlat = span === 0;
  if (isFlat) return STAT_SLOTS;
  return 1 + Math.round(((value - low) / span) * (STAT_SLOTS - 1));
}

/** Ammo is the player's side, so a full ammo bar is the one picked out; the rest measure the zombies. */
function difficultyBars(def: DifficultyDef): readonly PickBar[] {
  return DIFFICULTY_DIALS.map(({ key, label }) => {
    const filled = dialSlots(key, def[key]);
    const isAmmo = key === "ammo";
    return { key, label, filled, strong: isAmmo && filled === STAT_SLOTS };
  });
}

const MODE_OPTIONS: readonly PickOption[] = MODE_CARDS.map((card) => ({
  id: card.mode,
  name: card.label,
  bars: modeBars(card.mode)
}));
const DIFFICULTY_OPTIONS: readonly PickOption[] = DIFFICULTIES.map((each) => ({
  id: each.id,
  name: each.label,
  bars: difficultyBars(each)
}));
/**
 * The progression the setup screen opens with: upkeep is charged first, then each survivor's banked AP
 * goes onto their own stats. Upkeep takes banked AP before pips, so the order matters.
 */
export function setupProgression(store?: ProgressStorage | null, now?: number): ProgressionBook {
  const loaded = checkApUpkeep(store, now).book;
  const survivors = { ...loaded.survivors };
  for (const key of Object.keys(survivors)) {
    const skin = Number(key);
    let updated = survivors[skin];
    while (updated.ap > 0) {
      const winning = pickWinningStat({}, skin, updated.allocations[skin]);
      const hasNoCandidate = winning === null;
      if (hasNoCandidate) break;
      const next = allocateEarnedAp(updated, skin, winning, 1);
      const landedNothing = next === updated;
      if (landedNothing) break;
      updated = next;
    }
    survivors[skin] = updated;
  }
  const book: ProgressionBook = { ...loaded, survivors };
  const didAllocate = Object.keys(survivors).some((key) => survivors[Number(key)] !== loaded.survivors[Number(key)]);
  if (didAllocate) saveProgressionBook(book, store);
  return book;
}

export function survivorOptions(book?: ProgressionBook): readonly PickOption[] {
  return CHARACTERS.map((each, index) => {
    const own = book?.survivors[index];
    return {
      id: String(index),
      name: characterBadgeName(index, each.name, own),
      bars: statBarsOf(index, own),
      level: characterLevel(own),
      isMaxed: isCharacterMaxed(index, own),
      isRusty: isCharacterRusty(index, own)
    };
  });
}

const SURVIVOR_OPTIONS: readonly PickOption[] = survivorOptions();

/** Where `id` sits in `options`, or the first option when it is not there. */
function indexOf(options: readonly PickOption[], id: string): number {
  return Math.max(
    0,
    options.findIndex((each) => each.id === id)
  );
}

/** The picks in the order the page shows them, each marked with what is chosen now. The Level card (a link, not a pick) sits before Survivor. */
export function setupPicks(
  choices: SetupChoices,
  progression?: ProgressionBook
): readonly SetupPick[] {
  return [
    {
      key: "mode",
      number: 1,
      label: "Mode",
      options: MODE_OPTIONS,
      chosen: indexOf(MODE_OPTIONS, choices.mode)
    },
    {
      key: "difficulty",
      number: 2,
      label: "Difficulty",
      options: DIFFICULTY_OPTIONS,
      chosen: indexOf(DIFFICULTY_OPTIONS, choices.difficulty)
    },
    survivorPick(choices.survivor, 4, progression)
  ];
}

/** The survivor pick on its own, as the Nightly Run page offers it beside the cards the day has already chosen. */
export function survivorPick(
  survivor: number,
  number: number = 3,
  progression?: ProgressionBook
): SetupPick {
  const options = progression ? survivorOptions(progression) : SURVIVOR_OPTIONS;
  return {
    key: "who",
    number,
    label: "Survivor",
    options,
    chosen: indexOf(options, String(survivor))
  };
}

/** A card in the picks row that shows a choice already made for you, such as Nightly Run's town: no list behind it. */
export interface FixedCard {
  readonly key: string;
  readonly number: number;
  readonly label: string;
  readonly name: string;
  readonly sprite: PixelSprite | null;
}

/** The Level card in the picks row: it shows the level Arcade starts at and opens the Levels page to change it. No list behind it. */
export interface LevelLinkCard {
  readonly number: number;
  readonly label: string;
  /** The town's name, as the card shows it. */
  readonly name: string;
  readonly sprite: PixelSprite | null;
  /** The pick the card stands in front of in the row. */
  readonly before: PickKey;
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
  const moves: Readonly<Record<string, number>> = {
    ArrowDown: at + 1,
    ArrowRight: at + 1,
    ArrowUp: at - 1,
    ArrowLeft: at - 1,
    Home: 0,
    End: last
  };
  const to = moves[key];
  const isNotAMove = to === undefined;
  if (isNotAMove) return at;
  return (to + count) % count;
}

/** The longest word in a name, in letters, so a title can shrink until that word fits on one line. */
export function longestWord(name: string): number {
  return Math.max(1, ...name.split(/\s+/).map((word) => word.length));
}
