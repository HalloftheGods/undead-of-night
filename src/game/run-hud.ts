import { displayName } from '../../shared/callsign.ts';
import { BUILDING_DEFS } from '../../shared/protocol.ts';
import type { GameEvent, GameOverStats, PlayerEntity, PlayerStatus, WorldMap } from '../../shared/protocol.ts';
import type { SceneView } from '../engine/scene.ts';
import type { WorldRenderer } from '../engine/world-renderer.ts';
import type { ClientWorld } from './client-world.ts';
import { homeUi } from './home-hud.ts';
import { motion } from './motion.ts';
import type { HomeFacts } from './home-hud.ts';
import { buildHud, standingInTown } from './hud-state.ts';
import type { Banner, RunResult, UiState } from './hud-state.ts';
import type { CalloutWords } from './kill-juice.ts';
import { bannerLine, calloutLine, eventLine, EventLog, levelLines } from './event-log.ts';
import type { LogContext, LogLine } from './event-log.ts';
import { hordeBanner, isLandmark, overrunBanner, radioBanner, RunNotices } from './run-notices.ts';
import { tapGameEvent, tapLocalPlayer } from './analytics/event-tap.ts';
import { lockedTracksOf } from '../audio/playlists.ts';
import { trackName } from './sound-test.ts';
import { foundTracks, isRadioFound, recordRadioFound } from './sound-unlock.ts';
import { recordRun } from './storage.ts';
import { dailyShare, dayLabel, recordDaily } from './daily-night.ts';
import type { DailyPartySize } from './daily-night.ts';
import { TownMapView } from './town-map.ts';
import { containerInReach } from '../../shared/containers.ts';
import { BUNKER_LEVEL } from '../../shared/home-protocol.ts';
import { levelDef } from '../../shared/levels.ts';
import { BITE_MS, BiteTracker } from './bite-marker.ts';
import { deathWitness } from './death-cause.ts';
import { HintTracker } from './first-run-hints.ts';
import type { HintFacts } from './first-run-hints.ts';

const HUD_INTERVAL_MS = 100;
/** How often a held map repaints: fast enough for a 1.5 Hz blink, and rarely when nothing blinks. */
const MAP_BLINK_REPAINT_MS = 50;
const MAP_STILL_REPAINT_MS = 500;

const SIGNAL_WEAK_MS = 1500;

/** Everything a run has on screen, cleared at either end of it. */
export const NO_RUN_UI = {
  paused: false,
  mapOpen: false,
  bagOpen: false,
  backpackOpen: false,
  hud: null,
  banner: null,
  callout: null,
  place: null,
  levelCard: null,
  home: null,
  result: null,
  restarting: false,
  log: [],
  logOpen: false,
  hint: null,
  bite: null,
  lobby: null,
} as const satisfies Partial<UiState>;

/** 0..1 for the low-health effects. Anyone not on their feet has no use for them. */
export function healthFraction(local: PlayerEntity | null): number {
  return local && local.status === 'alive' ? local.health / local.maxHealth : 1;
}

/** Colour drains as the local player does. */
export function deathFade(status: PlayerStatus | undefined, gameOver: boolean): number {
  const isDead = status === 'dead';
  if (gameOver) return 0.88;
  if (isDead) return 0.7;
  return status === 'downed' ? 0.4 : 0;
}

/**
 * Records the run and words the result, the moment it ends: a teammate can start
 * the next run before this player ever sees the results.
 * Someone who joined a finished room has no run of their own.
 */
