import { KEEPSAKES } from '../../shared/keepsakes.ts';
import { displayName } from '../../shared/callsign.ts';
import { isBunkerSeed } from '../../shared/home-protocol.ts';
import type { GameEvent, GameOverStats, PlayerEntity, SnapshotPacket } from '../../shared/protocol.ts';
import type { ClientWorld } from './client-world.ts';
import { recordGameFinished, recordLevelReached } from './level-progress.ts';
import type { CalloutWords } from './kill-juice.ts';
import { KillJuice } from './kill-juice.ts';
import { candyBanner, HORDE_WIPED_BANNER, pickupNote } from './run-notices.ts';
import { finishRun, healthFraction } from './run-hud.ts';
import type { RunHost } from './run-session.ts';
import { dateKeyOf, loadDailyLog, streakOf } from './daily-night.ts';
import { StampKeeper, stampName } from './stamps.ts';
import type { StampContext, StampId } from './stamps.ts';
import { loadLeaderboard } from './storage.ts';
import { loadBests } from './trip-record.ts';

const EVENT_MUSIC: Partial<Record<GameEvent['type'], 'wave' | 'intermission'>> = {
  wave_start: 'wave',
  wave_intermission: 'intermission',
};

/** Takes each snapshot into the run: events to the senses, the world's latest, the end of the run. */
export class SnapshotHandler {
  /** The bunker's music is the horde's while the blast door is breached. */
  private breached = false;
  private readonly juice = new KillJuice();
  private readonly stamps = new StampKeeper();
  /** Stamps earned while a kill callout had the screen, shown once it is free. */
  private stampsToShow: StampId[] = [];

  constructor(
    private readonly host: RunHost,
    private readonly beginRun: () => void,
  ) {}

  onSnapshot(snapshot: SnapshotPacket): void {
    const { state, stage, bench, home, audio, renderer } = this.host;
    const world = state.world;
    if (!world) return;
    const now = performance.now();
    // Off the stats, not the last frame: a run that ends between ticks may never have a frame of its own.
    const runRestarted = state.runResult !== null && snapshot.gameOver === null;
    if (runRestarted) {
      world.restart();
      renderer?.reset();
      stage.rewind();
      this.juice.reset();
      this.stamps.reload();
      this.stampsToShow = [];
      this.beginRun();
    }
    stage.follow(world, snapshot, now);
    bench.observe(snapshot);
    audio.setLevel(snapshot.level);
    const before = world.localPlayer;
    const after = snapshot.players.find((player) => player.id === world.localId) ?? null;
    const onATrip = after?.home !== undefined;
    // Reaching a town on a trip opens nothing: only the van home does, and that comes on a receipt.
    const inArcade = snapshot.home === undefined;
    // A Daily Night starts deep in the game: it unlocks nothing on the Levels page.
    const newLevel = inArcade && state.daily === null && snapshot.level > state.levelNoted;
    if (newLevel) {
      state.levelNoted = snapshot.level;
      recordLevelReached(snapshot.level);
    }
    this.setMood(snapshot, world.latest === null);
    state.lastSnapshotMs = now;
    for (const event of snapshot.events) this.onGameEvent(event, world, now, before, after);
    const callout = this.punctuate(snapshot, world.localId, after, now);
    this.stamp(snapshot, world.localId, after, callout, now);
    world.push(snapshot, now);
    if (onATrip) home.observe(snapshot, world.localId, now);
    const justEnded = snapshot.gameOver !== null && state.runResult === null;
    if (justEnded) this.enterGameOver(snapshot.gameOver!, world.localId, now);
  }

  /** The kills in this snapshot that deserve a beat: a held frame, a flash, a word over the action. */
  private punctuate(snapshot: SnapshotPacket, localId: string | null, after: PlayerEntity | null, now: number): CalloutWords | null {
    const beat = this.juice.read(snapshot.events, localId, healthFraction(after), now);
    if (!beat) return null;
    const { renderer, runHud } = this.host;
    const hasFreeze = beat.freezeMs > 0;
    if (hasFreeze) this.host.hitStop(beat.freezeMs);
    const hasFlash = beat.flash > 0;
    if (hasFlash) renderer?.effects.addFlash(beat.flash);
    if (beat.callout) runHud.callout(beat.callout, now);
    if (beat.hordeWiped) runHud.say(HORDE_WIPED_BANNER, now);
    return beat.callout;
  }

