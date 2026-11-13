import { noise, tone, type Recipe } from './voice-kit.ts';

export const uiClick: Recipe = (v) => {
  tone(v, { type: 'square', f0: 1400, f1: 900, decay: 0.03, gain: 0.2, lp: 4000 });
  noise(v, { filter: 'bandpass', freq: 3000, q: 2, decay: 0.012, gain: 0.15 });
};

export const uiHover: Recipe = (v) => {
  tone(v, { type: 'sine', f0: 1200, decay: 0.025, gain: 0.1 });
};

export const uiStart: Recipe = (v) => {
  noise(v, { filter: 'bandpass', freq: 400, freq1: 3000, q: 1, attack: 0.15, decay: 0.15, gain: 0.2 });
  tone(v, { type: 'square', f0: 220, f1: 440, decay: 0.25, gain: 0.18, lp: 2500 });
  tone(v, { at: 0.2, type: 'square', f0: 440, f1: 660, decay: 0.2, gain: 0.15, lp: 2500 });
};

export const uiPause: Recipe = (v) => {
  tone(v, { type: 'triangle', f0: 660, decay: 0.08, gain: 0.25 });
  tone(v, { at: 0.09, type: 'triangle', f0: 440, decay: 0.14, gain: 0.25 });
};

export const uiResume: Recipe = (v) => {
  tone(v, { type: 'triangle', f0: 440, decay: 0.08, gain: 0.25 });
  tone(v, { at: 0.09, type: 'triangle', f0: 660, decay: 0.14, gain: 0.25 });
};

/** The van pulling out of the bunker: a low engine climbing through a gear change. */
export const vanDepart: Recipe = (v) => {
  const trem = { rate: 18, depth: 0.5 };
  tone(v, { type: 'sawtooth', f0: 42, path: [[0.6, 56], [0.9, 47], [1.8, 72]], attack: 0.08, hold: 1.3, decay: 0.5, gain: 0.35, lp: 320, trem });
  tone(v, { type: 'square', f0: 84, path: [[0.6, 112], [0.9, 94], [1.8, 144]], attack: 0.08, hold: 1.3, decay: 0.5, gain: 0.12, lp: 500, trem });
  noise(v, { filter: 'lowpass', freq: 260, freq1: 600, attack: 0.1, hold: 1.2, decay: 0.6, gain: 0.25 });
};

/** The van coming home: the engine winding down and a dry brake as it stops. */
export const vanArrive: Recipe = (v) => {
  const trem = { rate: 16, depth: 0.5 };
  tone(v, { type: 'sawtooth', f0: 70, path: [[0.8, 52], [1.5, 38]], attack: 0.05, hold: 1.2, decay: 0.4, gain: 0.35, lp: 320, trem });
  tone(v, { type: 'square', f0: 140, path: [[0.8, 104], [1.5, 76]], attack: 0.05, hold: 1.2, decay: 0.4, gain: 0.12, lp: 500, trem });
  noise(v, { filter: 'lowpass', freq: 600, freq1: 220, attack: 0.05, hold: 1.0, decay: 0.5, gain: 0.25 });
  tone(v, { at: 1.1, type: 'triangle', f0: 1800, f1: 1500, attack: 0.05, decay: 0.3, gain: 0.04, lp: 3000 });
};

/** The van waiting at the edge of town: two flat honks on a cheap two-note horn. */
export const vanHorn: Recipe = (v) => {
  for (const at of [0, 0.32]) {
    tone(v, { at, type: 'sawtooth', f0: 330, attack: 0.01, hold: 0.18, decay: 0.06, gain: 0.2, lp: 1800 });
    tone(v, { at, type: 'sawtooth', f0: 415, attack: 0.01, hold: 0.18, decay: 0.06, gain: 0.16, lp: 1800 });
  }
};

/** The sliding door run along its rail and shut with a thunk. */
export const vanDoor: Recipe = (v) => {
  noise(v, { filter: 'bandpass', freq: 900, freq1: 500, q: 1.5, attack: 0.02, hold: 0.12, decay: 0.08, gain: 0.25 });
  tone(v, { at: 0.2, type: 'sine', f0: 110, f1: 55, decay: 0.18, gain: 0.6 });
  noise(v, { at: 0.2, filter: 'lowpass', freq: 400, decay: 0.12, gain: 0.5 });
  tone(v, { at: 0.2, type: 'square', f0: 220, f1: 140, decay: 0.05, gain: 0.12, lp: 900 });
};

/** Lifting an item out of a grid: a soft cloth slide with a small rising tick. */
export const uiPickup: Recipe = (v) => {
  tone(v, { type: 'triangle', f0: 520, f1: 760, decay: 0.05, gain: 0.18 });
  noise(v, { filter: 'bandpass', freq: 1800, q: 1.2, decay: 0.03, gain: 0.12 });
};

/** Setting an item down on the ground: a low thud with a rustle. */
export const uiDrop: Recipe = (v) => {
  tone(v, { type: 'sine', f0: 160, f1: 70, decay: 0.1, gain: 0.35 });
  noise(v, { filter: 'lowpass', freq: 900, decay: 0.08, gain: 0.2 });
};

/** Fitting an item into a grid cell: a short clack. */
export const uiPlace: Recipe = (v) => {
  tone(v, { type: 'square', f0: 900, f1: 600, decay: 0.025, gain: 0.14, lp: 3000 });
  noise(v, { filter: 'bandpass', freq: 2200, q: 2, decay: 0.02, gain: 0.14 });
};

/** Turning an item in the hand: a quick swish that rises. */
export const uiRotate: Recipe = (v) => {
  noise(v, { filter: 'bandpass', freq: 900, freq1: 2200, q: 1.2, attack: 0.01, decay: 0.07, gain: 0.14 });
  tone(v, { type: 'triangle', f0: 400, f1: 600, decay: 0.06, gain: 0.08 });
};
