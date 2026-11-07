import { noise, tone, type Recipe } from './voice-kit.ts';

// Footsteps. Each is one short, dry, quiet tick of a shoe on the ground it is crossing,
// kept under 150ms and well below gunfire and groans. Pitch spread in the registry makes
// no two steps identical.

/** Asphalt, sidewalk, kerb, paint and floors: a soft shoe tick. */
export const stepHard: Recipe = (v) => {
  noise(v, { filter: 'bandpass', freq: 1800, q: 1.2, attack: 0.002, decay: 0.035, gain: 0.3 });
  tone(v, { type: 'sine', f0: 150, f1: 90, attack: 0.002, decay: 0.05, gain: 0.18 });
};

/** Grass and dirt: a soft scuff. */
export const stepSoft: Recipe = (v) => {
  noise(v, { filter: 'lowpass', freq: 1300, freq1: 700, attack: 0.012, decay: 0.07, gain: 0.3 });
  tone(v, { type: 'sine', f0: 110, f1: 70, attack: 0.005, decay: 0.05, gain: 0.1 });
};

/** Wading: a wet splash and slosh. */
export const stepWater: Recipe = (v) => {
  noise(v, { filter: 'bandpass', freq: 700, freq1: 1900, q: 2, attack: 0.005, decay: 0.1, gain: 0.35 });
  noise(v, { at: 0.03, filter: 'highpass', freq: 3200, attack: 0.004, decay: 0.05, gain: 0.12 });
};

/** Snow: a dry crunch. */
export const stepSnow: Recipe = (v) => {
  noise(v, { filter: 'highpass', freq: 2500, attack: 0.004, decay: 0.09, gain: 0.22 });
  noise(v, { at: 0.02, filter: 'bandpass', freq: 4200, q: 3, attack: 0.002, decay: 0.04, gain: 0.14 });
};

/** Sludge: a low squelch as a boot pulls free. */
export const stepSludge: Recipe = (v) => {
  noise(v, { filter: 'lowpass', freq: 500, freq1: 250, attack: 0.02, decay: 0.11, gain: 0.4 });
  tone(v, { type: 'sine', f0: 95, f1: 55, attack: 0.01, decay: 0.1, gain: 0.2 });
  noise(v, { at: 0.06, filter: 'bandpass', freq: 900, q: 4, attack: 0.004, decay: 0.04, gain: 0.1 });
};

/** Ash: a dry, soft scuff. */
export const stepAsh: Recipe = (v) => {
  noise(v, { filter: 'lowpass', freq: 2200, freq1: 900, attack: 0.008, decay: 0.08, gain: 0.2 });
};

/** A brute's or a boss's footfall: a heavy thud felt more than heard, with a little grit. */
export const stomp: Recipe = (v) => {
  tone(v, { type: 'sine', f0: 85, f1: 38, attack: 0.004, decay: 0.16, gain: 0.7, lp: 220 });
  noise(v, { filter: 'lowpass', freq: 600, freq1: 200, attack: 0.004, decay: 0.09, gain: 0.3 });
  noise(v, { at: 0.02, filter: 'bandpass', freq: 1500, q: 1.2, decay: 0.05, gain: 0.08 });
};