  /** Reads the snapshot for stamps, and stamps one on screen when no kill callout has it. */
  private stamp(snapshot: SnapshotPacket, localId: string | null, after: PlayerEntity | null, callout: CalloutWords | null, now: number): void {
    const today = dateKeyOf(new Date());
    const landed = snapshot.drop?.landed === true;
    const ctx: StampContext = {
      localId,
      level: snapshot.level,
      mapSeed: snapshot.mapSeed,
      kills: after?.kills ?? 0,
      drop: landed ? snapshot.drop! : null,
    };
    const earned = this.stamps.read(snapshot.events, ctx, today);
    const closeShave = callout?.tone === 'close' ? this.stamps.give(['close_shave'], today) : [];
    this.stampsToShow.push(...earned, ...closeShave);
    const next = this.stampsToShow[0];
    const free = callout === null && !this.host.runHud.calloutShowing(now);
    const show = next !== undefined && free;
    if (!show) return;
    this.stampsToShow.shift();
    this.host.runHud.callout({ text: `STAMP: ${stampName(next).toUpperCase()}`, tone: 'stamp' }, now);
  }

  /** Someone joining mid-horde gets no wave_start, so the first frame sets the mood. The bunker has its own. */
  private setMood(snapshot: SnapshotPacket, firstOfRun: boolean): void {
    const { state, audio } = this.host;
    const bunker = isBunkerSeed(snapshot.mapSeed);
    const moved = state.inBunker !== bunker;
    state.inBunker = bunker;
    const breached = bunker && snapshot.home?.overrun?.phase === 'breached';
    const turned = breached !== this.breached;
    this.breached = breached;
    const sceneChanged = moved || turned;
    if (bunker) {
      if (sceneChanged) audio.setScene(breached ? 'wave' : 'bunker');
      return;
    }
    const settling = firstOfRun || moved;
    if (settling) audio.setScene(snapshot.phase === 'wave' ? 'wave' : 'intermission');
  }

  onGameEvent(event: GameEvent, world: ClientWorld, now: number, before: PlayerEntity | null, after: PlayerEntity | null): void {
    const { audio, renderer, runHud } = this.host;
    audio.handleEvent(event, world.localId);
    const note = event.type === 'pickup' ? pickupNote(event.pickup, before, after) : undefined;
    renderer?.handleEvent(event, {
      localId: world.localId,
      localX: world.predictor.x,
      localY: world.predictor.y,
      pickupNote: note,
    });
    const music = EVENT_MUSIC[event.type];
    if (music) audio.setScene(music);
    const nameOf = (id: string): string | null => {
      const player = after?.id === id ? after : world.latest?.players.find((each) => each.id === id);
      return player ? displayName(player.name, player.skin) : null;
    };
    runHud.onEvent(event, now, { localId: world.localId, nameOf, ...(note ? { pickupNote: note } : {}) });
    const ateIt = event.type === 'candy_eaten' && event.playerId === world.localId;
    if (ateIt) runHud.say(candyBanner(event.candy, event.saved === true), now);
    const keptIt = event.type === 'keepsake_taken' && event.playerId === world.localId;
    if (keptIt) runHud.say({ title: KEEPSAKES[event.keepsake].name.toUpperCase(), subtitle: 'KEPT FOR THE RUN', tone: 'hope' }, now);
  }

  enterGameOver(stats: GameOverStats, localId: string, now: number): void {
    const { state, input, audio } = this.host;
    state.runResult = finishRun(stats, localId, state.daily);
    const today = dateKeyOf(new Date());
    const daily = state.runResult.daily;
    if (daily?.counted) {
      const inARow = state.daily !== null && streakOf(loadDailyLog(), state.daily) >= 3;
      this.stamps.give(inARow ? ['daily_bread', 'three_nights'] : ['daily_bread'], today);
    }
    const won = stats.outcome === 'victory';
    const isWonNormalRun = won && state.daily === null;
    if (isWonNormalRun) recordGameFinished();
    state.gameOverAtMs = now;
    input.setEnabled(false);
    audio.setScene(won ? 'victory' : 'gameover');
    this.host.publish({ paused: false, mapOpen: false, banner: null, place: null, ...loadBests(), leaderboard: loadLeaderboard() });
  }
}
