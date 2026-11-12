import { noise, tone, type Recipe } from './voice-kit.ts';

// Cars: a door shut, a horn, sheet metal meeting something, a body on a bumper.

/** A car door: a latch click and the dull thunk of a heavy panel closing. */
export const vehicleDoor: Recipe = (v) => {
  noise(v, { filter: 'bandpass', freq: 2200, q: 4, decay: 0.02, gain: 0.25 });
  tone(v, { at: 0.02, type: 'sine', f0: 110, f1: 55, decay: 0.16, gain: 0.7 });
  noise(v, { at: 0.02, filter: 'lowpass', freq: 600, decay: 0.1, gain: 0.45 });
};

/** A car horn: two close notes and a third above them held together, loud and a little nasal, with a hard blare on the front. */
export const carHorn: Recipe = (v) => {
  noise(v, { filter: 'bandpass', freq: 1800, q: 2, decay: 0.03, gain: 0.25 });
  tone(v, { type: 'sawtooth', f0: 392, attack: 0.008, hold: 0.42, decay: 0.12, gain: 0.5, lp: 2600 });
  tone(v, { type: 'sawtooth', f0: 494, attack: 0.008, hold: 0.42, decay: 0.12, gain: 0.42, lp: 2600 });
  tone(v, { type: 'square', f0: 784, attack: 0.008, hold: 0.42, decay: 0.12, gain: 0.1, lp: 2400 });
};

/** Metal against something solid: a hard bang, a crunch of noise and a ring of sheet metal. */
export const carCrash: Recipe = (v) => {
  tone(v, { type: 'sine', f0: 80, f1: 35, decay: 0.3, gain: 0.9 });
  noise(v, { filter: 'lowpass', freq: 1400, freq1: 300, decay: 0.28, gain: 0.7 });
  noise(v, { at: 0.02, filter: 'bandpass', freq: 3200, q: 5, decay: 0.2, gain: 0.25 });
  tone(v, { at: 0.03, type: 'square', f0: 640, f1: 480, decay: 0.25, gain: 0.07, lp: 2400 });
};

/** A body on a bumper: a short, wet thump. */
export const carHit: Recipe = (v) => {
  tone(v, { type: 'sine', f0: 120, f1: 50, decay: 0.14, gain: 0.8 });
  noise(v, { filter: 'lowpass', freq: 500, decay: 0.09, gain: 0.6 });
};
