import { shallowRef, watch } from 'vue';
import type { ShallowRef } from 'vue';
import { capCallsign } from '../../shared/callsign.ts';
import type { EmoteId } from '../../shared/emotes.ts';
import type { GameStyle } from '../../shared/game-style.ts';
import type { WorldMap } from '../../shared/protocol.ts';
import { generateWorldMap } from '../../shared/world-map.ts';
import { buildArtBook } from '../art/index.ts';
import { AudioEngine } from '../audio/audio-engine.ts';
import { EMPTY_SCENE } from '../engine/scene.ts';
import { WorldRenderer } from '../engine/world-renderer.ts';
import { LocalSession } from '../network/local-session.ts';
import { BenchLink } from './bench-link.ts';
import { todaysNight } from './daily-night.ts';
import { HomeLink } from './home-link.ts';
import type { HomeLinkHost } from './home-link.ts';
import type { HomeActions } from './home-hud.ts';
import { overrunOn } from './home-mode.ts';
import { createBrowserHomeStore } from './home/browser-home-store.ts';
import type { HomeStore } from './home/home-store.ts';
import type { UiState } from './hud-state.ts';
import { InputManager } from './input-manager.ts';
import { InputSender } from './input-sender.ts';
import { RunFrame } from './run-frame.ts';
import { NO_RUN_UI, RunHud } from './run-hud.ts';
import { newRunState, RunSession } from './run-session.ts';
import type { RunHost, RunState } from './run-session.ts';
import { RunStage } from './run-stage.ts';
import { SnapshotHandler } from './snapshot-handler.ts';
import { browserStore, DEFAULT_PREFS, loadLeaderboard, loadPrefs, savePrefs } from './storage.ts';
import { motion } from './motion.ts';
import { loadStyle, saveStyle } from './style-pref.ts';
import { loadBests } from './trip-record.ts';
import { isTouchDevice } from './touch-input.ts';
import { fitWindow, watchDpr } from './view-fit.ts';
import { applyPalette, loadDisplayPrefs, saveDisplayPrefs, UI_SCALES, type PaletteId, type UiScale } from './display-prefs.ts';


const MAX_FRAME_DT = 0.05;
const TITLE_MAP_SEED = 20417;
const ART_DELAY_MS = 40;

type UiSound = 'click' | 'hover' | 'start' | 'pause' | 'resume';

export interface GameControllerOptions {
  /** Where the home save lives. */
  readonly homeStore?: () => HomeStore;
}

/** Owns a run from menu to game over. Vue only sees the small state in `ui`. */
export class GameController {
  readonly ui: ShallowRef<UiState>;
  /** The workbench screen's way to the run. */
  readonly bench: BenchLink;
  /** The home screens' way to the save and the run. */
  readonly home: HomeActions;

  /** The touch buttons press through this. */
  readonly input: InputManager;
  readonly audio = new AudioEngine();
  private readonly inputs: InputSender;
  private readonly runHud: RunHud;
  private readonly stage: RunStage;
  private readonly run: RunState = newRunState();
  private readonly session: RunSession;
  private readonly snapshots: SnapshotHandler;
  private readonly homeLink: HomeLink;
  private readonly runFrame: RunFrame;
  private renderer: WorldRenderer | null = null;
  private titleMap: WorldMap | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private raf = 0;
  private artTimer: ReturnType<typeof setTimeout> | null = null;
  private lastFrameMs = 0;
  private lastSnapshotMs = 0;
  private titleTime = 0;

