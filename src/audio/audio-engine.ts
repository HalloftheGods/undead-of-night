import type { GameStyle } from '../../shared/game-style.ts';
import type { GameEvent, PlayerEntity, WeaponId, WorldMap, ZombieType } from '../../shared/protocol.ts';
import { LOW_HEALTH } from '../game/heartbeat.ts';
import { playEventSound } from './event-sounds.ts';
import { FootstepTracker, StompTracker, type StepPlayer, type Stomper } from './footsteps.ts';
import { HEARING_RANGE, Mixer, type BusLevels } from './mixer.ts';
import { Music, type Scene } from './music.ts';
import { Soundtrack } from './soundtrack.ts';
import { SFX } from './sfx-registry.ts';
import type { SfxName } from './sfx-registry.ts';

export { PICKUP_SFX } from './event-sounds.ts';
export { renderSfx } from './render.ts';
export { SFX_NAMES } from './sfx-registry.ts';
export type { SfxName } from './sfx-registry.ts';
export type { Scene } from './music.ts';

const STORE_KEY = 'outbreak-zero.audio';
const VOICE: Record<ZombieType, SfxName> = {
  walker: 'groan_walker', runner: 'shriek_runner', bloater: 'gurgle_bloater', brute: 'roar_brute', screamer: 'groan_walker',
};
/** A pack waking at once shares this: at most one alert snarl per window. */
const ALERT_WINDOW = 0.15;
/** A shotgun loads a shell this often until the reload ends, and never more than a full tube. */
const SHELL_EVERY = 0.32;
const SHELLS_MAX = 6;
/** The last of the reload after the magazine seats: the pistol's slide, the carbine's handle. */
const RELOAD_TAIL: Partial<Record<WeaponId, SfxName>> = { pistol: 'slide_drop', carbine: 'bolt_rack' };
/** How far hearing dulls at the very edge of death, 0..1. */
const MUFFLE_MAX = 0.75;

/** How muffled the world sounds at this share of health: clear above the heartbeat band, dulling below it. */
export function muffleFor(health: number): number {
  const bleeding = health > 0 && health < LOW_HEALTH;
  if (!bleeding) return 0;
  return (1 - health / LOW_HEALTH) * MUFFLE_MAX;
}

/** A shotgun mid-reload, loading shells one at a time. */
interface ShellLoad { x: number; y: number; local: boolean; next: number; loaded: number }

interface Prefs { volume: number; muted: boolean; music: number; sfx: number }

const DEFAULT_PREFS: Prefs = { volume: 0.7, muted: false, music: 1, sfx: 1 };

/** A saved level in 0..1, or the fallback when it is missing or not a number. */
function level(raw: unknown, fallback: number): number {
  return typeof raw === 'number' && Number.isFinite(raw) ? Math.max(0, Math.min(1, raw)) : fallback;
}

