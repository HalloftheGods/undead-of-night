import { makeVoice, noise, noiseBuffer, tone, type Voice } from './voice-kit.ts';

export type Scene = 'menu' | 'intermission' | 'wave' | 'gameover' | 'victory' | 'credits' | 'bunker';

const BPM = 84;
const STEP = 60 / BPM / 4;
const LOOKAHEAD = 0.3;
const D2 = 73.42;

/** Chord roots as semitones above D, with the third that colours each one. */
const CHORDS: ReadonlyArray<{ root: number; third: number; fifth: number }> = [
  { root: 0, third: 3, fifth: 7 },
  { root: -4, third: 4, fifth: 7 },
  { root: -7, third: 3, fifth: 7 },
  { root: -2, third: 3, fifth: 6 },
];
const ARP_STEPS: ReadonlyArray<number | null> = [0, null, 1, null, 2, 3, null, 2, 1, null, 2, null, 3, null, 1, 0];

const semis = (n: number): number => 2 ** (n / 12);

interface Levels { drone: number; pad: number; wind: number }
const LEVELS: Record<Scene, Levels> = {
  menu: { drone: 0.07, pad: 0.1, wind: 0.05 },
  intermission: { drone: 0, pad: 0, wind: 0.035 },
  wave: { drone: 0.1, pad: 0, wind: 0.06 },
  gameover: { drone: 0, pad: 0, wind: 0.025 },
  victory: { drone: 0, pad: 0, wind: 0 },
  credits: { drone: 0, pad: 0, wind: 0 },
  bunker: { drone: 0, pad: 0.06, wind: 0 },
};

/**
 * Generative bed on a lookahead clock: drone and wind always, pad in the menu,
 * low pulse and arpeggio fading in with intensity. Scheduling is by audio time,
 * so a stalled main thread cannot leave a gap or a stutter.
 */
export class Music {
  private scene: Scene = 'menu';
  private target = 0;
  private smooth = 0;
  private step = 0;
  private next = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private ambientIn = 18;
  /** Off while a recorded track plays; wind and distant sounds carry on under it. */
  private bedOn = true;
  private readonly droneGain: GainNode;
  private readonly padGain: GainNode;
  private readonly windGain: GainNode;
  private readonly stoppers: Array<() => void> = [];

  constructor(
    private readonly ctx: BaseAudioContext,
    private readonly out: AudioNode,
    private readonly onAmbient: (name: 'distant_groan' | 'distant_crash') => void,
  ) {
    this.droneGain = this.silentGain();
    this.padGain = this.silentGain();
    this.windGain = this.silentGain();
    this.buildDrone();
    this.buildPad();
    this.buildWind();
    this.next = ctx.currentTime + 0.1;
    this.timer = setInterval(() => this.pump(), 40);
    this.setScene('menu');
  }

  setScene(scene: Scene): void {
    this.scene = scene;
    const lv = LEVELS[scene];
    const t = this.ctx.currentTime;
    const tc = scene === 'wave' || scene === 'menu' || scene === 'intermission' ? 0.7 : 0.9;
    this.droneGain.gain.setTargetAtTime(this.bedOn ? lv.drone : 0, t, tc);
    this.padGain.gain.setTargetAtTime(this.bedOn ? lv.pad : 0, t, tc);
    this.windGain.gain.setTargetAtTime(lv.wind, t, tc);
  }

  setBedOn(on: boolean): void {
    this.bedOn = on;
    this.setScene(this.scene);
  }

  setIntensity(value: number): void {
    this.target = Math.max(0, Math.min(1, value));
  }

  dispose(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    for (const stop of this.stoppers) stop();
    this.stoppers.length = 0;
  }

  private silentGain(): GainNode {
    const g = this.ctx.createGain();
    g.gain.value = 0;
    g.connect(this.out);
    return g;
  }

  private track<T extends AudioScheduledSourceNode>(node: T): T {
    node.start();
    this.stoppers.push(() => { try { node.stop(); } catch { /* chemx-allow: best-effort a node already stopped has nothing left to stop */ } });
    return node;
  }

  private osc(type: OscillatorType, hz: number, detune: number, into: AudioNode): OscillatorNode {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.value = hz;
    o.detune.value = detune;
    o.connect(into);
    return this.track(o);
  }

  /** Slow sine wobbling a param around its current value. */
  private wobble(rate: number, depth: number, param: AudioParam): void {
    const l = this.ctx.createOscillator();
    l.frequency.value = rate;
    const g = this.ctx.createGain();
    g.gain.value = depth;
    l.connect(g);
    g.connect(param);
    this.track(l);
  }

