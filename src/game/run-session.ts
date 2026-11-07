import type { DifficultyId } from '../../shared/difficulty.ts';
import type { DailyNight } from './daily-night.ts';
import type { ShallowRef } from 'vue';
import { cleanCallsign } from '../../shared/callsign.ts';
import { playsFromHome } from '../../shared/game-style.ts';
import type { GameStyle } from '../../shared/game-style.ts';
import type { JoinHome } from '../../shared/home-protocol.ts';
import type { SnapshotPacket, WelcomePacket, WorldMap } from '../../shared/protocol.ts';
import type { AudioEngine } from '../audio/audio-engine.ts';
import type { WorldRenderer } from '../engine/world-renderer.ts';
import { LocalSession } from '../network/local-session.ts';
import { normalizeRoomCode } from '../../shared/lobby/room-code.ts';
import { onlineRoomsLive } from '../network/play-api.ts';
import type { RoomSession } from '../network/remote-session.ts';
import { resolveServerUrl, SocketSession } from '../network/socket-session.ts';
import type { GameTransport } from '../network/transport.ts';
import type { BenchLink } from './bench-link.ts';
import { ClientWorld } from './client-world.ts';
import { loadCharacter } from './character-pref.ts';
import { loadDifficulty } from './difficulty-pref.ts';
import type { HomeLink } from './home-link.ts';
import type { RunResult, UiState } from './hud-state.ts';
import type { InputManager } from './input-manager.ts';
import type { InputSender } from './input-sender.ts';
import { continueLevel, loadLevelProgress, soloStartLevel } from './level-progress.ts';
import { continuesAfterDeath, HOME_UNREADABLE } from './play-flow.ts';
import { NO_RUN_UI } from './run-hud.ts';
import type { RunHud } from './run-hud.ts';
import type { RunStage } from './run-stage.ts';
import { loadLeaderboard } from './storage.ts';
import { loadBests } from './trip-record.ts';

/** What a run keeps between snapshots, shared by the session and the snapshot handler. */
export interface RunState {
  transport: GameTransport | null;
  world: ClientWorld | null;
  /** Set from the moment the run ends, a beat before the results show. */
  runResult: RunResult | null;
  welcomed: boolean;
  lastSnapshotMs: number;
  gameOverAtMs: number;
  /** Highest level already written to storage this page load, so snapshots do not hit it every tick. */
  levelNoted: number;
  /** Whether the last snapshot was of the bunker, or null before any. */
  inBunker: boolean | null;
  /** The day of the Daily Night being played, or null for any other run. */
  daily: string | null;
}

/** The controller's parts a run reaches into. */
export interface RunHost {
  readonly state: RunState;
  readonly ui: ShallowRef<UiState>;
  readonly audio: AudioEngine;
  readonly input: InputManager;
  readonly inputs: InputSender;
  readonly runHud: RunHud;
  readonly stage: RunStage;
  readonly bench: BenchLink;
  readonly home: HomeLink;
  readonly renderer: WorldRenderer | null;
  readonly titleMap: WorldMap | null;
  publish(patch: Partial<UiState>): void;
  onResize(): void;
  /** Holds the picture (and, solo, the sim) still for a beat. */
  hitStop(ms: number): void;
}

const ONLINE_UNLOADED = 'Could not load online play. Check the connection and try again.';

export function newRunState(): RunState {
  return { transport: null, world: null, runResult: null, welcomed: false, lastSnapshotMs: 0, gameOverAtMs: 0, levelNoted: 0, inBunker: null, daily: null };
}

/** Starts, restarts and ends a run: the connection from menu to welcome to menu. */
export class RunSession {
  /** Counts reads of the save, so a room that changes its answer outdates the read before it. */
  private homeReads = 0;

  constructor(
    private readonly host: RunHost,
    private readonly onSnapshot: (snapshot: SnapshotPacket) => void,
  ) {}

  /** A fresh solo run: Campaign into the bunker, Arcade at level 1, or Arcade from `fromLevel` with the return kit. */
  startSolo(style: GameStyle, fromLevel?: number): void {
    if (!this.canStart()) return;
    this.host.audio.unlock();
    this.host.audio.playUi('start');
    this.host.publish({ mode: 'solo', error: null });
    this.host.state.daily = null;
    this.beginSession(new LocalSession(), style, fromLevel);
  }