  constructor(options: GameControllerOptions = {}) {
    const prefs = loadPrefs();
    const display = loadDisplayPrefs(browserStore());
    applyPalette(display.palette);
    this.ui = shallowRef<UiState>({
      touch: isTouchDevice(),
      screen: 'title',
      art: null,
      mode: 'solo',
      connecting: false,
      error: null,
      style: loadStyle(),
      runStyle: null,
      ...NO_RUN_UI,
      lostReason: '',
      signalWeak: false,
      ...loadBests(),
      leaderboard: loadLeaderboard(),
      callsign: prefs.callsign || DEFAULT_PREFS.callsign,
      serverAddress: prefs.serverAddress,
      onlineRoom: null,
      volume: this.audio.volume,
      musicVolume: this.audio.musicVolume,
      sfxVolume: this.audio.sfxVolume,
      muted: this.audio.muted,
      ...display,
    });
    this.homeLink = new HomeLink({ store: options.homeStore ?? createBrowserHomeStore, host: this.homeHost() });
    this.home = this.homeLink.actions;
    this.runHud = new RunHud(() => this.ui.value, (patch) => this.publish(patch), () => this.homeLink.facts());
    this.stage = new RunStage(this.runHud, () => this.renderer);
    this.input = new InputManager({
      onGesture: () => this.audio.unlock(),
      onPause: () => this.togglePause(),
      onMute: () => this.toggleMute(),
      onConfirm: () => this.confirm(),
      onMap: () => this.toggleMap(),
      mapUsable: () => this.canUseMap(),
      onLog: () => this.toggleLog(),
      onTouchSeen: () => { this.publish({ touch: true }); this.onResize(); },
    });
    this.inputs = new InputSender(this.input);
    this.bench = new BenchLink({
      transport: () => this.run.transport,
      menuUp: () => this.isMenuUp(),
      setInputEnabled: (enabled) => this.input.setEnabled(enabled && !this.homeLink.holdsControls),
      settle: () => this.sendNeutralInput(),
    });
    const host = this.runHost();
    this.snapshots = new SnapshotHandler(host, () => this.session.beginRun());
    this.session = new RunSession(host, (snapshot) => this.snapshots.onSnapshot(snapshot));
    this.runFrame = new RunFrame({
      parts: host,
      menuUp: () => this.isMenuUp(),
      playing: () => this.isPlaying(),
      overrunOn: overrunOn(globalThis.location?.search ?? '', import.meta.env.DEV),
    });
  }


  /** The studio splash's chime, on the gesture that skips it. */
  greet(): void {
    void this.audio.unlock();
    this.audio.playUi('start');
  }

  /** Exposed for the dev handle: the running simulation, in solo. */
  get sim() {
    return this.run.transport instanceof LocalSession ? this.run.transport.sim : null;
  }

  mount(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.onResize();
    window.addEventListener('resize', this.onResize);
    this.stopDprWatch = watchDpr(this.onResize);
    window.addEventListener('blur', this.onAway);
    document.addEventListener('visibilitychange', this.onVisibility);
    this.raf = requestAnimationFrame(this.frame);
    // Baking the art blocks for a moment: let the title paint first.
    this.artTimer = setTimeout(() => this.loadArt(), ART_DELAY_MS);
    this.stopMotionWatch = watch([motion.reduced, motion.shake], ([reduced, shake]) => this.renderer?.setMotion(reduced, shake));
    this.audio.setScene('menu');
  }

  dispose(): void {
    cancelAnimationFrame(this.raf);
    if (this.artTimer) clearTimeout(this.artTimer);
    window.removeEventListener('resize', this.onResize);
    this.stopDprWatch();
    this.stopMotionWatch();
    window.removeEventListener('blur', this.onAway);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.input.dispose();
    this.homeLink.close();
    this.run.transport?.disconnect();
    this.run.transport = null;
    this.audio.dispose();
  }

  attachTownCanvas(canvas: HTMLCanvasElement | null): void {
    this.runHud.attachTownCanvas(canvas);
  }

  private loadArt(): void {
    const canvas = this.canvas;
    if (!canvas) return;
    const art = buildArtBook();
    this.renderer = new WorldRenderer(canvas, art, motion.reduced.value, motion.shake.value);
    this.titleMap = generateWorldMap(TITLE_MAP_SEED);
    this.renderer.setMap(this.titleMap);
    this.publish({ art });
  }

  private publish(patch: Partial<UiState>): void {
    this.ui.value = { ...this.ui.value, ...patch };
  }

  private stopDprWatch: () => void = () => {};
  private stopMotionWatch: () => void = () => {};

  private readonly onResize = (): void => {
    fitWindow(this.renderer, this.run.transport?.kind === 'coop', this.ui.value.touch, UI_SCALES[this.ui.value.uiScale]);
  };

  /** A hidden tab gets no frames, so solo would otherwise be eaten alive unseen. */
  private readonly onVisibility = (): void => {
    if (document.hidden) this.onAway();
  };

  /** The player has gone: to another tab, or to a window beside this one that leaves the game in view. */
  private readonly onAway = (): void => {
    this.input.clearHeld();
    const shouldPause = this.run.transport?.kind === 'solo' && this.isPlaying() && !this.isMenuUp();
    if (shouldPause) this.flipPause();
    else this.sendNeutralInput();
  };

  private isPlaying(): boolean {
    return this.ui.value.screen === 'game' && this.run.runResult === null;
  }

  private isMenuUp(): boolean {
    return this.ui.value.paused || this.ui.value.mapOpen;
  }

