import { effectOf, rankOf, slotsUsed } from "../../shared/gun-upgrades.ts";
import { GUN_EFFECTS } from "../../shared/round-effect-data.ts";
import { formatKeyCode, loadKeyBindings } from "./controls-prefs.ts";
import { driveReadout, formatSpeed } from "./drive-readout.ts";
import type { ControlDevice } from "./hud-keys.ts";
import { weaponSlotLabel } from "./hud-keys.ts";
import { ammoWarning, hordeStatus, reloadPrompt, switchKey } from "./hud-state.ts";
import type { AmmoState, HudState, KeepsakeCard, UiState } from "./hud-state.ts";
import { levelGoal, levelLine, levelSidequest } from "./level-hud.ts";
import { materialChips } from "./material-chips.ts";
import type { MaterialChip } from "./material-chips.ts";
import { carriedLines } from "./home-screens.ts";
import { questTracker } from "./home/quest-view.ts";
import type { TrackerLine } from "./home/quest-view.ts";
import { hintText } from "./first-run-hints.ts";
import { gunOnTop } from "./canvas-hud-prefs.ts";
import type { BarSlot } from "./weapon-bar.ts";
import { weaponBar } from "./weapon-bar.ts";

export type PadArrow = "up" | "down" | "left" | "right";

/** A hotkey as the HUD prints it: a key's letter, or on a pad "D" with the arrow of its D-pad direction. */
export interface Hotkey {
  readonly text: string;
  readonly arrow: PadArrow | null;
}

export type ItemIcon = "medkit" | "bottle" | "fireworks" | "fountain" | "candy" | "knife";

export interface ItemRow {
  readonly icon: ItemIcon;
  readonly text: string;
  readonly dim: boolean;
  readonly hotkey: Hotkey | null;
}

export interface MoodleRow {
  readonly id: string;
  readonly label: string;
  readonly percentText: string | null;
  readonly remedy: string;
  readonly severity: string;
  readonly hotkey: Hotkey | null;
}

export interface TeammateRow {
  readonly name: string;
  readonly character: string;
  readonly color: string;
  readonly alive: boolean;
  readonly status: string;
  readonly fraction: number;
}

export interface KeepsakeRow {
  readonly id: KeepsakeCard["id"];
  readonly code: string;
  readonly keyLabel: string | null;
  readonly name: string;
  readonly blurb: string;
}

export interface RunLogRow {
  readonly key: number;
  readonly at: string;
  readonly text: string;
  readonly detail: string;
  readonly count: number;
  readonly tone: string;
}

export interface FeedRow {
  readonly key: number;
  readonly at: string;
  readonly text: string;
  readonly count: number;
  readonly age: number;
  readonly tone: string;
}

export interface QuestRow {
  readonly title: string;
  readonly filled: number;
  readonly slots: number;
  readonly value: string;
  readonly ready: boolean;
  readonly atRisk: boolean;
}

export interface GunFitPips {
  readonly plain: number;
  readonly suppressed: boolean;
  readonly quirk: boolean;
  readonly effect: ReturnType<typeof effectOf>;
}

export interface CanvasHudSlot extends BarSlot {
  /** The number key shown on the slot, for a keyboard. Null on a pad or a phone. */
  readonly keyHint: string | null;
  readonly pips: GunFitPips;
}

export interface DriveRow {
  readonly speed: string;
  readonly heading: string;
  readonly body: string;
  readonly crash: string;
}

/** Everything the canvas HUD paints, worked out from the same state the page HUD reads. */
export interface CanvasHudView {
  readonly hud: HudState;
  readonly place: UiState["place"];
  readonly mode: UiState["mode"];
  readonly signalWeak: boolean;
  readonly items: readonly ItemRow[];
  readonly sugar: readonly { readonly name: string; readonly left: string }[];
  readonly materials: readonly MaterialChip[];
  readonly moodles: readonly MoodleRow[];
  readonly teammates: readonly TeammateRow[];
  readonly boss: { readonly name: string; readonly fraction: number } | null;
  readonly keepsakes: readonly KeepsakeRow[];
  readonly feed: readonly FeedRow[];
  /** 1 while the log is shown, then fading to 0 a few seconds after its newest line. */
  readonly feedAlpha: number;
  /** Whether the gun box sits at the top centre (true), or at the bottom with the run's info on top. */
  readonly gunOnTop: boolean;
  /** Whether the full run log is open (L). The canvas draws it in place of the feed. */
  readonly logOpen: boolean;
  /** The newest lines of the run log, for the full log panel. */
  readonly runLog: readonly RunLogRow[];
  /** The key that opens the full log, printed under the feed, or null where there is none. */
  readonly logKey: Hotkey | null;
  readonly quests: {
    readonly summary: string;
    readonly lines: readonly QuestRow[];
    readonly warning: string | null;
  } | null;
  readonly treasure: { readonly worth: string; readonly counts: readonly string[] } | null;
  readonly drive: DriveRow | null;
  readonly hint: string;
  readonly bite: { readonly angle: number; readonly key: number } | null;
  readonly slots: readonly CanvasHudSlot[];
  readonly ammo: AmmoState;
  readonly horde: ReturnType<typeof hordeStatus>;
  readonly levelText: string;
  readonly goal: string;
  readonly sidequest: string | null;
  readonly effectLabel: string | null;
  readonly swapPrompt: Hotkey | null;
  readonly reloadPromptKey: Hotkey | null;
  readonly empty: boolean;
  readonly reloadNeeded: boolean;
  readonly shoveKey: string | null;
  readonly shoveLabel: string;
}

