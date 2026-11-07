/**
 * Turns what the game already says (screens, the HUD, the event stream) into a handful of summaries:
 * one event per level or run, never per shot. It only reads; it never touches the simulation.
 */
import { characterOf } from '../../../shared/characters.ts';
import type { GameEvent, GameOverStats, ZombieType } from '../../../shared/protocol.ts';
import { isRadioFound } from '../sound-unlock.ts';
import type { BenchAction } from '../../../shared/workbench.ts';
import { gunRounds } from '../hud-state.ts';
import type { HudState, UiState } from '../hud-state.ts';
import { FRAME_GAP_LIMIT_MS } from './analytics-config.ts';
import { fpsBand, scoreBand } from './bands.ts';
import type { EventName } from './catalog.ts';

export type Emit = (name: EventName, params: Readonly<Record<string, unknown>>) => void;

/** What is true of this player's setup, read when it is needed. */
export interface Profile {
  readonly difficulty: string;
  readonly survivor: string;
  readonly input: 'touch' | 'mouse';
  readonly orientation: 'landscape' | 'portrait';
}

export interface TrackerDeps {
  readonly emit: Emit;
  readonly now: () => number;
  readonly profile: () => Profile;
}

export type TrackedUi = Pick<UiState, 'screen' | 'mode' | 'hud'>;

/** Title pages that count as an event when they open. The one place to add the rest. */
export const TITLE_PAGE_EVENTS: Readonly<Record<string, EventName>> = {
  play: 'play_setup_open',
  howto: 'how_to_play_open',
  sound: 'sound_test_open',
};

/** Frames needed before a frame rate means anything. */
const MIN_FRAMES = 30;

function ammoOf(hud: HudState): number {
  return hud.owned.reduce((sum, weapon) => sum + gunRounds(hud, weapon), 0);
}

export class RunTracker {
  private readonly deps: TrackerDeps;
  private screen: TrackedUi['screen'] | null = null;
  private localId: string | null = null;
  private running = false;
  /** The run just ended while the game screen is still up: the HUD keeps publishing, and must not start another. */
  private finished = false;
  /** A level began before the run was announced: sent right after run_start. */
  private levelWaiting = false;
  private room: string | null = null;
  private benchOpen = false;
  private level = 0;
  private levelStartMs = 0;
  private runStartMs = 0;
  private shots = 0;
  private dryFires = 0;
  private downs = 0;
  private ammoLeft = 0;
  private score = 0;
  private levelKills = 0;
  private levelHeadshots = 0;
  private levelDamage = 0;
  private levelSearches = 0;
  private runKills = 0;
  private runHeadshots = 0;
  private runDamage = 0;
  private runSearches = 0;
  private lastAttacker: ZombieType | 'unknown' = 'unknown';
  private frames = 0;
  private framedMs = 0;
  private lastFrameMs: number | null = null;

  constructor(deps: TrackerDeps) {
    this.deps = deps;
  }

  /** A run is under way: the listener keeps a frame counter going only then. */
  get inRun(): boolean {
    return this.running;
  }

  localPlayer(id: string): void {
    this.localId = id;
  }

  ui(state: TrackedUi): void {
    const previous = this.screen;
    this.screen = state.screen;
    const moved = previous !== state.screen;
    if (moved) this.finished = false;
    if (moved) this.onScreen(previous, state.screen);
    this.watchHud(state);
  }

  private onScreen(previous: TrackedUi['screen'] | null, screen: TrackedUi['screen']): void {
    const toTitle = screen === 'title';
    const leftRun = this.running && previous === 'game';
    const dropped = leftRun && screen === 'lost';
    const quit = leftRun && toTitle;
    if (toTitle) this.levelWaiting = false;
    const hasLeftGame = screen !== 'game';
    if (hasLeftGame) this.room = null;
    if (toTitle) this.deps.emit('title_view', {});
    if (quit) this.endRun('quit');
    if (dropped) this.endRun('disconnected');
  }

  private watchHud(state: TrackedUi): void {
    const hud = state.hud;
    const inGame = state.screen === 'game' && hud !== null;
    if (!inGame) {
      this.benchOpen = false;
      return;
    }
    this.ammoLeft = ammoOf(hud);
    this.score = hud.score;
    const fresh = !this.running && !this.finished;
    if (fresh) this.startRun(state.mode, hud);
    const benchNow = hud.bench !== null;
    const justOpened = benchNow && !this.benchOpen;
    if (justOpened) this.deps.emit('workbench_use', { level: hud.level });
    this.benchOpen = benchNow;
  }

  private startRun(mode: TrackedUi['mode'], hud: HudState): void {
    this.running = true;
    this.runStartMs = this.deps.now();
    this.runKills = 0;
    this.runHeadshots = 0;
    this.runDamage = 0;
    this.runSearches = 0;
    this.lastAttacker = 'unknown';
    this.frames = 0;
    this.framedMs = 0;
    this.lastFrameMs = null;
    const levelUnknown = this.level === 0;
    const isCoop = mode === 'coop';
    if (levelUnknown) this.level = hud.level;
    this.deps.emit('run_start', { ...this.profile(), mode, start_level: this.level });
    if (isCoop) this.deps.emit('coop_join', {});
    if (this.levelWaiting) this.announceLevel();
  }

  /** The room's difficulty, when the server said: a guest plays the host's, not their own saved one. */
  roomDifficulty(difficulty: string): void {
    this.room = difficulty;
  }

  private profile(): Profile {
    const own = this.deps.profile();
    return this.room === null ? own : { ...own, difficulty: this.room };
  }

