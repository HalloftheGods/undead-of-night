import { biomeFor } from '../../shared/biomes.ts';
import type { SfxName } from './sfx-registry.ts';
import { noise, tone, type Recipe } from './voice-kit.ts';

// Biome ambience beds. Each bed is a long, quiet layer that fades in and out; AmbienceBed starts a new
// layer before the last has faded, so the layers crossfade into a bed with no loop seam. The plain towns
// keep only the generative wind in music.ts; the biomes that look different also sound different.

/** Every layer has the same shape: a slow swell, a long body, a slow fade. About 6.1 s. */
const BED = { attack: 1.2, hold: 3.4, decay: 1.2, release: 0.3 } as const;

/** Flooded streets: water lapping, frogs answering each other, insects high up. */
export const ambMarsh: Recipe = (v) => {
  noise(v, { ...BED, filter: 'lowpass', freq: 380, gain: 0.12, trem: { rate: 0.6 + v.rand() * 0.4, depth: 0.6 } });
  noise(v, { ...BED, filter: 'bandpass', freq: 5200, q: 6, gain: 0.025, trem: { rate: 22, depth: 0.8 } });
  const croaks = 2 + Math.floor(v.rand() * 3);
  for (let i = 0; i < croaks; i += 1) {
    const at = 0.8 + v.rand() * 4;
    const f = 140 + v.rand() * 80;
    const trem = { rate: 38, depth: 0.9 };
    tone(v, { at, type: 'square', f0: f, f1: f * 0.85, attack: 0.01, decay: 0.16, gain: 0.05, lp: 900, trem });
    tone(v, { at: at + 0.24, type: 'square', f0: f * 0.95, f1: f * 0.8, attack: 0.01, decay: 0.12, gain: 0.04, lp: 900, trem });
  }
};

/** Tundra: gusts rising and falling, a thin whistle through the wrecks, now and then ice creaking. */
export const ambTundra: Recipe = (v) => {
  noise(v, {
    ...BED, filter: 'bandpass', freq: 380, freq1: 900 + v.rand() * 500, q: 1.2, gain: 0.14,
    trem: { rate: 0.25 + v.rand() * 0.2, depth: 0.7 },
  });
  noise(v, { ...BED, filter: 'highpass', freq: 3500, gain: 0.03, trem: { rate: 0.4, depth: 0.8 } });
  tone(v, { at: 0.6, type: 'sine', f0: 900 + v.rand() * 300, f1: 1300, attack: 1.2, hold: 1.4, decay: 1.5, gain: 0.012, vib: { rate: 0.7, cents: 60 } });
  const creaks = v.rand() < 0.5;
  if (creaks) {
    tone(v, { at: 1.5 + v.rand() * 3, type: 'triangle', f0: 320, f1: 260, attack: 0.05, decay: 0.35, gain: 0.03, vib: { rate: 24, cents: 80 } });
  }
};

/** Blight and the Hive: a sour low hum and sludge bubbling up and popping. */
export const ambSludge: Recipe = (v) => {
  tone(v, { ...BED, type: 'sawtooth', f0: 55, gain: 0.04, lp: 180, trem: { rate: 0.3, depth: 0.5 } });
  noise(v, { ...BED, filter: 'lowpass', freq: 260, gain: 0.06 });
  const pops = 5 + Math.floor(v.rand() * 5);
  for (let i = 0; i < pops; i += 1) {
    const f = 180 + v.rand() * 320;
    tone(v, { at: 0.5 + v.rand() * 4.8, type: 'sine', f0: f, f1: f * 2.6, attack: 0.005, decay: 0.05, gain: 0.07 });
  }
};

/** Ashland: fires still burning somewhere, a deep rumble, and embers cracking. */
export const ambEmbers: Recipe = (v) => {
  noise(v, { ...BED, filter: 'bandpass', freq: 700, q: 0.7, gain: 0.07, trem: { rate: 1.3 + v.rand(), depth: 0.4 } });
  tone(v, { ...BED, type: 'sine', f0: 38, gain: 0.08, lp: 90 });
  const ticks = 10 + Math.floor(v.rand() * 10);
  for (let i = 0; i < ticks; i += 1) {
    noise(v, { at: 0.4 + v.rand() * 5, filter: 'highpass', freq: 2500 + v.rand() * 3000, attack: 0.002, decay: 0.012, gain: 0.05 + v.rand() * 0.05 });
  }
};

/** Pinewood and the overgrown town: crickets, leaves moving, sometimes an owl. */
export const ambForest: Recipe = (v) => {
  tone(v, { ...BED, type: 'sine', f0: 4200 + v.rand() * 400, gain: 0.008, trem: { rate: 14, depth: 1 } });
  tone(v, { ...BED, at: 0.3, type: 'sine', f0: 3700 + v.rand() * 300, gain: 0.006, trem: { rate: 11, depth: 1 } });
  noise(v, { ...BED, filter: 'bandpass', freq: 600, q: 0.7, gain: 0.04, trem: { rate: 0.2, depth: 0.6 } });
  const hoots = v.rand() < 0.4;
  if (hoots) {
    const at = 1 + v.rand() * 3;
    tone(v, { at, type: 'sine', f0: 390, f1: 360, attack: 0.04, decay: 0.3, gain: 0.04, lp: 800 });
    tone(v, { at: at + 0.5, type: 'sine', f0: 380, f1: 330, attack: 0.05, decay: 0.55, gain: 0.04, lp: 800 });
  }
};

export type AmbienceName = Extract<SfxName, `amb_${string}`>;

/** The bed each biome lays under its town. Temperate, scrapland and cordon keep the wind alone. */
const BED_FOR: Readonly<Record<string, AmbienceName>> = {
  overgrown: 'amb_forest',
  pinewood: 'amb_forest',
  marsh: 'amb_marsh',
  tundra: 'amb_tundra',
  blight: 'amb_sludge',
  hive: 'amb_sludge',
  ashland: 'amb_embers',
};

/** The ambience bed for a level's town, or null for a town that has none. */
export function ambienceFor(level: number): AmbienceName | null {
  return BED_FOR[biomeFor(level).id] ?? null;
}

/** Seconds between layers. A layer runs about 6.1 s with a 1.2 s fade, so one every 4.8 s overlaps the last. */
export const BED_EVERY = 4.8;

/** Lays an ambience bed, one layer at a time, so a change of town or scene changes it at the next layer. */
export class AmbienceBed {
  private bed: AmbienceName | null = null;
  private next = 0;

  /** One frame. `bed` is what should be playing now, or null for silence. */
  tick(dt: number, bed: AmbienceName | null, play: (name: AmbienceName) => void): void {
    const changed = bed !== this.bed;
    if (changed) {
      this.bed = bed;
      this.next = 0;
    }
    if (!bed) return;
    this.next -= dt;
    const isLayerPlaying = this.next > 0;
    if (isLayerPlaying) return;
    // A long stall (a hidden tab) starts one layer, never a burst of the ones it missed.
    this.next = Math.max(this.next + BED_EVERY, BED_EVERY * 0.5);
    play(bed);
  }

  reset(): void {
    this.bed = null;
    this.next = 0;
  }
}
