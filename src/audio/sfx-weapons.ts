import { noise, tone, type Recipe } from './voice-kit.ts';

// Each gun is a crack (bright noise), a body (low thump) and a tail (room).

export const pistol: Recipe = (v) => {
  noise(v, { filter: 'highpass', freq: 1800, q: 0.7, decay: 0.05, gain: 0.5, drive: 0.5 });
  noise(v, { filter: 'bandpass', freq: 3200, q: 1.2, decay: 0.03, gain: 0.35 });
  tone(v, { type: 'sine', f0: 190, f1: 60, decay: 0.09, gain: 0.55 });
  noise(v, { filter: 'lowpass', freq: 1100, freq1: 300, decay: 0.2, gain: 0.14, attack: 0.004 });
  noise(v, { at: 0.07, filter: 'bandpass', freq: 1500, q: 0.8, decay: 0.1, gain: 0.06 });
};

export const carbine: Recipe = (v) => {
  noise(v, { filter: 'bandpass', freq: 2800, q: 0.9, decay: 0.035, gain: 0.55, drive: 0.7 });
  noise(v, { filter: 'highpass', freq: 5500, decay: 0.02, gain: 0.3 });
  tone(v, { type: 'triangle', f0: 300, f1: 95, decay: 0.07, gain: 0.45 });
  tone(v, { type: 'sine', f0: 2600, f1: 1800, decay: 0.03, gain: 0.08 });
  noise(v, { filter: 'lowpass', freq: 1600, freq1: 400, decay: 0.3, gain: 0.14, attack: 0.004 });
  noise(v, { at: 0.09, filter: 'bandpass', freq: 2200, q: 1, decay: 0.14, gain: 0.05 });
};

export const shotgun: Recipe = (v) => {
  noise(v, { filter: 'lowpass', freq: 3500, freq1: 400, decay: 0.14, gain: 0.55, drive: 0.9 });
  noise(v, { filter: 'highpass', freq: 1200, decay: 0.07, gain: 0.3, drive: 0.5 });
  tone(v, { type: 'sine', f0: 120, f1: 36, decay: 0.24, gain: 0.7 });
  tone(v, { type: 'triangle', f0: 70, f1: 30, decay: 0.3, gain: 0.3, drive: 0.4 });
  noise(v, { filter: 'lowpass', freq: 700, freq1: 150, decay: 0.55, gain: 0.2, attack: 0.01 });
};

export const dryClick: Recipe = (v) => {
  tone(v, { type: 'square', f0: 1800, f1: 1100, decay: 0.012, gain: 0.18, lp: 5000 });
  noise(v, { filter: 'bandpass', freq: 3000, q: 2, decay: 0.01, gain: 0.25 });
  tone(v, { at: 0.035, type: 'square', f0: 900, f1: 600, decay: 0.012, gain: 0.1, lp: 3000 });
};

export const magOut: Recipe = (v) => {
  noise(v, { filter: 'bandpass', freq: 2500, q: 3, decay: 0.03, gain: 0.3 });
  tone(v, { at: 0.01, type: 'triangle', f0: 900, f1: 420, decay: 0.05, gain: 0.12 });
  noise(v, { at: 0.09, filter: 'lowpass', freq: 450, decay: 0.05, gain: 0.35 });
};

export const magIn: Recipe = (v) => {
  noise(v, { filter: 'lowpass', freq: 520, decay: 0.06, gain: 0.4 });
  tone(v, { type: 'sine', f0: 170, f1: 90, decay: 0.08, gain: 0.35 });
  noise(v, { at: 0.07, filter: 'highpass', freq: 3000, decay: 0.02, gain: 0.3 });
  tone(v, { at: 0.07, type: 'square', f0: 1500, f1: 900, decay: 0.015, gain: 0.08, lp: 4000 });
};

export const pump: Recipe = (v) => {
  noise(v, { filter: 'bandpass', freq: 1800, q: 2, decay: 0.04, gain: 0.4 });
  tone(v, { type: 'triangle', f0: 320, f1: 140, decay: 0.06, gain: 0.35 });
  noise(v, { at: 0.17, filter: 'bandpass', freq: 2300, q: 2, decay: 0.04, gain: 0.4 });
  tone(v, { at: 0.17, type: 'triangle', f0: 400, f1: 180, decay: 0.06, gain: 0.3 });
  noise(v, { at: 0.19, filter: 'lowpass', freq: 600, decay: 0.07, gain: 0.25 });
};

export const shellLoad: Recipe = (v) => {
  noise(v, { filter: 'bandpass', freq: 2000, q: 2.5, decay: 0.025, gain: 0.3 });
  tone(v, { type: 'triangle', f0: 600, f1: 300, decay: 0.05, gain: 0.2 });
  noise(v, { at: 0.04, filter: 'lowpass', freq: 500, decay: 0.04, gain: 0.25 });
};

export const weaponSwitch: Recipe = (v) => {
  noise(v, { filter: 'bandpass', freq: 800, freq1: 2200, q: 0.8, attack: 0.03, decay: 0.07, gain: 0.18 });
  noise(v, { at: 0.08, filter: 'bandpass', freq: 2600, q: 3, decay: 0.025, gain: 0.3 });
  tone(v, { at: 0.08, type: 'triangle', f0: 700, f1: 380, decay: 0.05, gain: 0.12 });
};

/** Round hitting concrete: a chip, grit, and sometimes a ricochet whine. */
export const impact: Recipe = (v) => {
  noise(v, { filter: 'bandpass', freq: 3000, q: 1.5, decay: 0.04, gain: 0.4 });
  tone(v, { type: 'sine', f0: 1800, f1: 700, decay: 0.03, gain: 0.12 });
  noise(v, { at: 0.01, filter: 'highpass', freq: 5000, decay: 0.09, gain: 0.12 });
  const hasRicochet = v.rand() < 0.35;
  if (hasRicochet) tone(v, { at: 0.02, type: 'sine', f0: 3200, f1: 1300, decay: 0.16, gain: 0.05 });
};

/** Pistol: the slide snapping forward on a fresh magazine. */
export const slideDrop: Recipe = (v) => {
  noise(v, { filter: 'bandpass', freq: 3400, q: 2.5, decay: 0.02, gain: 0.35 });
  tone(v, { type: 'square', f0: 1300, f1: 700, decay: 0.02, gain: 0.1, lp: 4500 });
  tone(v, { type: 'sine', f0: 240, f1: 120, decay: 0.05, gain: 0.25 });
};

/** Carbine: the charging handle pulled back and let go. */
export const boltRack: Recipe = (v) => {
  noise(v, { filter: 'bandpass', freq: 1500, freq1: 2600, q: 1.5, attack: 0.01, decay: 0.05, gain: 0.25 });
  tone(v, { type: 'triangle', f0: 520, f1: 300, decay: 0.04, gain: 0.15 });
  noise(v, { at: 0.11, filter: 'bandpass', freq: 3000, q: 2.5, decay: 0.025, gain: 0.4 });
  tone(v, { at: 0.11, type: 'square', f0: 1600, f1: 850, decay: 0.02, gain: 0.1, lp: 4500 });
  tone(v, { at: 0.11, type: 'sine', f0: 210, f1: 100, decay: 0.06, gain: 0.3 });
};
