import { SFX, type SfxName } from './sfx-registry.ts';
import { makeVoice } from './voice-kit.ts';

/** World pixels beyond which a positional sound is not played at all. */
export const HEARING_RANGE = 420;
/** Distance over which a source sweeps from centre to a hard pan. */
const PAN_SPAN = 260;
const MAX_VOICES = 44;
const TRACK_LEVEL = 0.35;
/** The generated bed sits far under everything else. */
const BED_LEVEL = 0.12;

/** The player's two sub-levels, 0..1, under the master volume. */
export interface BusLevels { readonly music: number; readonly sfx: number }
export const FULL_BUSES: BusLevels = { music: 1, sfx: 1 };
/** The effects' low-pass when hearing is clear, and at its most muffled near death. */
const CLEAR_HZ = 20000;
const MUFFLED_HZ = 1400;

export interface Spatial { readonly gain: number; readonly pan: number }

/** Distance rolloff and stereo pan for a source, or null when out of earshot. */
export function spatialize(lx: number, ly: number, x: number, y: number): Spatial | null {
  const dx = x - lx;
  const dist = Math.hypot(dx, y - ly);
  const isOutOfEarshot = dist >= HEARING_RANGE;
  if (isOutOfEarshot) return null;
  const gain = (1 - dist / HEARING_RANGE) ** 1.5;
  const isInaudible = gain < 0.01;
  if (isInaudible) return null;
  return { gain, pan: Math.max(-1, Math.min(1, dx / PAN_SPAN)) };
}

export interface PlayOpts {
  /** World position. Omit for a non-positional sound. */
  x?: number;
  y?: number;
  /** The local player's own sound: never attenuated, bypasses cooldown. */
  local?: boolean;
  /** Seconds from now. */
  delay?: number;
  pitch?: number;
  gain?: number;
}

/** Master chain plus the polyphony-limited voice player. */
export class Mixer {
  readonly sfx: GainNode;
  readonly music: GainNode;
  /** The recorded soundtrack, mixed well under the effects so shots and groans still read. */
  readonly tracks: GainNode;
  private readonly master: GainNode;
  /** Low-pass on the effects only: the world dulls as the player bleeds out, the music does not. */
  private readonly muffle: BiquadFilterNode;
  private readonly active = new Map<SfxName, number>();
  private readonly last = new Map<SfxName, number>();
  private total = 0;
  private lx = 0;
  private ly = 0;
  private timers = new Set<ReturnType<typeof setTimeout>>();

  /** Starts at the player's level: a ramp from the node's default would leak a burst past a mute. */
  constructor(readonly ctx: AudioContext, level: number, buses: BusLevels = FULL_BUSES) {
    this.sfx = ctx.createGain();
    this.sfx.gain.value = buses.sfx;
    this.music = ctx.createGain();
    this.music.gain.value = BED_LEVEL * buses.music;
    this.tracks = ctx.createGain();
    this.tracks.gain.value = TRACK_LEVEL * buses.music;
    const bus = ctx.createGain();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 12;
    comp.ratio.value = 5;
    comp.attack.value = 0.004;
    comp.release.value = 0.2;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -3;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.001;
    limiter.release.value = 0.08;
    const clip = ctx.createWaveShaper();
    clip.curve = softClip();
    this.master = ctx.createGain();
    this.master.gain.value = level;
    this.muffle = ctx.createBiquadFilter();
    this.muffle.type = 'lowpass';
    this.muffle.frequency.value = CLEAR_HZ;
    this.sfx.connect(this.muffle);
    this.muffle.connect(bus);
    this.music.connect(bus);
    this.tracks.connect(bus);
    bus.connect(comp);
    comp.connect(limiter);
    limiter.connect(clip);
    clip.connect(this.master);
    this.master.connect(ctx.destination);
  }

  setListener(x: number, y: number): void {
    this.lx = x;
    this.ly = y;
  }

  get listener(): { x: number; y: number } {
    return { x: this.lx, y: this.ly };
  }

  setLevel(level: number): void {
    this.master.gain.setTargetAtTime(level, this.ctx.currentTime, 0.02);
  }

  /** Music (the bed and the soundtrack together) and effects, each under the master level. */
  setBuses(buses: BusLevels): void {
    const now = this.ctx.currentTime;
    this.sfx.gain.setTargetAtTime(buses.sfx, now, 0.02);
    this.music.gain.setTargetAtTime(BED_LEVEL * buses.music, now, 0.02);
    this.tracks.gain.setTargetAtTime(TRACK_LEVEL * buses.music, now, 0.02);
  }

  /** 0 is clear hearing, 1 the most muffled. Swept on a log scale so the middle still sounds like a change. */
  setMuffle(amount: number): void {
    const t = Math.max(0, Math.min(1, amount));
    const hz = CLEAR_HZ * (MUFFLED_HZ / CLEAR_HZ) ** t;
    this.muffle.frequency.setTargetAtTime(hz, this.ctx.currentTime, 0.15);
  }

  play(name: SfxName, o: PlayOpts = {}): void {
    const def = SFX[name];
    const { ctx } = this;
    const now = ctx.currentTime;
    const positional = o.x !== undefined && o.y !== undefined && !o.local;
    const space = positional ? spatialize(this.lx, this.ly, o.x as number, o.y as number) : null;
    const isOutOfRange = positional && !space;
    if (isOutOfRange) return;
    const hasVoice = this.hasVoiceFor(name, Boolean(o.local), now);
    if (!hasVoice) return;
    this.last.set(name, now);

    const delay = o.delay ?? 0;
    const pitch = (o.pitch ?? 1) * (1 + (Math.random() * 2 - 1) * def.vary);
    const level = def.gain * (o.gain ?? 1) * (space?.gain ?? 1) * (0.9 + Math.random() * 0.2);
    const trim = ctx.createGain();
    trim.gain.value = level;
    let tail: AudioNode = trim;
    const canPan = space && ctx.createStereoPanner;
    if (canPan) {
      const pan = ctx.createStereoPanner();
      pan.pan.value = space.pan;
      trim.connect(pan);
      tail = pan;
    }
    tail.connect(this.sfx);
    def.play(makeVoice(ctx, trim, now + delay + 0.005, pitch, Math.random));

    this.total++;
    this.active.set(name, (this.active.get(name) ?? 0) + 1);
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      trim.disconnect();
      const hasPanner = tail !== trim;
      if (hasPanner) tail.disconnect();
      this.total--;
      this.active.set(name, (this.active.get(name) ?? 1) - 1);
    }, (delay + def.length + 0.2) * 1000);
    this.timers.add(timer);
  }

  /** A sound waits out its cooldown and its voice cap; the player's own sounds get a little slack on both. */
  private hasVoiceFor(name: SfxName, local: boolean, now: number): boolean {
    const def = SFX[name];
    const isCoolingDown = !local && now - (this.last.get(name) ?? -1) < def.cooldown;
    const slack = local ? 2 : 0;
    const isNameBusy = (this.active.get(name) ?? 0) >= def.voices + slack;
    const isMixFull = this.total >= MAX_VOICES + (local ? 8 : 0);
    return !isCoolingDown && !isNameBusy && !isMixFull;
  }

  dispose(): void {
    for (const timer of this.timers) clearTimeout(timer);
    this.timers.clear();
    void this.ctx.close().catch(() => undefined);
  }
}

/** Gentle tanh ceiling after the limiter so nothing can exceed full scale. */
function softClip(): Float32Array<ArrayBuffer> {
  const n = 512;
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) c[i] = Math.tanh(((i / (n - 1)) * 2 - 1) * 1.2) / Math.tanh(1.2);
  return c;
}
