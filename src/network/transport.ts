import type { ItemMove } from "../../shared/item-move.ts";
import type { DifficultyId } from "../../shared/difficulty.ts";
import type { EmoteId } from "../../shared/emotes.ts";
import type { GameStyle } from "../../shared/game-style.ts";
import type { HomeAction, JoinHome } from "../../shared/home-protocol.ts";
import type {
  ClientInputPacket,
  LobbyStatePacket,
  SnapshotPacket,
  WelcomePacket
} from "../../shared/protocol.ts";
import type { BenchAction } from "../../shared/workbench.ts";

export type TransportKind = "solo" | "coop";

export interface ConnectOptions {
  readonly name: string;
  /** Solo plays on this difficulty; in co-op the server uses it only if this player is first into the room. */
  readonly difficulty?: DifficultyId;
  readonly character?: number;
  readonly startLevel?: number;
  /** The gear and highest level this player brings to a Campaign run. */
  readonly home?: JoinHome;
  /** Solo plays in this style, and left off that is Arcade. In co-op the room decides, so `RemoteSession.join` is told instead. */
  readonly style?: GameStyle;
  /** Solo only: the run's seed, so a Nightly Run is the same town for everyone. Left off, a random one. */
  readonly seed?: number;
  /** Solo Arcade and Nightly Run only: the night of the player's streak, which picks the streak kit (`shared/streak-kit.ts`). */
  readonly streakNight?: number;
  /** Solo only: a Test Drive run, where every car drives and the exit van never comes. */
  readonly testDrive?: boolean;
  /** Solo only: the HUD test town, with no zombies and nobody who can die. Set by the dev HUD page. */
  readonly hudTest?: boolean;
  /** Solo dev only: promo scene featuring all 5 survivors in their new sprites and active zombie horde. */
  readonly promoScene?: boolean;
}

/** The one seam between the game client and a simulation, in-browser or over ws. */
export interface GameTransport {
  readonly kind: TransportKind;
  /** How far behind the newest snapshot remote entities are drawn. */
  readonly interpolationDelayMs: number;
  onWelcome: (packet: WelcomePacket) => void;
  onSnapshot: (packet: SnapshotPacket) => void;
  onLobbyState?: (packet: LobbyStatePacket) => void;
  /** Fires at most once, and never after disconnect(). */
  onClosed: (reason: string) => void;
  connect(options: ConnectOptions): void;
  sendInput(input: ClientInputPacket): void;
  sendBench(action: BenchAction): void;
  /** One item moved in the loot window, as it happens. The host answers `move_ok` / `move_no` by id. */
  sendMove(move: ItemMove): void;
  /** A container's window opened or closed, so the host keeps its contents live in snapshots. */
  sendView(id: number, open: boolean): void;
  sendHome(action: HomeAction): void;
  sendDebriefContinue?(): void;
  sendLobbyReady?(ready?: boolean): void;
  sendLobbyStart?(): void;
  sendLobbyToggleTimer?(): void;
  /** An icon over this survivor for everyone, paced by the room. */
  sendEmote(emote: EmoteId): void;
  /** Awards a level-up boon buff without pausing or requiring item in bag. */
  giveBoon?(count: number): void;
  /** Solo can begin again from a later level; co-op restarts at level 1 and ignores it. */
  requestRestart(fromLevel?: number): void;
  setPaused(paused: boolean): void;
  /** Solo only: stop the clock for a beat (a hit-stop), then carry on unless paused meanwhile. */
  hold?(ms: number): void;
  /** Solo only: one tick while paused, so a candy picked behind the bag is eaten there and then. */
  stepHeld?(): void;
  disconnect(): void;
}