  // --- Commands from the menus ---------------------------------------------

  setCallsign(callsign: string): void {
    this.publish({ callsign: capCallsign(callsign) });
    this.savePrefs();
  }

  setServerAddress(serverAddress: string): void {
    this.publish({ serverAddress });
    this.savePrefs();
  }

  private savePrefs(): void {
    const { callsign, serverAddress } = this.ui.value;
    savePrefs({ callsign, serverAddress });
  }

  setVolume(volume: number): void {
    this.audio.volume = volume;
    this.publish({ volume });
  }

  setMusicVolume(musicVolume: number): void {
    this.audio.musicVolume = musicVolume;
    this.publish({ musicVolume });
  }

  setSfxVolume(sfxVolume: number): void {
    this.audio.sfxVolume = sfxVolume;
    this.publish({ sfxVolume });
  }

  /** Hit and danger colors: the classic red and green, or a pair that reads for red-green colorblind players. */
  setPalette(palette: PaletteId): void {
    applyPalette(palette);
    this.publish({ palette });
    this.saveDisplay();
  }

  /** The HUD and menus, bigger for a small phone screen. */
  setUiScale(uiScale: UiScale): void {
    this.publish({ uiScale });
    this.saveDisplay();
    this.onResize();
  }

  private saveDisplay(): void {
    const { palette, uiScale } = this.ui.value;
    saveDisplayPrefs(browserStore(), { palette, uiScale });
  }

  toggleMute(): void {
    this.audio.muted = !this.audio.muted;
    this.publish({ muted: this.audio.muted });
  }

  playUi(sound: UiSound): void {
    this.audio.playUi(sound);
  }

  /** The player's pick on the Play page, remembered for next time. Starting a run does not change it. */
  chooseStyle(style: GameStyle): void {
    saveStyle(style);
    this.publish({ style });
  }

  /** A fresh solo run in `style`, by default the one the player last chose. */
  startSolo(style: GameStyle = this.ui.value.style): void {
    this.session.startSolo(style);
  }

  /** Arcade from `chosen` (guarded by what is unlocked) or, with none, the furthest level reached. Does nothing if there is no later level to start at. */
  continueSolo(chosen?: number): void {
    this.session.continueSolo(chosen);
  }

  /** Today's Daily Night: solo, Arcade rules, the day's seed, level and difficulty. */
  startDaily(): void {
    this.session.startDaily(todaysNight());
  }

  /** Co-op. `style`, by default the one the player last chose, goes to an empty room; a room in play keeps its own and the run follows it. */
  startCoop(style: GameStyle = this.ui.value.style): void {
    this.session.startCoop(style);
  }

  /** A menu is over the game: solo stops, and co-op stands still while the town carries on. */
  private holdRun(held: boolean): void {
    this.run.transport?.setPaused(held);
    this.input.setEnabled(this.controlsFree(held));
    this.audio.playUi(held ? 'pause' : 'resume');
    if (held) this.sendNeutralInput();
  }

  /** The keys are the player's unless a menu, the bench, or a station, summary or ending at home has them. */
  private controlsFree(menuUp: boolean): boolean {
    return !menuUp && !this.bench.open && !this.homeLink.holdsControls;
  }

  /** A station opening or closing takes the keys without pausing the run. */
  private syncControls(): void {
    const free = this.controlsFree(this.isMenuUp());
    this.input.setEnabled(free);
    if (!free) this.sendNeutralInput();
  }

  /** Esc puts an open station away before it asks for the pause menu. */
  togglePause(): void {
    const stationOpen = !this.ui.value.paused && this.homeLink.closeOpenStation();
    if (stationOpen) return;
    this.flipPause();
  }

  private flipPause(): void {
    if (!this.isPlaying()) return;
    const shutOverlay = this.shutOverlay();
    if (shutOverlay) return;
    const paused = !this.ui.value.paused;
    this.holdRun(paused);
    this.publish({ paused });
  }

  /** Esc shuts the log, or else the map, before it reaches the pause menu. True if either was open. */
  private shutOverlay(): boolean {
    const { logOpen, mapOpen } = this.ui.value;
    if (logOpen) this.publish({ logOpen: false });
    else if (mapOpen) this.toggleMap();
    return logOpen || mapOpen;
  }

  /** An icon over this survivor for the team; the wheel is only offered in co-op. */
  sendEmote(emote: EmoteId): void {
    this.run.transport?.sendEmote(emote);
  }

  private canUseMap(): boolean {
    return this.isPlaying() && !this.ui.value.paused && !this.homeLink.holdsControls;
  }

