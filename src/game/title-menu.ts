import type { GameStyle } from "../../shared/game-style.ts";
import { formatDuration } from "./hud-state.ts";
import { STYLE_LABELS } from "./play-flow.ts";
import type { SoundUnlock } from "./sound-unlock.ts";
import type { BestRun, LeaderboardEntry } from "./storage.ts";

/** The title's menu, what each item opens, and the words its pages show. The components only lay these out. */
/** Every title page. The changelog has no menu item: the version number in the corner opens it. */
export type TitlePage =
  | "play"
  | "daily"
  | "levels"
  | "books"
  | "howto"
  | "candy"
  | "guide"
  | "records"
  | "sound"
  | "radio"
  | "audio"
  | "display"
  | "gameplay"
  | "controls"
  | "changelog"
  | "dev_inventory";

/** The menu's top-level groups. */
export type MenuGroup = "play" | "books" | "settings" | "radio";

export interface TitleMenuItem {
  readonly page: TitlePage;
  readonly group: MenuGroup;
  readonly label: string;
  /** One line under the label, saying what the button opens. */
  readonly line: string;
  /** Set on Campaign and Arcade: the style this button starts a setup for. The page is Play; the style is the button. */
  readonly style?: GameStyle;
  /** Shows as ??? until the player has found this. */
  readonly needs?: "radio";
  /** The highlighted button, and the one the menu opens pointed at. */
  readonly primary?: boolean;
}

/** What an item reads as: its name, or ??? while what it needs has not been found. */
export function menuLabel(item: TitleMenuItem, unlock?: SoundUnlock): string {
  const hidden = item.needs === "radio" && !unlock?.radio;
  return hidden ? "???" : item.label;
}

/** The line under an item: hidden along with the name while what it needs has not been found. */
export function menuLine(item: TitleMenuItem, unlock?: SoundUnlock): string {
  const hidden = item.needs === "radio" && !unlock?.radio;
  return hidden ? "" : item.line;
}

/** Every link, section by section. */
export const TITLE_MENU: readonly TitleMenuItem[] = [
  // 1-5 Player (Nightly Run on top, then Campaign and Arcade)
  {
    group: "play",
    page: "daily",
    label: "Nightly Run",
    line: "A fresh solo or co-op night every day. One chance."
  },
  {
    group: "play",
    page: "play",
    label: "Campaign",
    style: "campaign",
    line: "Live in a bunker. Run trips, haul treasure home."
  },
  {
    group: "play",
    page: "play",
    label: "Arcade",
    style: "arcade",
    line: "Ten levels in a row. Die and the run ends."
  },

  // News Stand (Guides, Statistics, Level Select, and Radio)
  {
    group: "books",
    page: "howto",
    label: "How to Play",
    line: "Controls and the rules of the night."
  },
  {
    group: "books",
    page: "candy",
    label: "Candy Magazine",
    line: "Nutrition, brands and special effects."
  },
  {
    group: "books",
    page: "guide",
    label: "Town Guide",
    line: "What each kind of building holds."
  },
  {
    group: "books",
    page: "records",
    label: "Statistics",
    line: "Your best runs, trips and scores."
  },
  {
    group: "books",
    page: "levels",
    label: "Level Select",
    line: "Jump to an Arcade level you have reached."
  },

  // Radio (Top-level unlockable item)
  {
    group: "radio",
    page: "radio",
    label: "Radio",
    line: "Tapes, tunes and radio finds.",
    needs: "radio"
  },

  // Settings (Sorted A - Z: Audio, Controls, Display, Gameplay)
  {
    group: "settings",
    page: "audio",
    label: "Audio",
    line: "Music, sound effects and volume levels."
  },
  {
    group: "settings",
    page: "controls",
    label: "Controls",
    line: "Remap keyboard keys and controller buttons."
  },
  {
    group: "settings",
    page: "display",
    label: "Display",
    line: "Fullscreen, resolution and visual effects."
  },
  {
    group: "settings",
    page: "gameplay",
    label: "Gameplay",
    line: "Camera motion, screen shake and accessibility."
  },
  {
    group: "radio",
    page: "sound",
    label: "Sound Test",
    line: "Hear the music and effects."
  }
];