  /** Today's town: its seed, level and difficulty, Arcade rules, solo. Its first run is the one that counts. */
  startDaily(night: DailyNight): void {
    if (!this.canStart()) return;
    this.host.audio.unlock();
    this.host.audio.playUi('start');
    this.host.publish({ mode: 'solo', error: null });
    this.host.state.daily = night.key;
    this.beginSession(new LocalSession(), 'arcade', night.level, { seed: night.seed, difficulty: night.difficulty });
  }

  /** Arcade from `chosen` (guarded by what is unlocked) or, with none, the furthest level reached. Does nothing if there is no later level to start at. */
  continueSolo(chosen?: number): void {
    const level = soloStartLevel(chosen, loadLevelProgress());
    const hasLevel = level !== null;
    if (hasLevel) this.startSolo('arcade', level);
  }

  /**
   * `style` is offered to an empty room. A room already playing keeps its own, and this run follows it.
   * In a build with online rooms, a blank field hosts one from this tab and a room code joins one over WebRTC.
   * Anything else, and every address in a build without them, is a LAN server.
   */
  startCoop(style: GameStyle): void {
    if (!this.canStart()) return;
    this.host.state.daily = null;
    this.host.audio.unlock();
    const text = this.host.ui.value.serverAddress.trim();
    const code = normalizeRoomCode(text);
    const online = onlineRoomsLive() && (!text || code.ok);
    if (online) {
      void this.startOnline(style, code.ok ? code.code : null);
      return;
    }
    const url = resolveServerUrl(text, window.location);
    const badAddress = url === null;
    if (badAddress) {
      this.host.publish({ error: 'That server address does not look right.' });
      return;
    }
    this.openCoop(new SocketSession(url), style);
  }

  /** The online room code is fetched on first use, with the menu held in its connecting state meanwhile. */
  private async startOnline(style: GameStyle, code: string | null): Promise<void> {
    this.host.publish({ connecting: true, error: null });
    let rooms: typeof import('../network/online-session.ts');
    try {
      rooms = await import('../network/online-session.ts');
    } catch {
      this.host.publish({ connecting: false, error: ONLINE_UNLOADED });
      return;
    }
    // Left the menu, or something else started, while the code was on its way.
    const { screen, connecting } = this.host.ui.value;
    const stillWanted = screen === 'title' && connecting && this.host.state.transport === null;
    if (!stillWanted) return;
    const events = {
      onHosted: (room: string) => this.host.publish({ onlineRoom: room }),
      onUnlisted: () => this.host.publish({ onlineRoom: null }),
    };
    const session = code === null ? rooms.hostRoom(style, events) : rooms.joinRoom(code);
    this.openCoop(session, style);
  }

  private openCoop(session: RoomSession, style: GameStyle): void {
    this.host.audio.playUi('start');
    this.host.publish({ mode: 'coop', error: null, connecting: true, onlineRoom: null });
    session.onRoom = (room) => this.answerRoom(session, room ?? style);
    this.beginSession(session, style);
  }

  playAgain(fromLevel?: number): void {
    const { state, ui } = this.host;
    const won = state.runResult?.stats.outcome === 'victory';
    const canRestart = ui.value.screen === 'gameover' && !ui.value.restarting && !won;
    if (!canRestart) return;
    this.host.audio.playUi('start');
    this.host.publish({ restarting: true });
    state.transport?.requestRestart(fromLevel);
  }

  /** After a solo death in Arcade: back in at the furthest level reached. Co-op restarts stay at level 1. */
  continueAgain(): void {
    const { mode, runStyle } = this.host.ui.value;
    const isRunOver = !continuesAfterDeath(mode, runStyle);
    if (isRunOver) return;
    const level = continueLevel(loadLevelProgress());
    const hasLevel = level !== null;
    if (hasLevel) this.playAgain(level);
  }

  toMenu(): void {
    const { state, input, audio, titleMap, renderer } = this.host;
    this.host.home.leave();
    this.host.home.close();
    state.transport?.disconnect();
    state.transport = null;
    state.world = null;
    state.runResult = null;
    input.setEnabled(false);
    audio.setScene('menu');
    this.host.onResize();
    const hasTitleMap = titleMap !== null;
    if (hasTitleMap) renderer?.setMap(titleMap);
    this.host.publish({ ...NO_RUN_UI, screen: 'title', connecting: false, runStyle: null, onlineRoom: null, ...loadBests(), leaderboard: loadLeaderboard() });
  }