  /** True if the key did something, which it does not behind the pause menu or off a run. */
  toggleMap(): boolean {
    if (!this.canUseMap()) return false;
    const mapOpen = !this.ui.value.mapOpen;
    this.holdRun(mapOpen);
    this.publish({ mapOpen });
    return true;
  }

  /** The run's full log, over the run, which keeps going. Not behind a menu or the map. */
  toggleLog(): boolean {
    const free = this.isPlaying() && !this.ui.value.paused && !this.ui.value.mapOpen;
    return free && this.runHud.toggleLog();
  }

  playAgain(fromLevel?: number): void {
    this.session.playAgain(fromLevel);
  }

  /** After a solo death in Arcade: back in at the furthest level reached. Co-op restarts stay at level 1. */
  continueAgain(): void {
    this.session.continueAgain();
  }

  /** The ending screens pick their own track once the tally is read. */
  endingMusic(scene: 'victory' | 'credits'): void {
    this.audio.setScene(scene);
  }

  /** At home the credits end in the bunker, in the same session. */
  toMenu(): void {
    if (this.homeLink.endingShowing) this.homeLink.actions.continueFromEnding();
    else this.session.toMenu();
  }

  /** The title has no say here: its menu answers Enter, and only Start or Join begins a run. */
  private confirm(): void {
    const answered = this.homeLink.confirm();
    if (answered) return;
    const { screen } = this.ui.value;
    if (screen === 'gameover') this.playAgain();
    else if (screen === 'lost') this.toMenu();
    else if (this.isMenuUp()) this.togglePause();
  }

  /** The parts of this controller a run reaches into. */
  private runHost(): RunHost {
    // Getters read the live renderer and map, so they need the controller itself, not a snapshot.
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const controller = this;
    return {
      state: this.run,
      ui: this.ui,
      audio: this.audio,
      input: this.input,
      inputs: this.inputs,
      runHud: this.runHud,
      stage: this.stage,
      bench: this.bench,
      home: this.homeLink,
      get renderer() { return controller.renderer; },
      get titleMap() { return controller.titleMap; },
      publish: (patch) => this.publish(patch),
      onResize: () => this.onResize(),
      hitStop: (ms) => this.hitStop(ms),
    };
  }

  /** The parts of this controller a home session reaches into. */
  private homeHost(): HomeLinkHost {
    return {
      transport: () => this.run.transport,
      ui: () => this.ui.value,
      localPlayer: () => this.run.world?.localPlayer ?? null,
      refresh: () => this.runHud.refreshHome(this.run.world),
      syncControls: () => this.syncControls(),
      say: (banner, nowMs) => this.runHud.say(banner, nowMs),
      showEnding: (result) => {
        this.audio.setScene('victory');
        this.publish({ screen: 'gameover', result, banner: null, place: null });
      },
      hideEnding: () => {
        this.audio.setScene('bunker');
        this.publish({ screen: 'game', result: null });
      },
    };
  }

  /** Solo only: the sim and the picture stop together, so nothing drifts. In co-op the town carries on, so the picture does too. */
  private hitStop(ms: number): void {
    const transport = this.run.transport;
    const skipsHitStop = transport?.kind !== 'solo' || this.isMenuUp();
    if (skipsHitStop) return;
    transport.hold?.(ms);
    this.runFrame.holdFor(ms);
  }

  // --- Frame loop ----------------------------------------------------------

  private readonly frame = (ms: number): void => {
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(MAX_FRAME_DT, (ms - this.lastFrameMs) / 1000);
    this.lastFrameMs = ms;
    const renderer = this.renderer;
    if (!renderer) return;
    if (this.run.world) this.runFrame.draw(renderer, this.run.world, ms, dt);
    else this.frameTitle(renderer, dt);
  };

  /** The city at night behind the menu, drifting past with nobody in it. */
  private frameTitle(renderer: WorldRenderer, dt: number): void {
    const map = this.titleMap;
    if (!map) return;
    this.titleTime += dt;
    const focusX = map.width / 2 + Math.sin(this.titleTime * 0.04) * map.width * 0.3;
    const focusY = map.height / 2 + Math.cos(this.titleTime * 0.031) * map.height * 0.3;
    renderer.render({ ...EMPTY_SCENE, focusX, focusY }, dt);
  }

  private sendNeutralInput(): void {
    const { transport, world } = this.run;
    const inRun = world !== null && transport !== null;
    if (inRun) this.inputs.sendNeutral(transport, world);
  }
}