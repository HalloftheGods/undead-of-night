import type { GameStyle } from '../../shared/game-style.ts';
import { formatDuration } from './hud-state.ts';
import { STYLE_LABELS } from './play-flow.ts';
import type { SoundUnlock } from './sound-unlock.ts';
import type { BestRun, LeaderboardEntry } from './storage.ts';

/** The title's menu, what each item opens, and the words its pages show. The components only lay these out. */
/** Every title page. The changelog has no menu item: the version number in the corner opens it. */
export type TitlePage = 'play' | 'daily' | 'levels' | 'howto' | 'guide' | 'records' | 'sound' | 'options' | 'changelog';

/** The menu's three sections, each a column under its own small header. */
export type MenuGroup = 'books' | 'play' | 'extras';

export interface TitleMenuItem {
  readonly page: TitlePage;
  readonly group: MenuGroup;
  readonly label: string;
  /** One line under the label, saying what the button opens. */
  readonly line: string;
  /** Set on Campaign and Arcade: the style this button starts a setup for. The page is Play; the style is the button. */
  readonly style?: GameStyle;
  /** Shows as ??? until the player has found this. */
  readonly needs?: 'radio';
  /** The highlighted button, and the one the menu opens pointed at. */
  readonly primary?: boolean;
}

/** What an item reads as: its name, or ??? while what it needs has not been found. */
export function menuLabel(item: TitleMenuItem, unlock: SoundUnlock): string {
  const hidden = item.needs === 'radio' && !unlock.radio;
  return hidden ? '???' : item.label;
}

/** The line under an item: hidden along with the name while what it needs has not been found. */
export function menuLine(item: TitleMenuItem, unlock: SoundUnlock): string {
  const hidden = item.needs === 'radio' && !unlock.radio;
  return hidden ? '' : item.line;
}

/**
 * Three sections, read left to right: Books (How to Play on top), Play (Daily Night, the primary, where the menu
 * opens) and Extras. The list runs section by section, so an item's place in it never changes.
 */
export const TITLE_MENU: readonly TitleMenuItem[] = [
  { group: 'books', page: 'howto', label: 'How to Play', line: 'Controls and the rules of the night.' },
  { group: 'books', page: 'guide', label: 'Town Guide', line: 'What each kind of building holds.' },
  { group: 'books', page: 'records', label: 'Records', line: 'Your best runs, trips and scores.' },
  { group: 'play', page: 'daily', label: 'Daily Night', line: 'A fresh night every day.', primary: true },
  { group: 'play', page: 'play', label: 'Arcade', style: 'arcade', line: 'Ten levels in a row. Die and the run ends.' },
  { group: 'play', page: 'play', label: 'Campaign', style: 'campaign', line: 'Live in a bunker. Run trips, haul treasure home.' },
  { group: 'play', page: 'levels', label: 'Levels', line: 'Jump to an Arcade level you have reached.' },
  { group: 'extras', page: 'sound', label: 'Sound Test', line: 'Hear the music and effects.' },
  { group: 'extras', page: 'options', label: 'Options', line: 'Sound, display, motion and controls.' },
];

const GROUP_ORDER: readonly MenuGroup[] = ['books', 'play', 'extras'];
const GROUP_LABELS: Readonly<Record<MenuGroup, string>> = { books: 'Books', play: 'Play', extras: 'Extras' };

export interface MenuColumn {
  readonly group: MenuGroup;
  readonly heading: string;
  /** Where each of the column's items sits in the whole list, top to bottom. */
  readonly indices: readonly number[];
}

/** The columns the menu lays out, left to right. A section with nothing in it is left out. */
export function menuColumns(entries: readonly TitleMenuItem[] = TITLE_MENU): readonly MenuColumn[] {
  const columns = GROUP_ORDER.map((group) => ({
    group,
    heading: GROUP_LABELS[group],
    indices: entries.flatMap((item, index) => (item.group === group ? [index] : [])),
  }));
  return columns.filter((column) => column.indices.length > 0);
}

/** Where the menu starts: the primary item, or the top if none is marked. */
export function primaryIndex(entries: readonly TitleMenuItem[] = TITLE_MENU): number {
  return Math.max(0, entries.findIndex((item) => item.primary === true));
}

/** The Levels page belongs to Arcade; Campaign picks its level at the garage map in the bunker. */
export const LEVELS_PAGE_NOTE = 'Arcade levels: pick one you have reached to start there. Campaign picks its level at the garage map.';

export const CONTROLS: readonly (readonly [keys: string, action: string])[] = [
  ['WASD', 'Move'],
  ['Shift', 'Hold to sprint, loud and it tires you out'],
  ['C', 'Hold to sneak, slow and quiet'],
  ['Mouse', 'Aim, hold to fire'],
  ['F / Right', 'Shove & Stab, makes no noise'],
  ['E', 'Hold to search'],
  ['R', 'Reload'],
  ['H', 'Use a medkit'],
  ['1 2 3 Q', 'Weapons'],
  ['Tab / N', 'Map'],
  ['Esc', 'Pause'],
  ['M', 'Mute'],
];

/** A key's move on the menu: down a column, or across to the next. */
export interface MenuMove {
  readonly across: number;
  readonly down: number;
}

const MENU_MOVES: Readonly<Record<string, MenuMove>> = {
  ArrowUp: { across: 0, down: -1 },
  KeyW: { across: 0, down: -1 },
  ArrowDown: { across: 0, down: 1 },
  KeyS: { across: 0, down: 1 },
  ArrowLeft: { across: -1, down: 0 },
  KeyA: { across: -1, down: 0 },
  ArrowRight: { across: 1, down: 0 },
  KeyD: { across: 1, down: 0 },
};

