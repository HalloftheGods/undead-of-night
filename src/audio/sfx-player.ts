import { noise, tone, type Recipe, type Voice } from './voice-kit.ts';

export const playerHurt: Recipe = (v) => {
  tone(v, {
    type: 'sawtooth', f0: 230, f1: 140, attack: 0.01, decay: 0.14, gain: 0.5,
    formants: [[700, 5, 1], [1150, 6, 0.6]], vib: { rate: 9, cents: 30 },
  });
  noise(v, { filter: 'lowpass', freq: 900, decay: 0.06, gain: 0.35 });
};

export const playerDowned: Recipe = (v) => {
  tone(v, {
    type: 'sawtooth', f0: 210, f1: 62, attack: 0.04, decay: 0.8, gain: 0.5,
    formants: [[650, 5, 1], [1100, 6, 0.5]], vib: { rate: 5, cents: 50 },
  });
  noise(v, { at: 0.5, filter: 'lowpass', freq: 420, decay: 0.15, gain: 0.45 });
  tone(v, { at: 0.5, type: 'sine', f0: 80, f1: 38, decay: 0.2, gain: 0.55 });
  tone(v, { type: 'sine', f0: 3000, decay: 0.6, attack: 0.05, gain: 0.04 });
};

export const revive: Recipe = (v) => {
  noise(v, { filter: 'bandpass', freq: 800, freq1: 2500, q: 1, attack: 0.08, decay: 0.2, gain: 0.2 });
  [440, 659.3, 880].forEach((f, i) => {
    tone(v, { at: 0.22 + i * 0.1, type: 'triangle', f0: f, decay: 0.35, gain: 0.25 });
  });
};

export const heartbeat: Recipe = (v) => {
  tone(v, { type: 'sine', f0: 62, f1: 40, decay: 0.12, gain: 0.8, lp: 140 });
  tone(v, { at: 0.19, type: 'sine', f0: 56, f1: 38, decay: 0.1, gain: 0.55, lp: 130 });
};

const chime = (v: Voice, notes: number[], step: number, type: OscillatorType, gain: number, decay: number): void => {
  notes.forEach((f, i) => tone(v, { at: i * step, type, f0: f, decay, gain }));
};

export const pickupMedkit: Recipe = (v) => {
  chime(v, [523.3, 659.3, 784], 0.07, 'triangle', 0.28, 0.3);
  tone(v, { type: 'sine', f0: 1046.5, attack: 0.02, decay: 0.45, gain: 0.1, at: 0.14 });
};

export const pickupAmmo: Recipe = (v) => {
  for (let i = 0; i < 3; i++) noise(v, { at: i * 0.045, filter: 'bandpass', freq: 3800 + i * 400, q: 4, decay: 0.025, gain: 0.3 });
  tone(v, { at: 0.12, type: 'triangle', f0: 1200, f1: 600, decay: 0.05, gain: 0.2 });
};

export const pickupWeapon: Recipe = (v) => {
  noise(v, { filter: 'lowpass', freq: 600, decay: 0.07, gain: 0.45 });
  tone(v, { type: 'sine', f0: 150, f1: 70, decay: 0.1, gain: 0.4 });
  chime(v, [293.7, 440, 587.3, 698.5], 0.07, 'square', 0.12, 0.2);
};

/** Distant air-raid wail: slow swells up and down, muffled, over a sub-bass dread. */
export const waveStart: Recipe = (v) => {
  tone(v, {
    type: 'sawtooth', f0: 300, lp: 900, attack: 0.5, hold: 3.2, decay: 0.8, release: 0.3, gain: 0.3,
    path: [[0.9, 620], [1.9, 330], [2.9, 640], [3.9, 310]],
  });
  tone(v, {
    type: 'square', f0: 301, lp: 700, attack: 0.6, hold: 3.0, decay: 0.8, release: 0.3, gain: 0.1,
    path: [[0.9, 623], [1.9, 332], [2.9, 643], [3.9, 312]],
  });
  tone(v, { type: 'sine', f0: 48, f1: 36, attack: 0.3, hold: 1.5, decay: 2.4, gain: 0.55, lp: 160 });
  noise(v, { filter: 'lowpass', freq: 300, freq1: 120, attack: 0.5, decay: 3, gain: 0.15 });
};