/** A parent on the title: it opens a list of its own links instead of a page. */
export interface MenuSection {
  readonly group: MenuGroup;
  readonly label: string;
  readonly line: string;
  readonly needs?: "radio";
  /** Optional icon badge type for special title entries. */
  readonly badgeType?: "star" | "undead_star";
}

/** Static menu sections exported for TitleMenu.vue compatibility. */
export const MENU_SECTIONS: readonly MenuSection[] = [
  {
    group: "play",
    label: "1-5 Player",
    line: "Nightly Run, Campaign and Arcade."
  },
  {
    group: "radio",
    label: "Radio",
    line: "Tapes, tunes, radio finds and the Sound Test.",
    needs: "radio"
  },
  {
    group: "books",
    label: "News Stand",
    line: "How to Play, Candy Magazine, Town Guide, Statistics and Level Select."
  },
  {
    group: "settings",
    label: "Settings",
    line: "Audio, Controls, Display and Gameplay."
  }
];

/** The menu's sections. A locked Radio stays in the list as ??? with no line, so the top menu holds its place until the radio is found. */
export function menuSections(unlock?: SoundUnlock): readonly MenuSection[] {
  return MENU_SECTIONS.map((sec) => {
    const isLocked = sec.needs === "radio" && !unlock?.radio;
    return isLocked ? { ...sec, label: "???", line: "" } : sec;
  });
}

/** One line of the menu as drawn: a parent, one of its links, or the Back that leaves a list. */
export interface MenuRow {
  readonly kind: "section" | "item" | "back";
  readonly label: string;
  readonly line: string;
  readonly primary: boolean;
  /** Set on a parent: the section it opens. */
  readonly group?: MenuGroup;
  /** Set on a link: the entry it opens. */
  readonly item?: TitleMenuItem;
  /** Optional badge type passed from the section or direct item. */
  readonly badgeType?: "star" | "undead_star";
}

/** The rows for the title (section null) or for one opened section, which ends in Back. */
export function menuRows(
  section: MenuGroup | null,
  entries: readonly TitleMenuItem[] = TITLE_MENU,
  unlock?: SoundUnlock,
  dailyCompleted: boolean = false
): readonly MenuRow[] {
  const sections = menuSections(unlock);
  if (section === null) {
    const parentRows: MenuRow[] = sections.map((each) => ({
      kind: "section",
      label: each.label,
      line: each.line,
      primary: false,
      group: each.group
    }));

    return parentRows;
  }

  const links = entries.filter((item) => item.group === section);

  const rows: MenuRow[] = links.map((item) => ({
    kind: "item",
    label: menuLabel(item, unlock),
    line: menuLine(item, unlock),
    primary: false,
    item,
    ...(item.page === "daily" ? { badgeType: dailyCompleted ? ("star" as const) : ("undead_star" as const) } : {})
  }));
  return [...rows, { kind: "back", label: "Back", line: "", primary: false }];
}

/** Where a list opens: its primary row, or the top (0 when all rows have primary: false). */
export function openingRow(rows: readonly MenuRow[]): number {
  return Math.max(
    0,
    rows.findIndex((row) => row.primary)
  );
}

/** The Levels page belongs to Arcade; Campaign picks its level at the garage map in the bunker. */
export const LEVELS_PAGE_NOTE =
  "Arcade levels: pick one you have reached to start there. Campaign picks its level at the garage map.";

export const CONTROLS: readonly (readonly [keys: string, action: string])[] = [
  ["WASD", "Move"],
  ["Shift", "Hold to sprint, loud and it tires you out"],
  ["Space", "Hold to sneak, slow and quiet"],
  ["Mouse", "Aim, hold to fire"],
  ["F / Right", "Shove & Stab, makes no noise"],
  ["E", "Hold to search"],
  ["R", "Reload"],
  ["H", "Use a medkit"],
  ["1 2 3 Q", "Weapons"],
  ["Tab / N", "Map"],
  ["Esc", "Pause"],
  ["M", "Mute"]
];

/** Which way a key steps the list: -1 up, 1 down, or null if it does not move it. */
export function menuStep(code: string): -1 | 1 | null {
  if (code === "ArrowUp" || code === "KeyW") return -1;
  if (code === "ArrowDown" || code === "KeyS") return 1;
  return null;
}