/** Which way a key moves the menu, or null if it does not. */
export function menuMove(code: string): MenuMove | null {
  return MENU_MOVES[code] ?? null;
}

/** Steps along a list of length count, wrapping at both ends. */
function wrapped(at: number, step: number, count: number): number {
  return (at + step + count) % count;
}

/**
 * The item a move lands on. Up and down wrap inside the column; left and right wrap across the columns and keep
 * the row, or take the last item of a shorter column.
 */
export function movedIndex(index: number, move: MenuMove, entries: readonly TitleMenuItem[] = TITLE_MENU): number {
  const columns = menuColumns(entries);
  const column = Math.max(0, columns.findIndex((each) => each.indices.includes(index)));
  const row = Math.max(0, columns[column].indices.indexOf(index));
  const target = columns[wrapped(column, move.across, columns.length)];
  const clampedRow = Math.min(row, target.indices.length - 1);
  return target.indices[wrapped(clampedRow, move.down, target.indices.length)];
}

export interface KeyFocus {
  readonly focusInMenu: boolean;
  readonly focusOnControl: boolean;
}

/** The menu answers keys unless focus is on some other control, which then answers its own Enter. */
export function menuOwnsKey(focus: KeyFocus): boolean {
  return focus.focusInMenu || !focus.focusOnControl;
}

export function isConfirmKey(code: string): boolean {
  return code === 'Enter' || code === 'NumpadEnter';
}

/** What the co-op button does: join a room or server, host a private room, or find a public team. */
export type CoopAction = 'join' | 'host' | 'find';
const COOP_LABELS: Readonly<Record<CoopAction, string>> = { join: 'Join', host: 'Host room', find: 'Find a team' };
/** Each Multiplayer choice's button (the choices are CoopEntry in run-session.ts). */
export const COOP_ACTIONS: Readonly<Record<'find' | 'host' | 'code', CoopAction>> = { find: 'find', host: 'host', code: 'join' };

/** The setup page's one button, which also says why it cannot be pressed yet. */
export function setupActionLabel(coop: boolean, artReady: boolean, connecting: boolean, action: CoopAction = 'join'): string {
  if (!artReady) return 'Loading...';
  if (connecting) return 'Connecting...';
  if (!coop) return 'Start';
  return COOP_LABELS[action];
}

export interface RecordStat {
  readonly tag: string;
  readonly value: string;
}

const RECORD_TAGS: Readonly<Record<GameStyle, readonly [string, string, string, string]>> = {
  arcade: ['Best score', 'Hordes', 'Kills', 'Best time'],
  campaign: ['Best trip score', 'Trip hordes', 'Trip kills', 'Best trip time'],
};

/** A style's own best: Arcade's whole run, or Campaign's single trip. The two are never compared. */
export function recordStats(best: BestRun | null, style: GameStyle = 'arcade'): readonly RecordStat[] {
  const tags = RECORD_TAGS[style];
  return [
    { tag: tags[0], value: String(best?.score ?? 0) },
    { tag: tags[1], value: String(best?.wave ?? 0) },
    { tag: tags[2], value: String(best?.kills ?? 0) },
    { tag: tags[3], value: best ? formatDuration(best.durationSec) : '--:--' },
  ];
}

export interface RecordSection {
  readonly style: GameStyle;
  readonly heading: string;
  readonly stats: readonly RecordStat[];
}

/** One block of stats for each style, Campaign first. A style with no run yet shows its empty stats. */
export function recordSections(arcadeBest: BestRun | null, campaignBest: BestRun | null): readonly RecordSection[] {
  return [
    { style: 'campaign', heading: STYLE_LABELS.campaign, stats: recordStats(campaignBest, 'campaign') },
    { style: 'arcade', heading: STYLE_LABELS.arcade, stats: recordStats(arcadeBest, 'arcade') },
  ];
}

/** What a leaderboard row says about where it came from: a Campaign entry is one trip, an Arcade entry a whole run. */
const ROW_LABELS: Readonly<Record<GameStyle, string>> = { campaign: 'Campaign trip', arcade: 'Arcade run' };

const SHOWN_RUNS = 5;

export interface RecordRow {
  readonly key: string;
  readonly rank: string;
  readonly name: string;
  readonly score: number;
  /** Where the run came from. */
  readonly style: GameStyle;
  /** The same, in words. */
  readonly label: string;
  /** The ledger's other columns: hordes, kills, time and the day it was logged. */
  readonly hordes: number;
  readonly kills: number;
  readonly time: string;
  readonly date: string;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** The trip-end recorder marks what it saves, and an entry without the mark is a whole Arcade run. */
export function recordRows(leaderboard: readonly (LeaderboardEntry & { readonly trip?: boolean })[]): readonly RecordRow[] {
  return leaderboard.slice(0, SHOWN_RUNS).map((entry, index) => {
    const style: GameStyle = entry.trip === true ? 'campaign' : 'arcade';
    const when = new Date(entry.timestamp);
    return {
      key: `${entry.timestamp}-${index}`,
      rank: `#${index + 1}`,
      name: entry.callsign || 'SURVIVOR',
      score: entry.score,
      style,
      label: ROW_LABELS[style],
      hordes: entry.wave ?? 0,
      kills: entry.kills ?? 0,
      time: formatDuration(entry.durationSec ?? 0),
      date: `${when.getDate()} ${MONTH_NAMES[when.getMonth()]}`,
    };
  });
}