/**
 * Ten seconds before a horde: war drums closing in, quickening to a heavy last hit, under a far-off siren
 * only starting to wind up. Told apart from wave_start's full wail, which marks the horde itself.
 */
export const hordeWarning: Recipe = (v) => {
  const hits = [0, 0.62, 1.12, 1.5, 1.8, 2.04, 2.24];
  hits.forEach((at, i) => {
    const last = i === hits.length - 1;
    const swell = 0.35 + (0.4 * i) / (hits.length - 1);
    tone(v, { at, type: 'sine', f0: 96, f1: 44, attack: 0.004, decay: last ? 0.9 : 0.38, gain: last ? 0.85 : swell, lp: 320 });
    noise(v, { at, filter: 'lowpass', freq: 520, attack: 0.002, decay: 0.07, gain: swell * 0.45 });
  });
  tone(v, { type: 'sawtooth', f0: 200, path: [[2.6, 470]], attack: 1.2, hold: 1.0, decay: 0.9, gain: 0.07, lp: 650 });
};

export const meleeSwing: Recipe = (v) => {
  noise(v, { filter: 'bandpass', freq: 500, freq1: 2200, q: 1.2, attack: 0.02, decay: 0.09, gain: 0.3 });
};

export const meleeThud: Recipe = (v) => {
  noise(v, { filter: 'bandpass', freq: 500, freq1: 2200, q: 1.2, attack: 0.02, decay: 0.09, gain: 0.25 });
  tone(v, { at: 0.07, type: 'sine', f0: 140, f1: 55, decay: 0.14, gain: 0.7, lp: 300 });
  noise(v, { at: 0.07, filter: 'lowpass', freq: 700, decay: 0.07, gain: 0.4 });
};

export const heal: Recipe = (v) => {
  noise(v, { filter: 'bandpass', freq: 1800, q: 0.8, attack: 0.03, decay: 0.12, gain: 0.12 });
  tone(v, { at: 0.08, type: 'sine', f0: 330, f1: 660, attack: 0.04, decay: 0.45, gain: 0.22 });
  tone(v, { at: 0.2, type: 'triangle', f0: 660, f1: 990, attack: 0.04, decay: 0.4, gain: 0.12 });
};

export const pickupBandage: Recipe = (v) => {
  noise(v, { filter: 'bandpass', freq: 2400, freq1: 1200, q: 0.7, attack: 0.04, decay: 0.2, gain: 0.22 });
  noise(v, { at: 0.14, filter: 'bandpass', freq: 1500, q: 0.9, attack: 0.02, decay: 0.1, gain: 0.14 });
};

/** Heavier than the old chime: a clatter of brass with a dull thump underneath. */
const rattle = (v: Voice, count: number, base: number, lowHz: number): void => {
  tone(v, { type: 'sine', f0: lowHz, f1: lowHz * 0.5, decay: 0.08, gain: 0.5, lp: 260 });
  for (let i = 0; i < count; i++) {
    noise(v, { at: 0.03 + i * 0.05, filter: 'bandpass', freq: base + (i % 3) * 500, q: 3, decay: 0.04, gain: 0.3 });
    tone(v, { at: 0.03 + i * 0.05, type: 'triangle', f0: base * 0.7 + i * 90, f1: base * 0.4, decay: 0.05, gain: 0.1 });
  }
};

