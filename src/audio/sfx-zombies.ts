import { noise, tone, type Recipe } from './voice-kit.ts';

export const fleshHit: Recipe = (v) => {
  noise(v, { filter: 'lowpass', freq: 1000, freq1: 400, decay: 0.07, gain: 0.6 });
  tone(v, { type: 'sine', f0: 150, f1: 55, decay: 0.1, gain: 0.5 });
  noise(v, { at: 0.02, filter: 'bandpass', freq: 450, freq1: 220, q: 4, decay: 0.12, gain: 0.25 });
};

/** A sharp crack of bone with a wet pop behind it, so it reads over the plain flesh hit. */
export const headshot: Recipe = (v) => {
  noise(v, { filter: 'highpass', freq: 2400, decay: 0.03, gain: 0.7 });
  tone(v, { type: 'square', f0: 950, f1: 200, decay: 0.05, gain: 0.3 });
  noise(v, { at: 0.02, filter: 'bandpass', freq: 750, freq1: 260, q: 3, decay: 0.14, gain: 0.5 });
  tone(v, { at: 0.03, type: 'sine', f0: 125, f1: 45, decay: 0.12, gain: 0.4 });
};

export const claw: Recipe = (v) => {
  noise(v, { filter: 'bandpass', freq: 800, freq1: 3200, q: 1, attack: 0.05, decay: 0.1, gain: 0.3 });
  noise(v, { at: 0.07, filter: 'highpass', freq: 2500, decay: 0.07, gain: 0.2 });
  noise(v, { at: 0.12, filter: 'bandpass', freq: 1400, q: 2, decay: 0.05, gain: 0.12 });
};

const fall = (at: number, gain: number): Recipe => (v) => {
  noise(v, { at, filter: 'lowpass', freq: 420, decay: 0.1, gain });
  tone(v, { at, type: 'sine', f0: 90, f1: 40, decay: 0.12, gain: gain * 0.8 });
};

export const dieWalker: Recipe = (v) => {
  tone(v, {
    type: 'sawtooth', f0: 160, f1: 55, attack: 0.03, decay: 0.5, gain: 0.5,
    formants: [[550, 5, 1.1], [1000, 6, 0.6]], vib: { rate: 6, cents: 40 },
  });
  noise(v, { filter: 'bandpass', freq: 900, q: 1, attack: 0.05, decay: 0.4, gain: 0.07 });
  fall(0.38, 0.4)(v);
};

export const dieRunner: Recipe = (v) => {
  tone(v, {
    type: 'sawtooth', f0: 720, f1: 190, attack: 0.01, decay: 0.34, gain: 0.5,
    formants: [[1000, 6, 1], [2500, 8, 0.6]], vib: { rate: 28, cents: 90 },
  });
  noise(v, { filter: 'highpass', freq: 2500, decay: 0.25, gain: 0.07 });
  fall(0.3, 0.3)(v);
};

export const dieBloater: Recipe = (v) => {
  tone(v, {
    type: 'sawtooth', f0: 95, f1: 42, attack: 0.04, decay: 0.8, gain: 0.5, lp: 520,
    vib: { rate: 14, cents: 300 }, trem: { rate: 9, depth: 0.6 },
  });
  for (let i = 0; i < 5; i++) {
    noise(v, { at: 0.1 + i * 0.14 + v.rand() * 0.05, filter: 'bandpass', freq: 260 + v.rand() * 200, q: 5, decay: 0.07, gain: 0.3 });
  }
  fall(0.75, 0.5)(v);
};

export const dieBrute: Recipe = (v) => {
  tone(v, {
    type: 'sawtooth', f0: 75, f1: 32, attack: 0.05, decay: 0.85, gain: 0.55, lp: 450,
    drive: 0.5, vib: { rate: 22, cents: 100 },
  });
  noise(v, { filter: 'lowpass', freq: 300, decay: 0.8, gain: 0.25, attack: 0.05 });
  tone(v, { at: 0.6, type: 'sine', f0: 70, f1: 28, decay: 0.3, gain: 0.8 });
  noise(v, { at: 0.6, filter: 'lowpass', freq: 250, decay: 0.2, gain: 0.5 });
};

