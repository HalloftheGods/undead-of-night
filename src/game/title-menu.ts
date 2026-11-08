import type { GameStyle } from '../../shared/game-style.ts';
import { formatDuration } from './hud-state.ts';
import { STYLE_LABELS } from './play-flow.ts';
import type { SoundUnlock } from './sound-unlock.ts';
import type { BestRun, LeaderboardEntry } from './storage.ts';

/** The title's menu, what each item opens, and the words its pages show. The components only lay these out. */
/** Every title page. The changelog has no menu item: the version number in the corner opens it. */
export type TitlePage = 'play' | 'daily' | 'levels' | 'howto' | 'records' | 'sound' | 'options' | 'changelog';

export interface TitleMenuItem {
  readonly page: TitlePage;
  readonly label: string;
  /** Shows as ??? until the player has found this. */
  readonly needs?: 'radio';
}

/** What an item reads as: its name, or ??? while what it needs has not been found. */
export function menuLabel(item: TitleMenuItem, unlock: SoundUnlock): string {
  const hidden = item.needs === 'radio' && !unlock.radio;
  return hidden ? '???' : item.label;
}

export const TITLE_MENU: readonly TitleMenuItem[] = [
  { page: 'play', label: 'Play' },
  { page: 'daily', label: 'Daily Night' },
  { page: 'levels', label: 'Levels' },
  { page: 'howto', label: 'How to Play' },
  { page: 'records', label: 'Records' },
  { page: 'sound', label: 'Sound Test' },
  { page: 'options', label: 'Options' },
];

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

const MENU_STEPS: Readonly<Record<string, number>> = {
  ArrowUp: -1,
  KeyW: -1,
  ArrowDown: 1,
  KeyS: 1,
};

/** Which way a key moves the menu, or 0 if it does not. */
export function menuStep(code: string): number {
  return MENU_STEPS[code] ?? 0;
}

/** The item a step lands on, wrapping at both ends. */
export function steppedIndex(index: number, step: number, count = TITLE_MENU.length): number {
  return (index + step + count) % count;
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