export function finishRun(stats: GameOverStats, localId: string, dailyKey: string | null = null): RunResult {
  const local = stats.players.find((player) => player.id === localId);
  const score = local?.score ?? 0;
  const kills = local?.kills ?? 0;
  const isDaily = dailyKey !== null;
  if (isDaily) {
    const playerCount = stats.players.length;
    const isMp = playerCount > 1;
    const partySize = isMp && playerCount >= 2 && playerCount <= 5 ? (playerCount as DailyPartySize) : undefined;
    const teamScore = isMp ? stats.players.reduce((sum, player) => sum + player.score, 0) : undefined;
    const teamKills = isMp ? stats.players.reduce((sum, player) => sum + player.kills, 0) : undefined;
    const roster = isMp
      ? stats.players.map((player) => ({
          name: player.name,
          character: player.skin,
          score: player.score,
          kills: player.kills,
        }))
      : undefined;

    const counted = local
      ? recordDaily(dailyKey, {
          score,
          kills,
          level: stats.level,
          partySize,
          teamScore,
          teamKills,
          roster,
        })
      : false;

    const label = isMp
      ? `Daily Night (${partySize ?? playerCount}P), ${dayLabel(dailyKey)}`
      : `Daily Night, ${dayLabel(dailyKey)}`;

    return {
      stats,
      localId,
      score,
      kills,
      isNewBest: false,
      daily: {
        label,
        counted,
        share: dailyShare(dailyKey, undefined, partySize),
      },
    };
  }
  const isNewBest = local ? recordRun({ score, kills, wave: stats.wave, durationSec: stats.durationSec }, undefined, local.name) : false;
  return { stats, localId, score, kills, isNewBest };
}

export interface HudFrame {
  readonly world: ClientWorld;
  readonly scene: SceneView;
  readonly renderer: WorldRenderer;
  readonly ms: number;
  /** Co-op only, and the time of the last snapshot to measure the silence from. */
  readonly networked: boolean;
  readonly lastSnapshotMs: number;
}

/** Keeps the Vue-facing state and the town map in step with the run, a few times a second. */
export class RunHud {
  private readonly notices = new RunNotices();
  private readonly log = new EventLog();
  private readonly ui: () => UiState;
  private readonly publish: (patch: Partial<UiState>) => void;
  /** What the home screens need that no snapshot carries. */
  private readonly homeFacts: () => HomeFacts;
  private town: TownMapView | null = null;
  private townCanvas: HTMLCanvasElement | null = null;
  private lastHudMs = 0;
  /** When the open map first painted, so its cursor's long label knows how old it is. */
  private mapOpenedMs: number | null = null;
  /** The last tick shown while a solo run is held. */
  private heldTick = -1;
  private lastMapPaintMs = 0;
  /** The town the run is in, which is where a Radio's track belongs. */
  private level = 1;
  private lastScene: SceneView | null = null;
  /** The streak kit's line for the run's first title card, and whether that card has gone up yet. */
  private streakLine: string | null = null;
  private streakShown = false;
  private readonly hints = new HintTracker();
  private readonly bites = new BiteTracker();
  private map: WorldMap | null = null;
  private biteUntilMs = 0;

  constructor(ui: () => UiState, publish: (patch: Partial<UiState>) => void, homeFacts: () => HomeFacts) {
    this.ui = ui;
    this.publish = publish;
    this.homeFacts = homeFacts;
  }

  setMap(map: WorldMap): void {
    this.town = new TownMapView(map);
    this.map = map;
  }

  /** A new run, on this map or the next. */
  reset(): void {
    this.streakShown = false;
    this.notices.reset();
    this.bites.reset();
    deathWitness.reset();
    this.log.reset();
    this.town?.clearVisited();
    this.town?.clearOpened();
  }

  /** The map screen hands over its canvas when it opens, and null when it closes. */
  attachTownCanvas(canvas: HTMLCanvasElement | null): void {
    this.townCanvas = canvas;
    this.mapOpenedMs = null;
    const town = this.town;
    const canSize = canvas !== null && town !== null;
    if (canSize) {
      canvas.width = town.width;
      canvas.height = town.height;
    }
    this.paintTown();
  }

  /**
   * A solo run stands still behind the map, so no tick comes to repaint it.
   * Asked every frame, this repaints only the open map canvas, at the blink's pace.
   */
  repaintMap(ms: number): void {
    const interval = motion.reduced.value ? MAP_STILL_REPAINT_MS : MAP_BLINK_REPAINT_MS;
    const due = this.townCanvas !== null && ms - this.lastMapPaintMs >= interval;
    if (due) this.paintTown(ms);
  }