  onWelcome(packet: WelcomePacket): void {
    const { state, stage } = this.host;
    state.welcomed = true;
    this.host.home.welcomed(packet);
    state.world = new ClientWorld(stage.open(packet.mapSeed, packet.level), packet.yourId);
    this.beginRun();
  }

  beginRun(): void {
    const { state, input, inputs, runHud } = this.host;
    state.runResult = null;
    state.inBunker = null;
    inputs.reset();
    runHud.reset();
    this.host.onResize();
    input.setEnabled(true);
    this.host.publish({ ...NO_RUN_UI, screen: 'game', connecting: false });
  }

  onClosed(reason: string): void {
    const { state, input, audio, titleMap, renderer } = this.host;
    this.host.home.close();
    state.transport = null;
    if (!state.welcomed) {
      this.host.publish({ connecting: false, runStyle: null, onlineRoom: null, error: reason });
      return;
    }
    state.world = null;
    state.runResult = null;
    input.setEnabled(false);
    audio.setScene('menu');
    this.host.onResize();
    const hasTitleMap = titleMap !== null;
    if (hasTitleMap) renderer?.setMap(titleMap);
    this.host.publish({ ...NO_RUN_UI, screen: 'lost', runStyle: null, onlineRoom: null, lostReason: reason });
  }

  private canStart(): boolean {
    const { art, connecting, screen } = this.host.ui.value;
    return art !== null && !connecting && screen === 'title';
  }

  /** The run plays this style from here on. What the player last chose stays apart from it, in `ui.style`. */
  private followStyle(style: GameStyle): void {
    this.host.audio.setStyle(style);
    this.host.publish({ runStyle: style });
  }

  private beginSession(transport: GameTransport, style: GameStyle, startLevel?: number, fixed: { seed?: number; difficulty?: DifficultyId } = {}): void {
    const { state, ui } = this.host;
    state.transport = transport;
    state.welcomed = false;
    transport.onWelcome = (packet) => this.onWelcome(packet);
    transport.onSnapshot = this.onSnapshot;
    transport.onClosed = (reason) => this.onClosed(reason);
    this.followStyle(style);
    // No callsign (blank or refused) goes out as '': every screen then labels the player by survivor name.
    const options = { name: cleanCallsign(ui.value.callsign), difficulty: fixed.difficulty ?? loadDifficulty(), character: loadCharacter(), style, ...(fixed.seed === undefined ? {} : { seed: fixed.seed }) };
    const roomDecides = transport.kind === 'coop';
    const shouldConnect = roomDecides || !playsFromHome(style);
    if (shouldConnect) transport.connect({ ...options, startLevel });
    else this.readHome(transport, (home) => transport.connect({ ...options, home }));
  }

  /** The room has said what it plays, and the screens, the music and the save follow it. */
  private answerRoom(session: RoomSession, style: GameStyle): void {
    this.followStyle(style);
    const isHomeStyle = playsFromHome(style);
    if (isHomeStyle) {
      this.readHome(session, (home) => session.join(style, home));
      return;
    }
    this.homeReads += 1;
    this.host.home.close();
    session.join(style);
  }

  /** The save is read first, so the room hears of the gear before it hears of the player. A level is picked at the garage, not here. */
  private readHome(transport: GameTransport, bring: (home: JoinHome) => void): void {
    const { state, home } = this.host;
    this.host.publish({ connecting: true });
    this.homeReads += 1;
    const read = this.homeReads;
    const stillWanted = (): boolean => state.transport === transport && read === this.homeReads;
    const answer = (join: JoinHome): void => {
      const wanted = stillWanted();
      if (wanted) bring(join);
    };
    const giveUp = (): void => {
      const gone = !stillWanted();
      if (gone) return;
      state.transport = null;
      transport.disconnect();
      // Left open, the next run would write through a save that never finished opening.
      home.close();
      this.host.publish({ connecting: false, runStyle: null, onlineRoom: null, error: HOME_UNREADABLE });
    };
    void home.open(transport.kind).then(answer, giveUp);
  }
}
