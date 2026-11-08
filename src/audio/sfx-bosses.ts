import { noise, tone, type Recipe } from './voice-kit.ts';

// Boss nights. A boss arrives far out in the dark, so its arrival is a stinger everyone hears,
// and each boss's trick has its own call so a player can tell what is coming without looking.

/** Something big is in town: a sub hit, a dissonant low swell opening up, a thin high whine over it. */
export const bossArrive: Recipe = (v) => {
  tone(v, { type: 'sine', f0: 55, f1: 30, decay: 0.9, gain: 0.8, lp: 160 });
  noise(v, { filter: 'lowpass', freq: 1400, freq1: 120, decay: 0.7, gain: 0.45, drive: 0.4 });
  for (const [f0, detune] of [[73.42, -8], [77.78, 6], [110, 0]] as const) {
    tone(v, {
      at: 0.05, type: 'sawtooth', f0, detune, attack: 0.5, hold: 0.8, decay: 1.0, release: 0.2, gain: 0.18,
      lp: 900, drive: 0.3,
    });
  }
  tone(v, { at: 0.1, type: 'sine', f0: 3520, f1: 3300, attack: 0.3, hold: 0.6, decay: 1.0, gain: 0.02 });
};

/** The Howler calling the town: a long rising wail, doubled and rough, that peaks and drops. */
export const howl: Recipe = (v) => {
  const formants = [[700, 5, 1], [1900, 7, 0.7]] as const;
  tone(v, {
    type: 'sawtooth', f0: 220, path: [[0.5, 520], [1.2, 640], [1.7, 300]], attack: 0.1, hold: 1.0, decay: 0.6,
    release: 0.2, gain: 0.4, formants, vib: { rate: 9, cents: 120 },
  });
  tone(v, {
    type: 'sawtooth', f0: 223, path: [[0.5, 527], [1.2, 648], [1.7, 296]], attack: 0.12, hold: 1.0, decay: 0.6,
    release: 0.2, gain: 0.25, formants, drive: 0.4, vib: { rate: 13, cents: 160 },
  });
  noise(v, { filter: 'bandpass', freq: 1500, q: 0.8, attack: 0.15, hold: 0.9, decay: 0.6, gain: 0.08 });
};

/** Mother giving birth: a wet tear, a run of squelches, and a small new groan at the end. */
export const brood: Recipe = (v) => {
  noise(v, { filter: 'bandpass', freq: 300, freq1: 900, q: 2, attack: 0.08, decay: 0.35, gain: 0.5, drive: 0.3 });
  tone(v, { type: 'sawtooth', f0: 60, f1: 45, attack: 0.05, decay: 0.5, gain: 0.35, lp: 400, vib: { rate: 12, cents: 400 } });
  for (let i = 0; i < 4; i += 1) {
    noise(v, { at: 0.25 + i * 0.11 + v.rand() * 0.04, filter: 'bandpass', freq: 220 + v.rand() * 260, q: 6, decay: 0.08, gain: 0.35 });
  }
  tone(v, {
    at: 0.55, type: 'sawtooth', f0: 140, f1: 95, attack: 0.04, decay: 0.35, gain: 0.25,
    formants: [[600, 5, 1], [1050, 7, 0.5]], vib: { rate: 6, cents: 40 },
  });
};

/** The Butcher charging: a bellow that climbs, a rumble under it and the first heavy strides. */
export const charge: Recipe = (v) => {
  const formants = [[320, 4, 1], [750, 5, 0.7]] as const;
  tone(v, {
    type: 'sawtooth', f0: 55, f1: 110, attack: 0.05, hold: 0.35, decay: 0.45, release: 0.1, gain: 0.55,
    formants, drive: 0.7, vib: { rate: 26, cents: 140 },
  });
  noise(v, { filter: 'lowpass', freq: 220, attack: 0.1, hold: 0.6, decay: 0.4, gain: 0.4 });
  for (let i = 0; i < 4; i += 1) tone(v, { at: 0.15 + i * 0.22, type: 'sine', f0: 70, f1: 32, decay: 0.12, gain: 0.5 });
};