export interface CanvasHudContext {
  readonly ui: UiState;
  readonly hud: HudState;
  readonly device: ControlDevice;
  /** The key glyph for a key code on this device, or null when no glyph applies. */
  readonly glyph: (code: string) => string | null;
  readonly padId: string | null;
}

const DPAD_ARROWS: Readonly<Record<string, PadArrow>> = {
  "D-pad Up": "up",
  "D-pad Down": "down",
  "D-pad Left": "left",
  "D-pad Right": "right"
};

/** A pad's D-pad reads as "D" and an arrow; any other label is printed as it is. */
export function hotkeyFor(label: string | null): Hotkey | null {
  if (label === null) return null;
  const arrow = DPAD_ARROWS[label];
  if (arrow) return { text: "D", arrow };
  return { text: label, arrow: null };
}

const FEED_LINES = 8;
const RUN_LOG_LINES = 40;
const FEED_HOLD_MS = 4000;
const FEED_FADE_MS = 2000;

let shownFeedKey: number | null = null;
let shownFeedAt = 0;

/** The log holds at full brightness for a few seconds after its newest line, then fades out, as the page log does. */
function feedAlphaNow(latestKey: number | null): number {
  const now = performance.now();
  if (latestKey !== null && latestKey !== shownFeedKey) {
    shownFeedKey = latestKey;
    shownFeedAt = now;
  }
  const elapsed = now - shownFeedAt;
  if (elapsed <= FEED_HOLD_MS) return 1;
  return Math.max(0, 1 - (elapsed - FEED_HOLD_MS) / FEED_FADE_MS);
}
const ITEM_KEYS: readonly { readonly icon: ItemIcon; readonly code: string }[] = [
  { icon: "medkit", code: "KeyH" },
  { icon: "bottle", code: "KeyG" },
  { icon: "fireworks", code: "KeyT" },
  { icon: "fountain", code: "KeyV" },
  { icon: "candy", code: "KeyX" },
  { icon: "knife", code: "KeyF" }
];

function itemRows(ctx: CanvasHudContext): ItemRow[] {
  const { hud } = ctx;
  const counts: Record<ItemIcon, number> = {
    medkit: hud.medkits,
    bottle: hud.bottles,
    fireworks: hud.fireworks,
    fountain: hud.fountains,
    candy: hud.candyCount,
    knife: hud.knife ? 1 : 0
  };
  return ITEM_KEYS.filter((item) => item.icon === "medkit" || counts[item.icon] > 0).map(
    (item) => ({
      icon: item.icon,
      text: item.icon === "knife" ? "" : String(counts[item.icon]),
      dim: item.icon === "medkit" && hud.medkits === 0,
      hotkey: hotkeyFor(ctx.glyph(item.code))
    })
  );
}

function pipsOf(hud: HudState, weapon: BarSlot["weapon"]): GunFitPips {
  const fit = hud.gear?.fits[weapon];
  const suppressed = rankOf(fit, "suppressor") > 0;
  return {
    plain: slotsUsed(fit) - rankOf(fit, "suppressor"),
    suppressed,
    quirk: Boolean(fit?.quirk),
    effect: effectOf(fit)
  };
}

function keepsakeRows(ctx: CanvasHudContext): KeepsakeRow[] {
  const offer = ctx.hud.keepsakeOffer ?? [];
  const codes = loadKeyBindings().keepsake;
  return offer.map((card, index) => {
    const code = codes[index] ?? "";
    return {
      id: card.id,
      code,
      keyLabel: ctx.device === "keys" && code ? formatKeyCode(code) : null,
      name: card.name,
      blurb: card.blurb
    };
  });
}