  private buildDrone(): void {
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 170;
    lp.Q.value = 2;
    lp.connect(this.droneGain);
    this.wobble(0.07, 60, lp.frequency);
    this.osc('sawtooth', D2, -6, lp);
    this.osc('sawtooth', D2, 7, lp);
    this.osc('sine', D2 / 2, 0, lp);
  }

  private buildPad(): void {
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 700;
    const amp = this.ctx.createGain();
    amp.gain.value = 0.5;
    lp.connect(amp);
    amp.connect(this.padGain);
    this.wobble(0.13, 0.2, amp.gain);
    for (const [hz, det] of [[D2 * 2, -5], [D2 * 2 * semis(3), 4], [D2 * 4 * semis(7), -3], [D2 * 4 * semis(8), 6]] as const) {
      this.osc('triangle', hz, det, lp);
    }
  }

  private buildWind(): void {
    const src = this.ctx.createBufferSource();
    src.buffer = noiseBuffer(this.ctx);
    src.loop = true;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 520;
    bp.Q.value = 0.6;
    const swell = this.ctx.createGain();
    swell.gain.value = 0.7;
    src.connect(bp);
    bp.connect(swell);
    swell.connect(this.windGain);
    this.wobble(0.09, 0.3, swell.gain);
    this.wobble(0.05, 220, bp.frequency);
    this.track(src);
  }

  private pump(): void {
    const now = this.ctx.currentTime;
    const hasFallenBehind = this.next < now - 0.1;
    if (hasFallenBehind) this.next = now;
    while (this.next < now + LOOKAHEAD) {
      this.smooth += (this.target - this.smooth) * 0.12;
      this.playStep(this.step, this.next);
      this.next += STEP;
      this.step++;
      this.ambientIn -= STEP;
    }
    const isAmbientDue = this.ambientIn <= 0;
    if (isAmbientDue) {
      const lull = this.scene === 'intermission';
      this.ambientIn = lull ? 14 + Math.random() * 14 : 16 + Math.random() * 20;
      const groan = lull || Math.random() < 0.6;
      const hushed = this.scene === 'gameover' || this.scene === 'victory' || this.scene === 'credits';
      if (!hushed) this.onAmbient(groan ? 'distant_groan' : 'distant_crash');
    }
  }

  private voice(t: number): Voice {
    return makeVoice(this.ctx, this.out, t, 1, Math.random);
  }

  private playStep(step: number, t: number): void {
    if (!this.bedOn) return;
    const isMenu = this.scene === 'menu';
    if (isMenu) return this.menuStep(step, t);
    const isNotWave = this.scene !== 'wave';
    if (isNotWave) return;
    const i = this.smooth;
    const bar = Math.floor(step / 16);
    const s = step % 16;
    const chord = CHORDS[Math.floor(bar / 2) % CHORDS.length];
    const root = D2 * semis(chord.root);
    const v = this.voice(t);

    const isDownbeat = s === 0 || s === 8;
    if (isDownbeat) {
      tone(v, { type: 'sine', f0: root, f1: root * 0.7, decay: 0.35, gain: 0.2 + 0.25 * i, lp: 200 });
    }
    const isOffbeatKick = i > 0.3 && s % 4 === 0 && s !== 0 && s !== 8;
    if (isOffbeatKick) {
      tone(v, { type: 'sine', f0: root * 1.5, f1: root * 0.8, decay: 0.15, gain: 0.4 * i, lp: 220 });
    }
    const isHatStep = i > 0.65 && s === 14;
    if (isHatStep) noise(v, { filter: 'bandpass', freq: 1800, q: 2, decay: 0.05, gain: 0.04 * i });
    const isArpeggioOn = i > 0.4;
    if (isArpeggioOn) {
      const idx = ARP_STEPS[s];
      const hasArpNote = idx !== null;
      if (hasArpNote) {
        const tones = [0, chord.third, chord.fifth, 12];
        const hz = D2 * 2 * semis(chord.root + tones[idx]);
        tone(v, { type: 'triangle', f0: hz, decay: 0.16, gain: 0.05 + 0.16 * (i - 0.4), lp: 1500 });
      }
    }
    const isBellStep = s === 0 && Math.random() < 0.3;
    if (isBellStep) {
      tone(v, { type: 'sine', f0: D2 * 8 * semis(chord.root + 1), attack: 0.1, decay: 0.8, gain: 0.025 + 0.03 * i });
    }
  }

  private menuStep(step: number, t: number): void {
    const isOffBar = step % 32 !== 0;
    if (isOffBar) return;
    const v = this.voice(t);
    tone(v, { type: 'sine', f0: D2 * 2, f1: D2 * 1.8, decay: 1.2, gain: 0.1, lp: 300, attack: 0.05 });
  }
}