  /**
   * A solo run stands still behind the candy bag, but eating one steps it a tick
   * (game/candy-bag-panel.ts). Asked every frame, this shows that tick's HUD once.
   */
  repaintHeld(world: ClientWorld): void {
    const snapshot = world.latest;
    const local = world.localPlayer;
    const isNewTick = snapshot !== null && local !== null && snapshot.tick !== this.heldTick;
    if (!isNewTick) return;
    this.heldTick = snapshot.tick;
    this.publish({ hud: buildHud(snapshot, local, null) });
  }

  private paintTown(ms: number = this.lastHudMs): void {
    this.lastMapPaintMs = ms;
    const ctx = this.townCanvas?.getContext('2d') ?? null;
    const scene = this.lastScene;
    const canPaint = ctx !== null && scene !== null;
    if (!canPaint) return;
    this.mapOpenedMs ??= ms;
    const clock = { nowMs: ms, openedMs: this.mapOpenedMs, reducedMotion: motion.reduced.value };
    this.town?.paint(ctx, scene.players, scene.localId, scene.exit, scene.openedContainers, scene.drop, clock, scene.leftovers);
  }

  onEvent(event: GameEvent, now: number, ctx?: LogContext): void {
    tapGameEvent(event);
    deathWitness.see(event, ctx?.localId ?? null, now);
    const track = isRadioFound(event) ? this.giveUpTrack() : null;
    const banner = hordeBanner(event) ?? overrunBanner(event) ?? radioBanner(event, track === null ? null : trackName(track));
    if (banner) this.say(banner, now);
    const line = ctx ? eventLine(event, ctx) : null;
    if (line) this.note(line, now);
    this.noticeBite(event, now, ctx?.localId ?? null);
  }

  /** A bite from outside the player's facing: a short red mark on that edge of the screen. */
  private noticeBite(event: GameEvent, now: number, localId: string | null): void {
    const isAttack = event.type === 'zombie_attack';
    const isLocalHurt = event.type === 'player_hurt' && localId !== null && event.playerId === localId;
    if (!isAttack && !isLocalHurt) return;
    const facing = this.lastScene?.players.find((player) => player.id === localId)?.angle ?? null;
    const mark = isAttack ? this.bites.attacked(event.x, event.y, now, facing) : this.bites.hurtLocal(event.x, event.y, now, facing);
    if (!mark) return;
    this.biteUntilMs = now + BITE_MS;
    this.publish({ bite: mark });
  }

  /** Puts a first-run hint up, or takes one down, from what the player is standing at. */
  private stepHints(world: ClientWorld, scene: SceneView, ms: number): void {
    const snapshot = world.latest;
    const local = world.localPlayer;
    const hud = this.ui().hud;
    if (!snapshot || !local || !hud) return;
    const ui = this.ui();
    const free = standingInTown({ ...ui, hud }) && ui.levelCard === null && ui.banner === null;
    const reach = this.map && free ? containerInReach(this.map, local.x, local.y, (id) => scene.openedContainers.includes(id)) : null;
    const facts: HintFacts = {
      level: hud.level,
      phase: hud.phase,
      wave: hud.wave,
      intermission: hud.intermission,
      hordes: hud.level === BUNKER_LEVEL ? 0 : levelDef(hud.level).hordes,
      exitOpen: hud.exitOpen,
      free,
      near: reach === null ? null : reach.kind === 'bowl' ? 'bowl' : 'container',
    };
    const next = this.hints.step(facts, ms, (ui.hint ?? null) !== null);
    if (next === null) return;
    this.publish({ hint: next === 'clear' ? null : next });
  }

  /** Writes a line in the run's log, which outlasts every toast. */
  private note(line: LogLine, now: number): void {
    this.publish({ log: this.log.add(line, now) });
  }

  /** The full log opens over the run, which keeps going underneath. */
  toggleLog(): boolean {
    const onRun = this.ui().screen === 'game' && this.ui().hud !== null;
    if (!onRun) return false;
    this.publish({ logOpen: !this.ui().logOpen });
    return true;
  }