export const groanWalker: Recipe = (v) => {
  tone(v, {
    type: 'sawtooth', f0: 105, f1: 82, attack: 0.15, hold: 0.25, decay: 0.45, release: 0.25, gain: 0.45,
    formants: [[600, 5, 1.1], [1050, 7, 0.5]], vib: { rate: 5, cents: 35 },
  });
  noise(v, { filter: 'bandpass', freq: 800, q: 1.5, attack: 0.15, decay: 0.6, gain: 0.04 });
};

export const shriekRunner: Recipe = (v) => {
  const formants = [[1100, 6, 1], [2600, 8, 0.7]] as const;
  tone(v, { type: 'sawtooth', f0: 600, f1: 1500, attack: 0.03, decay: 0.2, release: 0.05, gain: 0.35, formants, vib: { rate: 30, cents: 80 } });
  tone(v, { at: 0.22, type: 'sawtooth', f0: 1500, f1: 720, attack: 0.03, decay: 0.28, gain: 0.35, formants, vib: { rate: 30, cents: 80 } });
  noise(v, { filter: 'highpass', freq: 3000, attack: 0.05, decay: 0.4, gain: 0.06 });
};

export const gurgleBloater: Recipe = (v) => {
  tone(v, {
    type: 'sawtooth', f0: 72, f1: 60, attack: 0.1, hold: 0.3, decay: 0.5, release: 0.2, gain: 0.5, lp: 480,
    vib: { rate: 12, cents: 500 }, trem: { rate: 7, depth: 0.7 },
  });
  noise(v, { filter: 'bandpass', freq: 320, q: 6, attack: 0.1, hold: 0.3, decay: 0.5, gain: 0.3, trem: { rate: 11, depth: 0.9 } });
};

/** Short snarls for the moment a zombie notices you: sharper than the idle voices. */
export const alertWalker: Recipe = (v) => {
  tone(v, {
    type: 'sawtooth', f0: 110, f1: 190, attack: 0.04, hold: 0.1, decay: 0.3, release: 0.1, gain: 0.45,
    formants: [[600, 5, 1], [1050, 6, 0.6]], vib: { rate: 14, cents: 90 },
  });
  noise(v, { filter: 'bandpass', freq: 1200, q: 1.5, attack: 0.03, decay: 0.3, gain: 0.1 });
};

export const alertRunner: Recipe = (v) => {
  tone(v, {
    type: 'sawtooth', f0: 520, f1: 1100, attack: 0.02, decay: 0.25, release: 0.08, gain: 0.35,
    formants: [[1100, 6, 1], [2600, 8, 0.7]], vib: { rate: 34, cents: 110 },
  });
  noise(v, { filter: 'highpass', freq: 2800, attack: 0.02, decay: 0.3, gain: 0.08 });
};

export const alertBloater: Recipe = (v) => {
  tone(v, {
    type: 'sawtooth', f0: 64, f1: 82, attack: 0.08, hold: 0.2, decay: 0.35, release: 0.15, gain: 0.5, lp: 460,
    vib: { rate: 10, cents: 400 }, trem: { rate: 8, depth: 0.7 },
  });
  noise(v, { filter: 'bandpass', freq: 300, q: 6, attack: 0.08, hold: 0.2, decay: 0.35, gain: 0.25, trem: { rate: 10, depth: 0.9 } });
};

export const alertBrute: Recipe = (v) => {
  const formants = [[320, 4, 1], [750, 5, 0.7]] as const;
  tone(v, { type: 'sawtooth', f0: 60, f1: 95, attack: 0.1, hold: 0.25, decay: 0.55, release: 0.15, gain: 0.5, formants, drive: 0.5, vib: { rate: 22, cents: 110 } });
  noise(v, { filter: 'bandpass', freq: 450, q: 0.8, attack: 0.1, hold: 0.25, decay: 0.55, gain: 0.1, drive: 0.4 });
};

