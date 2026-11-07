/** Below this share of health the heart is heard and the edges of the screen go red. */
export const LOW_HEALTH = 0.34;
/** Seconds from the "lub" to the "dub", matching the heartbeat sound. */
const DUB_AT = 0.19;
const LUB_DECAY = 0.14;
const DUB_DECAY = 0.12;
const DUB_LEVEL = 0.7;

/** Seconds between beats: about two a second near death, slower the more health is left. */
export function beatPeriod(health: number): number {
  return 0.5 + health * 1.4;
}

/** 0..1 of a beat's swell `since` seconds after it: a strong lub, then a softer dub. */
export function beatPulse(since: number): number {
  const beforeBeat = since < 0;
  if (beforeBeat) return 0;
  const lub = Math.exp(-since / LUB_DECAY);
  const dub = since >= DUB_AT ? DUB_LEVEL * Math.exp(-(since - DUB_AT) / DUB_DECAY) : 0;
  return Math.min(1, lub + dub);
}

/**
 * One clock for the low-health heart, so the sound and the red at the screen's edge beat together.
 * It keeps time whether or not the sound can play, so the picture pulses on mute too.
 */
export class Heartbeat {
  private untilNext = 0;
  private since = Number.POSITIVE_INFINITY;

  /** True on the frame a beat lands. Off the low-health band (or down) it rests, and the next beat comes at once. */
  tick(dt: number, health: number): boolean {
    this.since += dt;
    const racing = health > 0 && health < LOW_HEALTH;
    if (!racing) {
      this.untilNext = 0;
      return false;
    }
    this.untilNext -= dt;
    const waiting = this.untilNext > 0;
    if (waiting) return false;
    this.untilNext = beatPeriod(health);
    this.since = 0;
    return true;
  }

  /** How swollen the current beat is, 0..1. */
  get pulse(): number {
    return beatPulse(this.since);
  }

  reset(): void {
    this.untilNext = 0;
    this.since = Number.POSITIVE_INFINITY;
  }
}
