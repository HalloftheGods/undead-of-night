import type { GameStyle } from "../../shared/game-style.ts";
import type { TransportKind } from "../network/transport.ts";

/**
 * The Play page: one screen. How you play (mode), the difficulty and the survivor sit side by side as picks, each opening a
 * list of its options, with the callsign and co-op fields below and Start at the foot. The game style (Campaign or Arcade)
 * is not a pick: the title's buttons settle it before this page opens. The component only shows what it is told; every rule is here.
 */
export type PlayMode = "solo" | "multi";

export interface PlayFlow {
  readonly mode: PlayMode;
}

/** A plain visit to Play from a title button: the style is already chosen, and the player starts solo. */
export const PLAY_START: PlayFlow = { mode: "solo" };

/** An invite link lands on Play set to Multiplayer, the room code field showing. */
export const PLAY_JOIN: PlayFlow = { mode: "multi" };

/** A level picked on the Levels page: Arcade already, solo. */
export const PLAY_LEVEL: PlayFlow = { mode: "solo" };

export const STYLE_LABELS: Readonly<Record<GameStyle, string>> = {
  campaign: "Campaign",
  arcade: "Arcade",
  daily: "Nightly Run"
};

/** Said on the setup page when Campaign could not start. */
export const HOME_UNREADABLE = "The game could not open your saved home.";

/** How the page opens: an invite wins over a level, and a visit with neither is a plain solo one. */
export function startFlow(join: boolean, level: number | null): PlayFlow {
  if (join) return PLAY_JOIN;
  return level === null ? PLAY_START : PLAY_LEVEL;
}

/** Starting from the Levels page means Arcade, so the run's style is the player's choice only when no level was picked. */
export function setupStyle(level: number | null, chosen: GameStyle): GameStyle {
  return level === null ? chosen : "arcade";
}

/** The style the setup page may name: none on an invite link, since the room decides and only says so once the socket is open. */
export function claimedStyle(join: boolean, runStyle: GameStyle): GameStyle | null {
  return join ? null : runStyle;
}

/** A solo setup has no server to fail, so what an earlier co-op try left behind stays off it; only Campaign's unread save is worth saying there. */
export function setupFailure(
  mode: PlayMode,
  runStyle: GameStyle,
  error: string | null
): string | null {
  const unreadSave = runStyle === "campaign" && error === HOME_UNREADABLE;
  return mode === "multi" || unreadSave ? error : null;
}

/** An invite hides the style only while the room decides it: a player who turns to Solo plays their remembered one, and is told. */
export function showsStyleLabel(join: boolean, mode: PlayMode): boolean {
  return !join || mode === "solo";
}

/** Continue is Arcade's, and only solo: co-op restarts stay at level 1, and a Campaign run has no level to go back to. */
export function continuesAfterDeath(mode: TransportKind, runStyle: GameStyle | null): boolean {
  return mode === "solo" && runStyle === "arcade";
}

export function chooseMode(flow: PlayFlow, mode: PlayMode): PlayFlow {
  return { ...flow, mode };
}

/** The co-op fields (room code or server address) show only for Multiplayer. */
export function showsServer(flow: PlayFlow): boolean {
  return flow.mode === "multi";
}

/** The page is named for the run it starts: the style, or, on an invite still multiplayer, the room the player is joining. */
export function setupHeading(join: boolean, mode: PlayMode, runStyle: GameStyle): string {
  return showsStyleLabel(join, mode) ? STYLE_LABELS[runStyle] : "Join a Game";
}