function questRows(lines: readonly TrackerLine[]): QuestRow[] {
  return lines.map((line) => ({
    title: line.title,
    filled: line.bar.filled,
    slots: line.bar.slots,
    value: line.ready ? "Ready" : line.bar.value,
    ready: line.ready,
    atRisk: line.atRisk
  }));
}

function driveRow(ui: UiState): DriveRow | null {
  const readout = driveReadout.value;
  if (!readout) return null;
  return {
    speed: formatSpeed(readout.speed, ui.speedUnit),
    heading: `${readout.heading}° (${readout.facing.toUpperCase()})`,
    body: readout.body,
    crash: readout.crash == null ? "none" : `${Math.round(readout.crash * 100)}%`
  };
}

export function canvasHudView(ctx: CanvasHudContext): CanvasHudView {
  const { ui, hud, device, glyph } = ctx;
  const slots = weaponBar(hud).map((slot) => ({
    ...slot,
    keyHint: weaponSlotLabel(slot.key, device),
    pips: pipsOf(hud, slot.weapon)
  }));
  const ammo = ammoWarning(hud);
  const swapKey = switchKey(hud);
  const needsReload = reloadPrompt(hud);
  const home = ui.home;
  const isTrip = home !== null && !home.inBunker;
  const hintLine = ui.hint ?? null;
  const feedLog = ui.log.slice(-FEED_LINES);
  const quests = home ? questTracker(home) : null;
  return {
    hud,
    place: ui.place,
    mode: ui.mode,
    signalWeak: ui.signalWeak,
    items: itemRows(ctx),
    sugar: hud.sugar.map((sugar) => ({ name: sugar.name, left: `${sugar.left}s` })),
    materials: materialChips(hud.materials, hud.backpackTier),
    moodles: (hud.moodles ?? []).map((moodle) => ({
      id: moodle.id,
      label: moodle.label,
      percentText: moodle.id === "bleeding" ? null : `${Math.round(moodle.value)}%`,
      remedy: moodle.remedy,
      severity: moodle.severity,
      hotkey: moodle.key ? hotkeyFor(glyph(moodle.key)) : null
    })),
    teammates: hud.teammates.map((mate) => ({
      name: mate.name,
      character: mate.character,
      color: mate.color,
      alive: mate.status === "alive",
      status: mate.status,
      fraction: mate.maxHealth > 0 ? Math.max(0, Math.min(1, mate.health / mate.maxHealth)) : 0
    })),
    boss: hud.boss
      ? { name: hud.boss.name, fraction: Math.max(0, Math.min(1, hud.boss.share)) }
      : null,
    keepsakes: hud.keepsakeOffer ? keepsakeRows(ctx) : [],
    feedAlpha: feedAlphaNow(ui.log.at(-1)?.key ?? null),
    logOpen: ui.logOpen,
    gunOnTop: gunOnTop.value,
    runLog: ui.log
      .slice(-RUN_LOG_LINES)
      .map((entry) => ({
        key: entry.key,
        at: entry.at,
        text: entry.text,
        detail: entry.detail,
        count: entry.count,
        tone: entry.tone
      })),
    logKey: hotkeyFor(glyph("KeyL")),
    feed: feedLog.map((entry, index) => ({
      key: entry.key,
      at: entry.at,
      text: entry.text,
      count: entry.count,
      age: feedLog.length - 1 - index,
      tone: entry.tone
    })),
    quests:
      quests === null
        ? null
        : { summary: quests.summary, lines: questRows(quests.lines), warning: quests.warning },
    treasure: isTrip ? carriedLines(home.carried) : null,
    drive: driveRow(ui),
    hint: hintLine
      ? hintText(hintLine.id, { hordes: hintLine.hordes }, { device, padId: ctx.padId })
      : "",
    bite: ui.bite ?? null,
    slots,
    ammo,
    horde: hordeStatus(hud),
    levelText: levelLine(hud.level),
    goal: levelGoal(hud),
    sidequest: levelSidequest(hud),
    effectLabel: (() => {
      const held = effectOf(hud.gear?.fits[hud.weapon]);
      return held === null ? null : GUN_EFFECTS[held].label;
    })(),
    swapPrompt:
      swapKey === null
        ? null
        : device === "pad"
          ? hotkeyFor(glyph("KeyQ"))
          : { text: String(swapKey), arrow: null },
    reloadPromptKey: needsReload ? hotkeyFor(glyph("KeyR")) : null,
    empty: ammo === "empty",
    reloadNeeded: needsReload,
    shoveKey: glyph("KeyF"),
    shoveLabel: hud.knife ? "Shove or Stab" : "Shove"
  };
}