  private announceLevel(): void {
    this.levelWaiting = false;
    const { difficulty, survivor } = this.profile();
    this.deps.emit('level_start', { level: this.level, difficulty, survivor });
  }

  event(event: GameEvent): void {
    const isMine = 'playerId' in event && event.playerId === this.localId;
    const radio = isRadioFound(event) && isMine;
    if (radio) this.deps.emit('radio_found', { level: this.level });
    switch (event.type) {
      case 'shot':
        this.shots += isMine ? 1 : 0;
        break;
      case 'dry_fire':
        this.dryFires += isMine ? 1 : 0;
        break;
      case 'player_downed':
        this.downs += isMine ? 1 : 0;
        break;
      case 'player_hurt':
        if (isMine) {
          this.levelDamage += event.damage;
          this.runDamage += event.damage;
        }
        break;
      case 'container_opened':
        if (isMine) {
          this.levelSearches += 1;
          this.runSearches += 1;
        }
        break;
      case 'headshot':
        if (isMine) {
          this.levelHeadshots += 1;
          this.runHeadshots += 1;
        }
        break;
      case 'zombie_die': {
        const isMyKill = event.killerId === this.localId;
        if (isMyKill) {
          this.levelKills += 1;
          this.runKills += 1;
        }
        break;
      }
      case 'zombie_attack':
        this.lastAttacker = event.zombieType;
        break;
      case 'bloater_burst':
        this.lastAttacker = 'bloater';
        break;
      case 'level_start':
        this.startLevel(event.level);
        break;
      case 'level_complete':
        this.completeLevel(event.level);
        break;
      case 'game_over':
        this.finish(event.stats);
        break;
      default:
        break;
    }
  }

  private startLevel(level: number): void {
    this.level = level;
    this.levelStartMs = this.deps.now();
    this.shots = 0;
    this.dryFires = 0;
    this.downs = 0;
    this.levelKills = 0;
    this.levelHeadshots = 0;
    this.levelDamage = 0;
    this.levelSearches = 0;
    this.levelWaiting = true;
    if (this.running) this.announceLevel();
  }

  private completeLevel(level: number): void {
    const { difficulty, survivor } = this.profile();
    this.deps.emit('level_complete', {
      level,
      seconds: (this.deps.now() - this.levelStartMs) / 1000,
      downs: this.downs,
      ammo_left: this.ammoLeft,
      shots_fired: this.shots,
      dry_fires: this.dryFires,
      kills: this.levelKills,
      headshots: this.levelHeadshots,
      damage_taken: this.levelDamage,
      containers_searched: this.levelSearches,
      difficulty,
      survivor,
    });
  }

  /** A gun effect fitted at the workbench. */
  bench(action: BenchAction): void {
    const isFit = action.kind === 'fit_effect';
    if (isFit) this.deps.emit('gun_effect_fit', { effect: action.effect });
  }

  /** A title page opened. */
  titlePage(page: string): void {
    const name = TITLE_PAGE_EVENTS[page];
    if (name) this.deps.emit(name, {});
  }

  /** One drawn frame, from the listener's own counter. */
  frame(nowMs: number): void {
    const last = this.lastFrameMs;
    this.lastFrameMs = nowMs;
    const gap = last === null ? null : nowMs - last;
    const isCountable = gap !== null && gap < FRAME_GAP_LIMIT_MS;
    if (!isCountable) return;
    this.frames += 1;
    this.framedMs += gap;
  }

  private finish(stats: GameOverStats): void {
    const mine = stats.players.find((player) => player.id === this.localId);
    const survivor = mine ? characterOf(mine.skin).id : this.profile().survivor;
    const isDefeat = stats.outcome === 'defeat';
    const finishStats: Record<string, unknown> = {
      level_reached: stats.level,
      seconds: stats.durationSec,
      score_band: scoreBand(mine?.score ?? 0),
      kills: mine?.kills ?? this.runKills,
      headshots: this.runHeadshots,
      damage_taken: this.runDamage,
      containers_searched: this.runSearches,
      difficulty: stats.difficulty,
      survivor,
    };
    if (isDefeat) finishStats.killer_type = this.lastAttacker;
    this.endRun(stats.outcome, finishStats);
  }

  private endRun(result: string, known: Readonly<Record<string, unknown>> = {}): void {
    if (!this.running) return;
    this.running = false;
    this.finished = this.screen === 'game';
    this.levelWaiting = false;
    const { difficulty, survivor, input } = this.profile();
    const hasKiller = result === 'defeat' && this.lastAttacker !== 'unknown';
    const baseStats: Record<string, unknown> = {
      result,
      level_reached: this.level,
      seconds: (this.deps.now() - this.runStartMs) / 1000,
      score_band: scoreBand(this.score),
      kills: this.runKills,
      headshots: this.runHeadshots,
      damage_taken: this.runDamage,
      containers_searched: this.runSearches,
      difficulty,
      survivor,
    };
    if (hasKiller) baseStats.killer_type = this.lastAttacker;
    this.deps.emit('run_end', {
      ...baseStats,
      ...known,
    });
    const hasFrames = this.frames >= MIN_FRAMES && this.framedMs > 0;
    const fps = (this.frames * 1000) / this.framedMs;
    const deviceClass = input === 'touch' ? 'touch' : 'desktop';
    if (hasFrames) this.deps.emit('perf_summary', { fps_band: fpsBand(fps), device_class: deviceClass });
    this.level = 0;
    this.levelStartMs = 0;
    this.room = null;
  }
}