export const pickupPistolAmmo: Recipe = (v) => rattle(v, 4, 3200, 120);
export const pickupCarbineAmmo: Recipe = (v) => rattle(v, 6, 2800, 100);
export const pickupShells: Recipe = (v) => {
  rattle(v, 3, 1800, 80);
  noise(v, { at: 0.2, filter: 'lowpass', freq: 500, decay: 0.08, gain: 0.35 });
};

/** A cut stone lifted out of the dirt: one glassy note with a quick shimmer over it. */
export const pickupJewel: Recipe = (v) => {
  chime(v, [1318.5, 1760], 0.06, 'sine', 0.2, 0.28);
  tone(v, { at: 0.12, type: 'triangle', f0: 2637, f1: 2700, attack: 0.01, decay: 0.3, gain: 0.07 });
};

/** The same stone, bigger: a lower note under a slower, fuller shimmer. */
export const pickupJewelLarge: Recipe = (v) => {
  tone(v, { type: 'sine', f0: 392, f1: 392, attack: 0.01, decay: 0.45, gain: 0.22 });
  chime(v, [783.99, 1174.7, 1568], 0.08, 'sine', 0.18, 0.4);
  tone(v, { at: 0.24, type: 'triangle', f0: 3136, f1: 3200, attack: 0.02, decay: 0.45, gain: 0.07 });
};

/** A gun part or kit going into the bag: a dull thump and a few hard steel clinks, no chime. */
export const pickupPart: Recipe = (v) => {
  tone(v, { type: 'sine', f0: 180, f1: 90, decay: 0.08, gain: 0.4, lp: 400 });
  [0, 0.06, 0.13].forEach((at, i) => {
    tone(v, { at, type: 'square', f0: 620 - i * 90, f1: 480 - i * 70, decay: 0.07, gain: 0.1, lp: 2400 });
    noise(v, { at, filter: 'bandpass', freq: 2200 + i * 300, q: 5, decay: 0.05, gain: 0.25 });
  });
};

/** A candy: the wrapper crinkling, two crunches, and a small bright lift as the sugar hits. */
export const candyCrunch: Recipe = (v) => {
  for (let i = 0; i < 5; i += 1) {
    noise(v, { at: i * 0.03 + v.rand() * 0.015, filter: 'highpass', freq: 5000 + v.rand() * 2000, decay: 0.015, gain: 0.25 });
  }
  noise(v, { at: 0.2, filter: 'bandpass', freq: 1800, q: 1.5, decay: 0.05, gain: 0.45 });
  noise(v, { at: 0.27, filter: 'bandpass', freq: 1400, q: 1.5, decay: 0.05, gain: 0.35 });
  tone(v, { at: 0.36, type: 'triangle', f0: 880, f1: 1320, attack: 0.02, decay: 0.2, gain: 0.12 });
};

/** A keepsake chosen: a slow music-box rise, warm rather than bright, for something kept the whole run. */
export const keepsake: Recipe = (v) => {
  chime(v, [392, 493.9, 587.3, 784], 0.11, 'sine', 0.22, 0.6);
  tone(v, { at: 0.33, type: 'triangle', f0: 1568, attack: 0.02, decay: 0.7, gain: 0.06 });
};

/** A supply crate landing: a heavy thump, the boards giving, and the crate settling. */
export const crateLand: Recipe = (v) => {
  tone(v, { type: 'sine', f0: 95, f1: 38, decay: 0.3, gain: 0.9 });
  noise(v, { filter: 'lowpass', freq: 900, freq1: 160, decay: 0.25, gain: 0.6 });
  noise(v, { at: 0.08, filter: 'bandpass', freq: 650, q: 4, decay: 0.12, gain: 0.25 });
  tone(v, { at: 0.18, type: 'triangle', f0: 210, f1: 170, attack: 0.03, decay: 0.2, gain: 0.12, vib: { rate: 18, cents: 60 } });
};