  /** Notes the Radio, and hands out the next track of this level that has not been found, if any is left. */
  private giveUpTrack(): string | null {
    const [next = null] = lockedTracksOf(this.level, foundTracks(), this.ui().runStyle ?? undefined);
    recordRadioFound(undefined, next);
    return next;
  }

  /** Home has no title card, and nothing said in the last town is worth keeping up in it. */
  clearNotices(): void {
    this.publish({ levelCard: null, banner: null, place: null });
  }

  /** A kill worth a word over the action. */
  callout(words: CalloutWords, now: number): void {
    this.publish({ callout: this.notices.callout(words, now), log: this.log.add(calloutLine(words), now) });
  }

  calloutShowing(now: number): boolean {
    return this.notices.calloutShowing(now);
  }

  /** A banner of the game's own, outside any event: a hint, or a question put to the player. */
  say(banner: Omit<Banner, 'key'>, now: number): void {
    this.publish({ banner: this.notices.banner(banner, now), log: this.log.add(bannerLine(banner), now) });
  }

  /** The home screens read the save, which moves between the hud's beats. */
  refreshHome(world: ClientWorld | null): void {
    const snapshot = world?.latest ?? null;
    const local = world?.localPlayer ?? null;
    const hasRun = snapshot !== null && local !== null;
    if (!hasRun) return;
    this.publish({ home: homeUi(snapshot, local, this.homeFacts()) });
  }

  /** What the streak kit gave this run, said on its first title card. Null for a run with no kit. */
  setStreakLine(line: string | null): void {
    this.streakLine = line;
  }

  /** The level's title card. Nothing said in the last town is worth keeping up beside it. */
  showLevel(level: number, now: number, mapSeed: number | null = null): void {
    this.level = level;
    const streak = this.streakShown ? null : this.streakLine;
    this.streakShown = true;
    const levelCard = this.notices.levelCard(level, now, mapSeed, streak);
    for (const line of levelLines(levelCard)) this.log.add(line, now);
    this.publish({ levelCard, banner: null, place: null, log: this.log.entries });
  }

  /** Who walked in where, and what the floor would not give up. */
  private noticeSurroundings(renderer: WorldRenderer, world: ClientWorld, ms: number): void {
    const local = world.localPlayer;
    if (!local) return;
    const enteredId = this.notices.entered(local.indoors);
    const building = enteredId === null ? null : this.town?.building(enteredId) ?? null;
    if (building) {
      this.town?.markVisited(building.id);
      if (isLandmark(building.kind)) {
        const label = BUILDING_DEFS[building.kind].label;
        this.publish({ place: this.notices.place(label, ms), log: this.log.add({ text: label.toUpperCase(), tone: 'plain', kind: 'night' }, ms) });
      }
    }
    const refused = this.notices.refusal(local, world.latest?.pickups ?? [], ms);
    if (refused) renderer.note(refused, world.predictor.x, world.predictor.y);
  }

  tick(frame: HudFrame): void {
    const { world, scene, renderer, ms } = frame;
    this.lastScene = scene;
    const notDue = ms - this.lastHudMs < HUD_INTERVAL_MS;
    if (notDue) return;
    this.lastHudMs = ms;
    this.noticeSurroundings(renderer, world, ms);
    this.paintTown(ms);
    const snapshot = world.latest;
    const local = world.localPlayer;
    const hasRun = snapshot !== null && local !== null;
    if (!hasRun) return;
    tapLocalPlayer(local.id);
    this.heldTick = snapshot.tick;
    const viewer = scene.viewerId === local.id ? null : scene.players.find((player) => player.id === scene.viewerId);
    this.publish({
      hud: buildHud(snapshot, local, viewer ? displayName(viewer.name, viewer.skin) : null),
      home: homeUi(snapshot, local, this.homeFacts()),
      signalWeak: frame.networked && ms - frame.lastSnapshotMs > SIGNAL_WEAK_MS,
      ...this.notices.expired(this.ui(), ms),
      ...(this.ui().bite && ms > this.biteUntilMs ? { bite: null } : {}),
    });
    this.stepHints(world, scene, ms);
  }
}
