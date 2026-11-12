// The engine of the car nearest the listener: one held voice that follows its speed, and is
// silent when nobody sits in a car. Built from two oscillators, so it starts and stops by ramp.

import type { VehicleView } from '../../shared/protocol.ts';
import { HEARING_RANGE } from './mixer.ts';

/** Idle and top-speed pitch of the engine's base oscillator, hz. */
const IDLE_HZ = 48;
const TOP_HZ = 130;
/** Speed at which the engine is at full pitch and level, px/s. */
const FULL_SPEED = 220;
/** Level at idle, and the extra level added by full speed. */
const IDLE_LEVEL = 0.05;
const SPEED_LEVEL = 0.2;
/** Seconds for a ramp to cover about two thirds of its way; the start and stop fades. */
const FADE = 0.15;
const GLIDE = 0.08;

/** What the engine should sound like now: base pitch in hz and linear level. */
export interface EngineTarget { readonly pitch: number; readonly level: number }

/** The nearest occupied car's sound, quieter with distance, or null when no car is occupied or in earshot. */
export function engineTarget(cars: readonly VehicleView[] | undefined, x: number, y: number): EngineTarget | null {
  const occupied = (cars ?? []).filter((car) => car.seats.some((seat) => seat !== null));
  if (occupied.length === 0) return null;
  const distance = (car: VehicleView) => Math.hypot(car.x - x, car.y - y);
  const nearest = occupied.reduce((a, b) => (distance(b) < distance(a) ? b : a));
  const reach = 1 - distance(nearest) / HEARING_RANGE;
  if (reach <= 0) return null;
  const share = Math.min(1, Math.abs(nearest.speed) / FULL_SPEED);
  return { pitch: IDLE_HZ + (TOP_HZ - IDLE_HZ) * share, level: (IDLE_LEVEL + SPEED_LEVEL * share) * reach };
}

interface Voices { readonly low: OscillatorNode; readonly high: OscillatorNode; readonly gain: GainNode }

/** A held engine note. Nothing exists while silent; it fades in on the first target and out, then is torn down, on null. */
export class EngineLoop {
  private voices: Voices | null = null;
  private teardown: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly ctx: BaseAudioContext, private readonly out: AudioNode) {}

  /** Follows the target; null fades the engine out and frees it. */
  set(target: EngineTarget | null): void {
    if (target === null) return this.fadeOut();
    if (this.teardown) {
      clearTimeout(this.teardown);
      this.teardown = null;
    }
    const voices = this.voices ?? this.build();
    const now = this.ctx.currentTime;
    voices.low.frequency.setTargetAtTime(target.pitch, now, GLIDE);
    voices.high.frequency.setTargetAtTime(target.pitch * 2, now, GLIDE);
    voices.gain.gain.setTargetAtTime(target.level, now, FADE);
  }

  /** Frees the nodes at once. */
  dispose(): void {
    if (this.teardown) clearTimeout(this.teardown);
    this.teardown = null;
    this.free();
  }

  private build(): Voices {
    const { ctx } = this;
    const low = ctx.createOscillator();
    const high = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    low.type = 'sawtooth';
    high.type = 'square';
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    gain.gain.value = 0;
    const mix = ctx.createGain();
    mix.gain.value = 0.35;
    low.connect(filter);
    high.connect(mix);
    mix.connect(filter);
    filter.connect(gain);
    gain.connect(this.out);
    low.start();
    high.start();
    this.voices = { low, high, gain };
    return this.voices;
  }

  private fadeOut(): void {
    const voices = this.voices;
    if (!voices || this.teardown) return;
    voices.gain.gain.setTargetAtTime(0, this.ctx.currentTime, FADE);
    this.teardown = setTimeout(() => {
      this.teardown = null;
      this.free();
    }, FADE * 8 * 1000);
  }

  private free(): void {
    const voices = this.voices;
    this.voices = null;
    if (!voices) return;
    voices.low.stop();
    voices.high.stop();
    voices.gain.disconnect();
  }
}