function loadPrefs(): Prefs {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY) ?? 'null') as Partial<Prefs> | null;
    return {
      volume: level(raw?.volume, DEFAULT_PREFS.volume),
      muted: raw?.muted === true,
      music: level(raw?.music, DEFAULT_PREFS.music),
      sfx: level(raw?.sfx, DEFAULT_PREFS.sfx),
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

function hasWebAudio(): boolean {
  return typeof AudioContext !== 'undefined';
}

/**
 * All game sound. Every method is a no-op until unlock() succeeds in a browser,
 * so it is safe in Node, in tests and under blocked autoplay.
 */
export class AudioEngine {
  private mixer: Mixer | null = null;
  private music: Music | null = null;
  private soundtrack: Soundtrack | null = null;
  private prefs: Prefs = loadPrefs();
  private scene: Scene = 'menu';
  private town = 1;
  private style: GameStyle = 'arcade';
  private intensity = 0;
  private groanIn = 2;
  private alertIn = 0;
  private readonly footsteps = new FootstepTracker();
  private readonly stompers = new StompTracker();
  private readonly shellLoads = new Map<string, ShellLoad>();
  private readonly playStep: StepPlayer = (name, opts) => this.mixer?.play(name, opts);
  private unlocking: Promise<void> | null = null;
  private previewTimer: ReturnType<typeof setTimeout> | null = null;

  async unlock(): Promise<void> {
    if (!hasWebAudio()) return;
    if (!this.mixer) {
      try {
        this.mixer = new Mixer(new AudioContext({ latencyHint: 'interactive' }), this.level, this.buses);
        this.music = new Music(this.mixer.ctx, this.mixer.music, (n) => this.ambient(n));
        this.music.setScene(this.scene);
        this.music.setIntensity(this.intensity);
        this.soundtrack = this.makeSoundtrack(this.mixer);
        this.soundtrack?.setLevel(this.town);
        this.soundtrack?.setStyle(this.style);
        this.soundtrack?.setScene(this.scene);
      } catch {
        this.mixer = null;
        this.music = null;
        this.soundtrack = null;
        return;
      }
    }
    const ctx = this.mixer.ctx;
    const isAudioRunning = ctx.state === 'running';
    if (isAudioRunning) {
      this.soundtrack?.retry();
      return;
    }
    this.unlocking ??= ctx.resume().catch(() => undefined).finally(() => { this.unlocking = null; });
    await this.unlocking;
    this.soundtrack?.retry();
  }

  private makeSoundtrack(mixer: Mixer): Soundtrack | null {
    const canStream = typeof Audio !== 'undefined';
    if (!canStream) return null;
    return new Soundtrack(mixer.ctx, mixer.tracks, (available) => this.music?.setBedOn(!available));
  }

  setListener(x: number, y: number): void {
    this.mixer?.setListener(x, y);
  }

  playUi(name: 'click' | 'hover' | 'start' | 'pause' | 'resume'): void {
    this.mixer?.play(`ui_${name}`);
  }

  /** The van's engine and door over the drive between the bunker and a town. */
  playVan(name: 'depart' | 'arrive' | 'door'): void {
    this.mixer?.play(`van_${name}`);
  }

  /** The Sound Test opens quiet: the scene's music steps aside until leavePreview(). */
  enterPreview(): void {
    this.soundtrack?.hush();
  }

  /** The Sound Test plays one thing at a time through the same mixer, so volume and mute apply. False if nothing could start. */
  previewTrack(file: string, onEnd: () => void): boolean {
    if (!this.soundtrack) return false;
    this.clearPreviewTimer();
    this.soundtrack.audition(file, onEnd);
    return true;
  }

  previewSfx(name: SfxName, onEnd: () => void): boolean {
    if (!this.mixer) return false;
    this.stopPreview();
    this.mixer.play(name, { local: true });
    this.previewTimer = setTimeout(() => {
      this.previewTimer = null;
      onEnd();
    }, SFX[name].length * 1000);
    return true;
  }

  /** Stops whatever is playing and stays quiet. */
  stopPreview(): void {
    this.clearPreviewTimer();
    this.soundtrack?.silence();
  }

  /** Leaving the Sound Test: the scene's music, the title's, comes back. */
  leavePreview(): void {
    this.clearPreviewTimer();
    this.soundtrack?.stopAudition();
  }

  private clearPreviewTimer(): void {
    if (this.previewTimer) clearTimeout(this.previewTimer);
    this.previewTimer = null;
  }

  /** The town being played, which picks the music between hordes. */
  setLevel(level: number): void {
    this.town = level;
    this.soundtrack?.setLevel(level);
  }

  /** The style of the run being played, which picks the bunker's music and level 6's. */
  setStyle(style: GameStyle): void {
    this.style = style;
    this.soundtrack?.setStyle(style);
  }

  setScene(scene: Scene): void {
    this.scene = scene;
    this.music?.setScene(scene);
    this.soundtrack?.setScene(scene);
  }

  setIntensity(value: number): void {
    this.intensity = value;
    this.music?.setIntensity(value);
  }

  /** Local player's health fraction 0..1; in the heartbeat band the world's sounds dull. */
  setHealth(fraction: number): void {
    this.mixer?.setMuffle(muffleFor(fraction));
  }

  /** One beat of the low-health heart, timed by src/game/heartbeat.ts so the screen beats with it. */
  heartbeat(health: number): void {
    this.mixer?.play('heartbeat', { local: true, gain: 0.9 - health });
  }

  get volume(): number {
    return this.prefs.volume;
  }

  set volume(v: number) {
    this.prefs.volume = Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));
    this.persist();
  }

  /** Music, the bed and the soundtrack, as a share of the master volume. */
  get musicVolume(): number {
    return this.prefs.music;
  }

  set musicVolume(v: number) {
    this.prefs.music = level(v, 0);
    this.persist();
  }

  /** Every sound effect, as a share of the master volume. */
  get sfxVolume(): number {
    return this.prefs.sfx;
  }

  set sfxVolume(v: number) {
    this.prefs.sfx = level(v, 0);
    this.persist();
  }

  get muted(): boolean {
    return this.prefs.muted;
  }

  set muted(m: boolean) {
    this.prefs.muted = m;
    this.persist();
  }

  handleEvent(e: GameEvent, localPlayerId: string | null): void {
    const mixer = this.mixer;
    if (!mixer) return;
    const at = (x: number, y: number, playerId?: string) => ({ x, y, local: playerId !== undefined && playerId === localPlayerId });
    playEventSound(e, { mixer, at, playAmbient: (name) => this.ambient(name), claimAlert: () => this.claimAlert(),
      reloadStart: (weapon, playerId, where) => this.reloadStart(weapon, playerId, where),
      reloadEnd: (weapon, playerId, where) => this.reloadEnd(weapon, playerId, where),
      dropShells: (playerId) => this.shellLoads.delete(playerId),
    });
  }

  /** A pack waking at once snarls once: the first alert in a window claims it. */
  private claimAlert(): boolean {
    const isAlertCoolingDown = this.alertIn > 0;
    if (isAlertCoolingDown) return false;
    this.alertIn = ALERT_WINDOW;
    return true;
  }

  tick(dt: number, zombies: readonly { x: number; y: number; type: ZombieType }[]): void {
    const mixer = this.mixer;
    if (!mixer) return;
    this.alertIn -= dt;
    this.loadShells(mixer, dt);
    this.groanIn -= dt;
    const isGroanQuiet = this.groanIn > 0 || zombies.length === 0;
    if (isGroanQuiet) return;
    this.groanIn = (1 + Math.random() * 2.5) / (1 + Math.min(zombies.length, 12) * 0.12);
    const { x, y } = mixer.listener;
    const near = zombies.filter((z) => Math.hypot(z.x - x, z.y - y) < HEARING_RANGE);
    const hasNoZombieInEarshot = near.length === 0;
    if (hasNoZombieInEarshot) return;
    const z = near[Math.floor(Math.random() * near.length)];
    mixer.play(VOICE[z.type], { x: z.x, y: z.y, gain: 0.8 });
  }

  /**
   * Footsteps for everyone on screen this frame, on the ground under them. Silent while muted
   * or at zero volume, and until the audio has unlocked, like every other sound.
   */
  stepPlayers(players: readonly PlayerEntity[], localId: string | null, map: WorldMap, dt: number): void {
    const isSilenced = !this.mixer || this.level === 0;
    if (isSilenced) {
      this.footsteps.reset();
      return;
    }
    this.footsteps.tick(players, localId, map, dt, this.playStep);
  }

  /** Brutes' and bosses' footfalls this frame. Silent until unlocked and on mute, like footsteps. */
  stompZombies(zombies: readonly Stomper[]): void {
    const silent = !this.mixer || this.level === 0;
    if (silent) {
      this.stompers.reset();
      return;
    }
    this.stompers.tick(zombies, this.playStep);
  }

  private reloadStart(weapon: WeaponId, playerId: string, at: { x: number; y: number; local: boolean }): void {
    const byTheShell = weapon === 'shotgun';
    if (!byTheShell) {
      this.mixer?.play('mag_out', at);
      return;
    }
    this.mixer?.play('shell_load', at);
    this.shellLoads.set(playerId, { ...at, next: SHELL_EVERY, loaded: 1 });
  }

  private reloadEnd(weapon: WeaponId, playerId: string, at: { x: number; y: number; local: boolean }): void {
    this.shellLoads.delete(playerId);
    const byTheShell = weapon === 'shotgun';
    if (byTheShell) {
      this.mixer?.play('pump', at);
      return;
    }
    this.mixer?.play('mag_in', at);
    const tail = RELOAD_TAIL[weapon];
    if (tail) this.mixer?.play(tail, { ...at, delay: 0.12 });
  }

  /** Shells go in one by one while a shotgun reloads; the reload's end (or a full tube) stops them. */
  private loadShells(mixer: Mixer, dt: number): void {
    for (const [id, load] of this.shellLoads) {
      load.next -= dt;
      const between = load.next > 0;
      if (between) continue;
      load.next += SHELL_EVERY;
      load.loaded += 1;
      mixer.play('shell_load', { x: load.x, y: load.y, local: load.local });
      const tubeFull = load.loaded >= SHELLS_MAX;
      if (tubeFull) this.shellLoads.delete(id);
    }
  }

  dispose(): void {
    this.shellLoads.clear();
    this.clearPreviewTimer();
    this.soundtrack?.dispose();
    this.music?.dispose();
    this.mixer?.dispose();
    this.soundtrack = null;
    this.music = null;
    this.mixer = null;
  }

  private ambient(name: 'distant_groan' | 'distant_crash'): void {
    if (!this.mixer) return;
    const { x, y } = this.mixer.listener;
    const a = Math.random() * Math.PI * 2;
    const r = 330 + Math.random() * 60;
    // The lull is meant to be nearly silent: its few sounds are far and faint.
    const lull = this.scene === 'intermission';
    this.mixer.play(name, { x: x + Math.cos(a) * r, y: y + Math.sin(a) * r, gain: lull ? 0.8 : 1.4 });
  }

  private get level(): number {
    return this.prefs.muted ? 0 : this.prefs.volume;
  }

  private get buses(): BusLevels {
    return { music: this.prefs.music, sfx: this.prefs.sfx };
  }

  private applyLevel(): void {
    this.mixer?.setLevel(this.level);
    this.mixer?.setBuses(this.buses);
  }

  private persist(): void {
    this.applyLevel();
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(this.prefs));
    } catch {
      // chemx-allow: best-effort storage blocked: the setting still applies for this session
    }
  }
}
