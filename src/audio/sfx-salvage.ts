import { noise, tone, type Recipe } from './voice-kit.ts';

// Salvage, supplies and candy picked up into the bag. Each sounds like what it is
// (sloshing fuel, rattling pills, a crinkled wrapper); food and water end on a short
// chime, as the medkit does, so a player hears that it heals.

/** A fuel can lifted: a tonk of tin and the petrol sloshing inside. */
export const pickupFuel: Recipe = (v) => {
  tone(v, { type: 'triangle', f0: 520, decay: 0.06, gain: 0.2 });
  noise(v, { filter: 'lowpass', freq: 500, freq1: 900, attack: 0.04, hold: 0.1, decay: 0.15, gain: 0.35, trem: { rate: 7, depth: 0.8 } });
  noise(v, { at: 0.2, filter: 'lowpass', freq: 700, freq1: 400, decay: 0.12, gain: 0.25 });
};

/** A car battery: a heavy plastic clunk and a brief buzz off its terminals. */
export const pickupBattery: Recipe = (v) => {
  tone(v, { type: 'sine', f0: 110, f1: 60, decay: 0.12, gain: 0.5 });
  noise(v, { filter: 'lowpass', freq: 400, decay: 0.06, gain: 0.4 });
  tone(v, { at: 0.08, type: 'square', f0: 120, hold: 0.08, decay: 0.06, gain: 0.06, lp: 2400, trem: { rate: 60, depth: 0.6 } });
  noise(v, { at: 0.08, filter: 'highpass', freq: 5000, decay: 0.05, gain: 0.12 });
};

/** Scrap steel: two clanks of loose metal with an inharmonic ring. */
export const pickupMetal: Recipe = (v) => {
  noise(v, { filter: 'bandpass', freq: 2500, q: 2, decay: 0.03, gain: 0.35 });
  tone(v, { type: 'sine', f0: 640, decay: 0.25, gain: 0.12 });
  tone(v, { type: 'sine', f0: 1030, decay: 0.2, gain: 0.1 });
  tone(v, { type: 'sine', f0: 1720, decay: 0.15, gain: 0.08 });
  tone(v, { at: 0.09, type: 'sine', f0: 830, decay: 0.15, gain: 0.06 });
  tone(v, { at: 0.09, type: 'sine', f0: 1390, decay: 0.15, gain: 0.06 });
};

/** A hand tool (hammer, crowbar): a solid weight in the hand and a ring of forged steel. */
export const pickupTool: Recipe = (v) => {
  noise(v, { filter: 'lowpass', freq: 700, decay: 0.06, gain: 0.45 });
  tone(v, { type: 'sine', f0: 140, f1: 75, decay: 0.1, gain: 0.4 });
  tone(v, { type: 'sine', f0: 980, decay: 0.35, gain: 0.07 });
  tone(v, { type: 'sine', f0: 1560, decay: 0.25, gain: 0.05 });
};

/** A pill bottle: pills rattling, then the cap snapped tight. */
export const pickupPills: Recipe = (v) => {
  for (let i = 0; i < 6; i += 1) {
    const at = i * 0.035 + v.rand() * 0.01;
    noise(v, { at, filter: 'bandpass', freq: 3500 + v.rand() * 1500, q: 5, decay: 0.015, gain: 0.25 });
  }
  noise(v, { at: 0.25, filter: 'highpass', freq: 3000, decay: 0.01, gain: 0.3 });
  tone(v, { at: 0.25, type: 'square', f0: 1800, decay: 0.01, gain: 0.08, lp: 5000 });
};

/** A plank: two hollow knocks on dry wood. */
export const pickupWood: Recipe = (v) => {
  for (const at of [0, 0.1]) {
    tone(v, { at, type: 'triangle', f0: 300, f1: 240, decay: 0.08, gain: 0.35 });
    noise(v, { at, filter: 'bandpass', freq: 1200, q: 2, decay: 0.025, gain: 0.3 });
    tone(v, { at, type: 'sine', f0: 150, decay: 0.1, gain: 0.2 });
  }
};

/** A box of nails: a jingle of small bright tinks. */
export const pickupNails: Recipe = (v) => {
  for (let i = 0; i < 5; i += 1) {
    const at = i * 0.03 + v.rand() * 0.015;
    tone(v, { at, type: 'sine', f0: 2600 + v.rand() * 1800, decay: 0.06, gain: 0.08 });
    noise(v, { at, filter: 'bandpass', freq: 6000, q: 4, decay: 0.012, gain: 0.2 });
  }
};

/** A sheet or curtain: cloth gathered up in two soft swishes. */
export const pickupCloth: Recipe = (v) => {
  noise(v, { filter: 'bandpass', freq: 800, freq1: 2400, q: 0.8, attack: 0.06, decay: 0.12, gain: 0.3 });
  noise(v, { at: 0.12, filter: 'bandpass', freq: 1800, freq1: 900, q: 0.8, attack: 0.04, decay: 0.1, gain: 0.2 });
};

/** A tin of food: a clink of the can, the contents shifting, and a small healing chime. */
export const pickupCan: Recipe = (v) => {
  tone(v, { type: 'triangle', f0: 1900, decay: 0.08, gain: 0.15 });
  tone(v, { type: 'sine', f0: 2850, decay: 0.06, gain: 0.08 });
  noise(v, { filter: 'bandpass', freq: 4000, q: 4, decay: 0.015, gain: 0.25 });
  tone(v, { at: 0.05, type: 'sine', f0: 220, f1: 150, decay: 0.06, gain: 0.25 });
  tone(v, { at: 0.12, type: 'triangle', f0: 659.3, decay: 0.2, gain: 0.12 });
  tone(v, { at: 0.19, type: 'triangle', f0: 784, decay: 0.25, gain: 0.12 });
};

/** A bottle of water: a few rising glugs, a slosh, and a small healing chime. */
export const pickupWater: Recipe = (v) => {
  for (let i = 0; i < 4; i += 1) {
    const f0 = 300 + i * 80;
    tone(v, { at: i * 0.07, type: 'sine', f0, f1: f0 * 1.8, attack: 0.005, decay: 0.05, gain: 0.25 });
  }
  noise(v, { filter: 'lowpass', freq: 600, attack: 0.03, decay: 0.15, gain: 0.15 });
  tone(v, { at: 0.3, type: 'triangle', f0: 784, decay: 0.2, gain: 0.1 });
};

/** A piece of candy: a crinkle of wrapper and two sweet high notes. */
export const pickupCandy: Recipe = (v) => {
  for (let i = 0; i < 8; i += 1) {
    const at = i * 0.025 + v.rand() * 0.01;
    noise(v, { at, filter: 'highpass', freq: 4000 + v.rand() * 3000, decay: 0.008, gain: 0.2 });
  }
  tone(v, { at: 0.2, type: 'sine', f0: 1318.5, decay: 0.25, gain: 0.12 });
  tone(v, { at: 0.26, type: 'sine', f0: 1760, decay: 0.3, gain: 0.12 });
};