export const roarBrute: Recipe = (v) => {
  const formants = [[320, 4, 1], [750, 5, 0.7], [1300, 6, 0.3]] as const;
  tone(v, { type: 'sawtooth', f0: 85, f1: 58, attack: 0.08, hold: 0.3, decay: 0.7, release: 0.15, gain: 0.5, formants, drive: 0.6, vib: { rate: 25, cents: 120 } });
  tone(v, { type: 'sawtooth', f0: 88, f1: 60, attack: 0.08, hold: 0.3, decay: 0.7, release: 0.15, gain: 0.3, formants, drive: 0.6, vib: { rate: 19, cents: 100 } });
  noise(v, { filter: 'bandpass', freq: 500, q: 0.8, attack: 0.1, hold: 0.3, decay: 0.7, gain: 0.12, drive: 0.5 });
};

export const bloaterBurst: Recipe = (v) => {
  noise(v, { filter: 'lowpass', freq: 1800, freq1: 200, decay: 0.35, gain: 0.6, drive: 0.4 });
  tone(v, { type: 'sine', f0: 100, f1: 30, decay: 0.35, gain: 0.7 });
  for (let i = 0; i < 7; i++) {
    noise(v, { at: 0.05 + v.rand() * 0.4, filter: 'bandpass', freq: 500 + v.rand() * 1500, q: 3, decay: 0.05, gain: 0.18 });
  }
  noise(v, { at: 0.1, filter: 'lowpass', freq: 500, decay: 0.45, gain: 0.15 });
};

/** Quiet, dull sounds for the ambience layer. */
export const distantGroan: Recipe = (v) => {
  tone(v, {
    type: 'sawtooth', f0: 90, f1: 70, attack: 0.3, hold: 0.4, decay: 0.7, release: 0.4, gain: 0.35, lp: 500,
    formants: [[500, 4, 1]], vib: { rate: 4, cents: 40 },
  });
};

export const distantCrash: Recipe = (v) => {
  noise(v, { filter: 'lowpass', freq: 900, freq1: 150, decay: 0.5, gain: 0.5 });
  tone(v, { type: 'sine', f0: 80, f1: 35, decay: 0.4, gain: 0.5 });
  noise(v, { at: 0.12, filter: 'bandpass', freq: 1800, q: 4, decay: 0.3, gain: 0.08 });
};

/** The screamer's call: a long rising wail that cracks at the top, meant to carry. */
export const scream: Recipe = (v) => {
  const formants = [[900, 5, 1], [2400, 7, 0.8]] as const;
  tone(v, { type: 'sawtooth', f0: 380, f1: 1250, attack: 0.05, hold: 0.45, decay: 0.5, release: 0.2, gain: 0.4, formants, vib: { rate: 22, cents: 140 } });
  tone(v, { at: 0.5, type: 'square', f0: 1250, f1: 900, attack: 0.02, decay: 0.4, gain: 0.15, lp: 3000, vib: { rate: 40, cents: 200 } });
  noise(v, { filter: 'highpass', freq: 2200, attack: 0.05, hold: 0.4, decay: 0.5, gain: 0.08 });
};

/** A zombie putting its nose to a trail: three short wet snuffs, then a low interested grunt. */
export const sniff: Recipe = (v) => {
  for (let i = 0; i < 3; i++) {
    noise(v, { at: i * 0.13, filter: 'bandpass', freq: 1500 + i * 180, q: 3, attack: 0.02, decay: 0.07, gain: 0.45 });
  }
  tone(v, {
    at: 0.42, type: 'sawtooth', f0: 95, f1: 75, attack: 0.05, decay: 0.3, gain: 0.3, lp: 600,
    formants: [[550, 5, 1]], vib: { rate: 5, cents: 30 },
  });
};

/** A boss hitting the ground for good: a long dying bellow, then the body landing, then the street settling. */
export const bossFall: Recipe = (v) => {
  tone(v, {
    type: 'sawtooth', f0: 60, f1: 24, attack: 0.03, decay: 1.1, gain: 0.5, lp: 380,
    drive: 0.6, vib: { rate: 14, cents: 140 },
  });
  tone(v, { at: 0.75, type: 'sine', f0: 58, f1: 22, decay: 0.55, gain: 1 });
  noise(v, { at: 0.75, filter: 'lowpass', freq: 420, freq1: 120, decay: 0.6, gain: 0.6 });
  noise(v, { at: 0.8, filter: 'bandpass', freq: 1800, q: 0.8, decay: 0.4, gain: 0.12 });
};
