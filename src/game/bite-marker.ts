// A short red mark on the screen edge, pointing at whatever bit the player from outside what they were facing.

/** How long the mark stays. */
export const BITE_MS = 700;
/** An attack and the hurt it caused arrive in one snapshot; this much apart still counts as the same bite. */
const PAIR_MS = 300;
/** A zombie this close to the hurt player is the one that bit; one further off was biting someone else. */
const BITE_REACH = 80;
/** Further than this from the facing direction is behind the player's shoulder, where they cannot see. */
const UNSEEN_HALF_ARC = (Math.PI * 5) / 12;

/** The mark on screen: which edge direction, in radians (0 is right, clockwise as the screen runs). */
export interface BiteMark {
  readonly key: number;
  readonly angle: number;
}

/** The smallest turn between two angles, 0..PI. */
export function angleGap(a: number, b: number): number {
  const turn = Math.abs(a - b) % (Math.PI * 2);
  return turn > Math.PI ? Math.PI * 2 - turn : turn;
}

/** Whether an attacker at (ax, ay) is outside the arc the player faces from (px, py). */
export function isUnseen(px: number, py: number, facing: number, ax: number, ay: number): boolean {
  const toward = Math.atan2(ay - py, ax - px);
  return angleGap(toward, facing) > UNSEEN_HALF_ARC;
}

/** Pairs a zombie's attack with the local player's hurt, in whichever order a snapshot lists them. */
export class BiteTracker {
  private attack: { x: number; y: number; at: number } | null = null;
  private hurt: { x: number; y: number; at: number } | null = null;
  private key = 0;

  reset(): void {
    this.attack = null;
    this.hurt = null;
  }

  attacked(x: number, y: number, now: number, facing: number | null): BiteMark | null {
    this.attack = { x, y, at: now };
    return this.pair(now, facing);
  }

  hurtLocal(x: number, y: number, now: number, facing: number | null): BiteMark | null {
    this.hurt = { x, y, at: now };
    return this.pair(now, facing);
  }

  private pair(now: number, facing: number | null): BiteMark | null {
    const { attack, hurt } = this;
    if (attack === null || hurt === null) return null;
    const together = Math.abs(attack.at - hurt.at) <= PAIR_MS && now - Math.min(attack.at, hurt.at) <= PAIR_MS;
    const close = Math.hypot(attack.x - hurt.x, attack.y - hurt.y) <= BITE_REACH;
    if (!together || !close) return null;
    this.attack = null;
    this.hurt = null;
    const seen = facing !== null && !isUnseen(hurt.x, hurt.y, facing, attack.x, attack.y);
    if (seen) return null;
    this.key += 1;
    return { key: this.key, angle: Math.atan2(attack.y - hurt.y, attack.x - hurt.x) };
  }
}
