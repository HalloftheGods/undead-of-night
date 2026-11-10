// Daily Night ghosts: the day's counted run (its first) is recorded, and every later run of that day has it walking
// alongside, like a time-trial ghost. Each town keeps its own track, timed from the first tick the run spent in it,
// so the ghost reaches each town when you do and replays what you did there. Kept in the browser, one day at a time.

import type { PlayerEntity, SnapshotPacket } from '../../shared/protocol.ts';
import { browserStore, readJson, writeJson } from './storage.ts';
import type { Store } from './storage.ts';

const GHOST_KEY = 'outbreak.daily-ghost';
/** One sample every this many sim ticks: 10 a second at 30 ticks, smoothed back out by interpolation. */
export const SAMPLE_TICKS = 3;
/** A ceiling on the save: about 50 minutes at 10 samples a second, far past any real Daily Night. */
const MAX_SAMPLES = 30000;
/** Angles are kept in hundredths of a radian, positions in whole pixels. */
const ANGLE_SCALE = 100;
/** Moved less than this between samples, and the ghost is drawn standing. */
const STILL_PX = 0.5;
export const GHOST_ID = 'daily-ghost';

/** One recorded run: per town, flat [x, y, angle] triples, one per SAMPLE_TICKS from the town's first tick. */
export interface GhostTrack {
  /** The Daily Night it belongs to, YYYY-MM-DD. */
  readonly day: string;
  /** The survivor it was played as. */
  readonly skin: number;
  /** What the counted run scored, for the banner. */
  readonly score: number;
  readonly towns: Readonly<Record<string, readonly number[]>>;
}

/** Where the ghost stands at one moment. */
export interface GhostPose {
  readonly x: number;
  readonly y: number;
  readonly angle: number;
  readonly moving: boolean;
}

function isTrack(v: unknown): v is GhostTrack {
  const isNotObject = typeof v !== 'object' || v === null;
  if (isNotObject) return false;
  const t = v as Record<string, unknown>;
  const fieldsOk = typeof t.day === 'string' && Number.isFinite(t.skin) && Number.isFinite(t.score);
  const towns = t.towns;
  const townsOk = typeof towns === 'object' && towns !== null
    && Object.values(towns).every((samples) => Array.isArray(samples) && samples.length % 3 === 0 && samples.every(Number.isFinite));
  return fieldsOk && townsOk;
}

const GHOST_BEST_KEY = 'outbreak.daily-ghost-best';

export type GhostKind = 'official' | 'best';

/** The saved ghost for `day`, or null: an older day's ghost is never shown. */
export function loadGhost(day: string, store: Store | null = browserStore(), kind: GhostKind = 'official'): GhostTrack | null {
  const key = kind === 'best' ? GHOST_BEST_KEY : GHOST_KEY;
  const raw = readJson(store, key);
  const track = isTrack(raw) && raw.day === day ? raw : null;
  if (track) return track;
  if (kind === 'best') {
    const official = readJson(store, GHOST_KEY);
    return isTrack(official) && official.day === day ? official : null;
  }
  return null;
}

/** Saves a ghost track: official 1st run is kept once; best run is updated whenever beaten. */
export function saveGhost(track: GhostTrack, store: Store | null = browserStore(), kind: GhostKind = 'official'): boolean {
  if (kind === 'official') {
    const already = loadGhost(track.day, store, 'official') !== null;
    if (already) return false;
    writeJson(store, GHOST_KEY, track);
    const best = loadGhost(track.day, store, 'best');
    if (!best || track.score >= best.score) {
      writeJson(store, GHOST_BEST_KEY, track);
    }
    return true;
  }
  const currentBest = loadGhost(track.day, store, 'best');
  const isBetter = !currentBest || track.score > currentBest.score;
  if (!isBetter) return false;
  writeJson(store, GHOST_BEST_KEY, track);
  return true;
}

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Shortest way round, so a turn through ±π does not spin the whole circle. */
function lerpAngle(a: number, b: number, t: number): number {
  const turn = Math.atan2(Math.sin(b - a), Math.cos(b - a));
  return a + turn * t;
}