/** A door or drawer coming open. */
export const containerOpen: Recipe = (v) => {
  noise(v, { filter: 'bandpass', freq: 700, freq1: 1100, q: 2, attack: 0.02, decay: 0.12, gain: 0.3 });
  tone(v, { at: 0.1, type: 'triangle', f0: 240, f1: 170, decay: 0.05, gain: 0.25 });
};

/** A radio coming on in your hands: a burst of static, then a thin tone sliding into tune. */
export const pickupRadio: Recipe = (v) => {
  noise(v, { filter: 'bandpass', freq: 1800, freq1: 3200, q: 1.5, attack: 0.01, decay: 0.22, gain: 0.35 });
  tone(v, { at: 0.12, type: 'sine', f0: 620, f1: 880, attack: 0.02, decay: 0.2, gain: 0.25 });
  tone(v, { at: 0.3, type: 'triangle', f0: 880, f1: 880, attack: 0.02, decay: 0.3, gain: 0.2 });
};

/** Things coming off a shelf and hitting the floor, loud enough to be worth flinching at. */
export const clatter: Recipe = (v) => {
  [0, 0.07, 0.11, 0.2, 0.26, 0.38].forEach((at, i) => {
    noise(v, { at, filter: 'bandpass', freq: 2600 - i * 240, q: 3, decay: 0.05, gain: 0.5 });
    tone(v, { at, type: 'triangle', f0: 1500 - i * 150, f1: 900 - i * 90, decay: 0.05, gain: 0.2 });
  });
  noise(v, { at: 0.02, filter: 'lowpass', freq: 500, decay: 0.12, gain: 0.5 });
};

export const waveClear: Recipe = (v) => {
  [220, 277.2, 329.6, 440].forEach((f, i) => {
    tone(v, { at: i * 0.16, type: 'sawtooth', f0: f, lp: 1800, attack: 0.02, decay: 0.7, gain: 0.2 });
    tone(v, { at: i * 0.16, type: 'sine', f0: f * 2, decay: 0.9, gain: 0.1 });
  });
  tone(v, { at: 0.64, type: 'sawtooth', f0: 110, lp: 600, decay: 1.0, gain: 0.3 });
};

/** The van left the last town: a rising D major run that opens onto a held chord, the defeat's answer. */
export const runVictory: Recipe = (v) => {
  const run = [293.7, 370, 440, 587.3];
  run.forEach((f, i) => {
    tone(v, { at: i * 0.2, type: 'sawtooth', f0: f, lp: 2200, attack: 0.02, decay: 0.6, gain: 0.18 });
    tone(v, { at: i * 0.2, type: 'sine', f0: f * 2, decay: 0.7, gain: 0.08 });
  });
  for (const f of run) tone(v, { at: 0.8, type: 'triangle', f0: f, attack: 0.05, hold: 0.6, decay: 1.2, gain: 0.12 });
  tone(v, { at: 0.8, type: 'sine', f0: 73.4, attack: 0.05, hold: 0.4, decay: 1.4, gain: 0.4 });
};

/** Slow, dark descent that settles onto a low D. */
export const gameOver: Recipe = (v) => {
  [293.7, 261.6, 233.1, 196].forEach((f, i) => {
    tone(v, { at: i * 0.6, type: 'sawtooth', f0: f, lp: 900, attack: 0.04, decay: 0.7, gain: 0.3, vib: { rate: 5, cents: 15 } });
    tone(v, { at: i * 0.6, type: 'sine', f0: f / 2, decay: 0.8, gain: 0.25 });
  });
  tone(v, { at: 2.4, type: 'sine', f0: 73.4, attack: 0.05, decay: 1.5, gain: 0.55 });
  tone(v, { at: 2.4, type: 'sawtooth', f0: 73.4, lp: 200, attack: 0.05, decay: 1.5, gain: 0.3 });
  noise(v, { at: 2.4, filter: 'lowpass', freq: 400, freq1: 100, decay: 1.4, gain: 0.2 });
};
