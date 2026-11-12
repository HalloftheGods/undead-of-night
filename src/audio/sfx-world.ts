import { noise, tone, type Recipe } from './voice-kit.ts';

// Doors, boards and the party's emote chirp. Wood is told from metal by short,
// low, quickly damped partials; a door's life runs creak, thunk, bang, splinter.

/** A wooden door swung open: a click of the latch, then a long dry hinge creak. */
export const doorOpen: Recipe = (v) => {
  noise(v, { filter: 'bandpass', freq: 2500, q: 3, decay: 0.02, gain: 0.3 });
  tone(v, { type: 'square', f0: 900, decay: 0.015, gain: 0.08, lp: 3000 });
  tone(v, {
    at: 0.03, type: 'sawtooth', f0: 180, path: [[0.15, 320], [0.35, 260]], attack: 0.05, hold: 0.25, decay: 0.15, gain: 0.15,
    formants: [[900, 6, 1], [1800, 8, 0.5]], vib: { rate: 11, cents: 40 }, lp: 2500,
  });
};

/** A door pushed shut: air moving, the slab meeting the frame, the latch catching. */
export const doorClose: Recipe = (v) => {
  noise(v, { filter: 'lowpass', freq: 300, freq1: 700, attack: 0.08, decay: 0.08, gain: 0.15 });
  tone(v, { at: 0.14, type: 'sine', f0: 120, f1: 60, decay: 0.14, gain: 0.6 });
  noise(v, { at: 0.14, filter: 'lowpass', freq: 500, decay: 0.08, gain: 0.45 });
  noise(v, { at: 0.16, filter: 'bandpass', freq: 3000, q: 4, decay: 0.02, gain: 0.3 });
};

/** A board nailed across a door: three hammer blows, each nail sitting a little deeper. */
export const plankNail: Recipe = (v) => {
  [0, 0.16, 0.32].forEach((at, i) => {
    noise(v, { at, filter: 'bandpass', freq: 2200, q: 2, attack: 0.001, decay: 0.03, gain: 0.5 });
    tone(v, { at, type: 'triangle', f0: 420 + i * 30, f1: 300 + i * 30, decay: 0.06, gain: 0.3 });
    tone(v, { at, type: 'sine', f0: 160, f1: 90, decay: 0.08, gain: 0.35 });
  });
};

/** A board pried off: the nail squeals out of the wood, then the plank pops free. */
export const plankPry: Recipe = (v) => {
  tone(v, {
    type: 'sawtooth', f0: 500, f1: 1400, attack: 0.05, hold: 0.15, decay: 0.1, gain: 0.12,
    vib: { rate: 14, cents: 60 }, lp: 3500,
  });
  tone(v, { at: 0.1, type: 'square', f0: 2400, f1: 3200, attack: 0.02, decay: 0.12, gain: 0.05, lp: 5000 });
  noise(v, { at: 0.32, filter: 'highpass', freq: 1500, decay: 0.04, gain: 0.5 });
  tone(v, { at: 0.32, type: 'sine', f0: 200, f1: 80, decay: 0.1, gain: 0.4 });
};

/** Something heavy throwing itself at a door: a deep bang and the frame rattling in it. */
export const doorBang: Recipe = (v) => {
  tone(v, { type: 'sine', f0: 90, f1: 45, decay: 0.22, gain: 0.8 });
  noise(v, { filter: 'lowpass', freq: 700, decay: 0.12, gain: 0.6 });
  noise(v, { at: 0.03, filter: 'bandpass', freq: 1600, q: 3, decay: 0.15, gain: 0.15, trem: { rate: 30, depth: 0.8 } });
};

/** A door giving way: a crack, a crash, splinters flying and pieces landing after. */
export const doorBreak: Recipe = (v) => {
  noise(v, { filter: 'highpass', freq: 2000, attack: 0.001, decay: 0.08, gain: 0.7 });
  tone(v, { type: 'sine', f0: 100, f1: 35, decay: 0.35, gain: 0.8 });
  noise(v, { filter: 'lowpass', freq: 900, decay: 0.3, gain: 0.5, drive: 0.3 });
  for (let i = 0; i < 4; i += 1) {
    const at = 0.05 + i * 0.06 + v.rand() * 0.03;
    noise(v, { at, filter: 'bandpass', freq: 3000 + v.rand() * 2500, q: 3, decay: 0.04, gain: 0.25 });
  }
  for (const at of [0.35, 0.5]) {
    tone(v, { at, type: 'sine', f0: 160, f1: 70, decay: 0.08, gain: 0.3 });
    noise(v, { at, filter: 'lowpass', freq: 600, decay: 0.06, gain: 0.25 });
  }
};

/** The bunker fell and the horde drags back out: a falling minor line over a sub-bass and a receding moan. */
export const bunkerLost: Recipe = (v) => {
  [220, 174.6, 146.8].forEach((f0, i) => {
    tone(v, { at: i * 0.35, type: 'triangle', f0, decay: 0.6, gain: 0.25, lp: 1800 });
  });
  tone(v, { type: 'sine', f0: 55, attack: 0.3, hold: 0.8, decay: 0.8, gain: 0.4 });
  tone(v, {
    type: 'sawtooth', f0: 140, f1: 90, attack: 0.4, hold: 0.6, decay: 0.6, gain: 0.1, lp: 600,
    formants: [[500, 5, 1], [900, 6, 0.5]],
  });
};

/** A survivor's emote: a soft pop and a rising note. Pitch tells one emote from another. */
export const emote: Recipe = (v) => {
  tone(v, { type: 'sine', f0: 880, f1: 1320, decay: 0.05, gain: 0.2 });
  tone(v, { at: 0.07, type: 'triangle', f0: 1320, decay: 0.12, gain: 0.18 });
};