/** Where the ghost is `ticks` after its first tick in `level`, or null outside its track there. */
export function ghostAt(track: GhostTrack, level: number, ticks: number): GhostPose | null {
  const samples = track.towns[String(level)];
  const count = samples ? samples.length / 3 : 0;
  const position = ticks / SAMPLE_TICKS;
  const outside = !samples || count === 0 || position < 0 || position > count - 1;
  if (outside) return null;
  const i = Math.min(Math.floor(position), count - 1);
  const j = Math.min(i + 1, count - 1);
  const t = position - i;
  const x0 = samples[i * 3];
  const y0 = samples[i * 3 + 1];
  const a0 = samples[i * 3 + 2] / ANGLE_SCALE;
  const x1 = samples[j * 3];
  const y1 = samples[j * 3 + 1];
  const a1 = samples[j * 3 + 2] / ANGLE_SCALE;
  const moving = Math.hypot(x1 - x0, y1 - y0) >= STILL_PX;
  return { x: lerp(x0, x1, t), y: lerp(y0, y1, t), angle: lerpAngle(a0, a1, t), moving };
}

/** Writes down the local survivor as a run goes, a sample every few ticks per town, until they go down. */
export class GhostRecorder {
  private readonly towns: Record<string, number[]> = {};
  private readonly townStart = new Map<number, number>();
  private samples = 0;
  private skin = 0;
  /** Down, dead or out of room: the ghost goes no further. */
  private stopped = false;

  constructor(readonly day: string) {}

  observe(level: number, tick: number, player: PlayerEntity | null): void {
    const notRecording = this.stopped || player === null;
    if (notRecording) return;
    const standing = player.status === 'alive';
    if (!standing) {
      this.stopped = true;
      return;
    }
    this.skin = player.skin;
    const start = this.townStart.get(level) ?? tick;
    this.townStart.set(level, start);
    const key = String(level);
    const town = this.towns[key] ?? [];
    this.towns[key] = town;
    // A sample for every slot up to this tick, so a dropped snapshot leaves no hole in the timing.
    const due = Math.floor((tick - start) / SAMPLE_TICKS) + 1;
    while (town.length / 3 < due) {
      const full = this.samples >= MAX_SAMPLES;
      if (full) {
        this.stopped = true;
        return;
      }
      town.push(Math.round(player.x), Math.round(player.y), Math.round(player.angle * ANGLE_SCALE));
      this.samples += 1;
    }
  }

  track(score: number): GhostTrack {
    const towns: Record<string, readonly number[]> = {};
    for (const [level, samples] of Object.entries(this.towns)) towns[level] = [...samples];
    return { day: this.day, skin: this.skin, score, towns };
  }
}

/** One Daily Night's ghost: the day's counted run playing back, and, while none is saved yet, this run recording. */
export class DailyGhost {
  private replay: GhostTrack | null = null;
  private recorder: GhostRecorder | null = null;
  /** The first tick this run saw in each town, which playback is timed from. */
  private readonly townStart = new Map<number, number>();

  constructor(
    readonly day: string,
    private readonly store: Store | null = browserStore(),
  ) {
    this.begin();
  }

  /** A run of the day starts: play the best ghost if there is one, and record this run. */
  begin(): void {
    this.replay = loadGhost(this.day, this.store, 'best');
    this.recorder = new GhostRecorder(this.day);
    this.townStart.clear();
  }

  /** The ghost run being played back, if any. */
  get showing(): GhostTrack | null {
    return this.replay;
  }

  observe(snapshot: SnapshotPacket, localId: string | null): void {
    const { level, tick } = snapshot;
    const firstInTown = !this.townStart.has(level);
    if (firstInTown) this.townStart.set(level, tick);
    const local = snapshot.players.find((player) => player.id === localId) ?? null;
    this.recorder?.observe(level, tick, local);
  }

  /** The run is over. Saved as official if counted, and updates best if score beats it. */
  finish(counted: boolean, score: number): boolean {
    const recorder = this.recorder;
    this.recorder = null;
    if (recorder === null) return false;
    const track = recorder.track(score);
    saveGhost(track, this.store, 'best');
    const keep = counted;
    return keep ? saveGhost(track, this.store, 'official') : false;
  }

  /** The ghost as a survivor to draw, `tick` being the sim's tick now (fractions welcome), or null where it is not. */
  figure(level: number, tick: number, like: PlayerEntity | null): PlayerEntity | null {
    const track = this.replay;
    const start = this.townStart.get(level);
    const absent = track === null || start === undefined || like === null;
    if (absent) return null;
    const pose = ghostAt(track, level, tick - start);
    if (!pose) return null;
    return {
      ...like,
      id: GHOST_ID,
      name: 'Ghost',
      skin: track.skin,
      x: pose.x,
      y: pose.y,
      angle: pose.angle,
      moving: pose.moving,
      status: 'alive',
      health: like.maxHealth,
      search: 0,
      reload: 0,
      indoors: null,
    };
  }
}