/** Keys that leave an opened section for the title. */
export function isBackKey(code: string): boolean {
  return code === "ArrowLeft" || code === "KeyA" || code === "Escape" || code === "Backspace";
}

/** Steps along a list of length count, wrapping at both ends. */
export function steppedRow(at: number, step: number, count: number): number {
  return (at + step + count) % count;
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
  return code === "Enter" || code === "NumpadEnter";
}

/** What the co-op button does: join a room or server, host a private room, or find a public team. */
export type CoopAction = "join" | "host" | "find";
const COOP_LABELS: Readonly<Record<CoopAction, string>> = {
  join: "Join",
  host: "Host room",
  find: "Find a team"
};
/** Each Multiplayer choice's button (the choices are CoopEntry in run-session.ts). */
export const COOP_ACTIONS: Readonly<Record<"find" | "host" | "code", CoopAction>> = {
  find: "find",
  host: "host",
  code: "join"
};

/** The setup page's one button, which also says why it cannot be pressed yet. */
export function setupActionLabel(
  coop: boolean,
  artReady: boolean,
  connecting: boolean,
  action: CoopAction = "join"
): string {
  if (!artReady) return "Loading...";
  if (connecting) return "Connecting...";
  if (!coop) return "Start";
  return COOP_LABELS[action];
}

export interface RecordStat {
  readonly tag: string;
  readonly value: string;
}

const RECORD_TAGS: Readonly<Record<GameStyle, readonly [string, string, string, string]>> = {
  arcade: ["Best score", "Hordes", "Kills", "Best time"],
  campaign: ["Best trip score", "Trip hordes", "Trip kills", "Best trip time"],
  daily: ["Best score", "Hordes", "Kils", "Best time"]
};

/** A style's own best: Arcade's whole run, or Campaign's single trip. The two are never compared. */
export function recordStats(
  best: BestRun | null,
  style: GameStyle = "arcade"
): readonly RecordStat[] {
  const tags = RECORD_TAGS[style];
  return [
    { tag: tags[0], value: String(best?.score ?? 0) },
    { tag: tags[1], value: String(best?.wave ?? 0) },
    { tag: tags[2], value: String(best?.kills ?? 0) },
    { tag: tags[3], value: best ? formatDuration(best.durationSec) : "--:--" }
  ];
}

export interface RecordSection {
  readonly style: GameStyle;
  readonly heading: string;
  readonly stats: readonly RecordStat[];
}

/** One block of stats for each style, Campaign first. A style with no run yet shows its empty stats. */
export function recordSections(
  arcadeBest: BestRun | null,
  campaignBest: BestRun | null
): readonly RecordSection[] {
  return [
    {
      style: "campaign",
      heading: STYLE_LABELS.campaign,
      stats: recordStats(campaignBest, "campaign")
    },
    { style: "arcade", heading: STYLE_LABELS.arcade, stats: recordStats(arcadeBest, "arcade") }
  ];
}

/** What a leaderboard row says about where it came from: a Campaign entry is one trip, an Arcade entry a whole run. */
const ROW_LABELS: Readonly<Record<GameStyle, string>> = {
  campaign: "Campaign trip",
  arcade: "Arcade run",
  daily: "Nightly Run run"
};

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

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec"
];

/** The trip-end recorder marks what it saves, and an entry without the mark is a whole Arcade run. */
export function recordRows(
  leaderboard: readonly (LeaderboardEntry & { readonly trip?: boolean })[]
): readonly RecordRow[] {
  return leaderboard.slice(0, SHOWN_RUNS).map((entry, index) => {
    const style: GameStyle = entry.trip === true ? "campaign" : "arcade";
    const when = new Date(entry.timestamp);
    return {
      key: `${entry.timestamp}-${index}`,
      rank: `#${index + 1}`,
      name: entry.callsign || "SURVIVOR",
      score: entry.score,
      style,
      label: ROW_LABELS[style],
      hordes: entry.wave ?? 0,
      kills: entry.kills ?? 0,
      time: formatDuration(entry.durationSec ?? 0),
      date: `${when.getDate()} ${MONTH_NAMES[when.getMonth()]}`
    };
  });
}
