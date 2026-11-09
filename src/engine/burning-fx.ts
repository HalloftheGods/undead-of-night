// Fireworks and flares left burning on the ground, drawn from their events alone until they go out:
// a spinner whirling petals of colored sparks, a fountain spraying gold straight up, a red flare hissing.

import type { PulseLight } from './fx-director.ts';
import type { ParticleSystem } from './particles.ts';

export type BurnKind = 'spinner' | 'fountain' | 'flare';

/** A ground spinner's spouts, one color each, so the flower it throws has petals. */
export const SPINNER_PETALS = ['#ffe066', '#ff5ad2', '#6dff8a', '#5ad8ff'];
/** A fountain's spray: gold and white, thrown high and falling back round it. */
export const FOUNTAIN_SPARKS = ['#fff6c8', '#ffe066', '#ffb43c', '#ffffff'];
export const FLARE_SPARKS = ['#ffd0d0', '#ff4a3c', '#ff7a5c'];

const SPINNER_SPOUTS = 4;
/** Turns a second, and how long its sparks fly out before they die. */
const SPINNER_TURN = 15;
const SPINNER_SPARK_LIFE = 0.45;
/** How fast a fountain's sparks leave the cone, upward. */
const FOUNTAIN_LIFT = 150;

/** How each kind looks: sparks a second, how long it takes to die down, its light. */
interface BurnLook {
  readonly dotsPerSec: number;
  readonly fadeSec: number;
  /** Its light's reach; left off, a spinner's grows with its sparks. */
  readonly glowRadius?: number;
  /** Its light's color; left off, a spinner's cycles through its petals. */
  readonly glow?: string;
}

const BURN_LOOKS: Readonly<Record<BurnKind, BurnLook>> = {
  spinner: { dotsPerSec: 260, fadeSec: 1.2 },
  fountain: { dotsPerSec: 90, fadeSec: 3, glowRadius: 120, glow: '#ffc24a' },
  flare: { dotsPerSec: 24, fadeSec: 3, glowRadius: 130, glow: '#ff3a2a' },
};

interface Burning {
  readonly kind: BurnKind;
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  left: number;
  owed: number;
  /** Which way a spinner's spouts face now, turning every frame. */
  spin: number;
}

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function spread(amount: number): number {
  return (Math.random() - 0.5) * 2 * amount;
}

export class BurningFx {
  private readonly burning: Burning[] = [];
  private readonly sparks: Readonly<Record<BurnKind, (burn: Burning, fade: number) => void>> = {
    spinner: (burn, fade) => this.spinnerSpark(burn, fade),
    fountain: (burn, fade) => this.fountainSpark(burn, fade),
    flare: (burn) => this.flareSpark(burn),
  };

  constructor(
    private readonly particles: ParticleSystem,
    private readonly pulses: PulseLight[],
  ) {}

  light(kind: BurnKind, x: number, y: number, radius: number, sec: number): void {
    this.burning.push({ kind, x, y, radius, left: sec, owed: 0, spin: Math.random() * Math.PI * 2 });
  }

  clear(): void {
    this.burning.length = 0;
  }

  /** Keeps every spinner turning, every fountain spraying and every flare alight: sparks and a flickering glow each frame. */
  update(dt: number): void {
    for (let i = this.burning.length - 1; i >= 0; i -= 1) {
      const burn = this.burning[i];
      burn.left -= dt;
      const isBurnOver = burn.left <= 0;
      if (isBurnOver) {
        this.burning.splice(i, 1);
        continue;
      }
      const look = BURN_LOOKS[burn.kind];
      const fade = Math.min(1, burn.left / look.fadeSec);
      burn.spin += dt * SPINNER_TURN * (0.6 + fade * 0.4);
      burn.owed += dt * look.dotsPerSec * fade;
      for (; burn.owed >= 1; burn.owed -= 1) this.sparks[burn.kind](burn, fade);
      const flicker = 0.85 + Math.random() * 0.15;
      const radius = (look.glowRadius ?? burn.radius * 3.4) * flicker * (0.5 + fade * 0.5);
      const glow = look.glow ?? SPINNER_PETALS[Math.floor(burn.spin / (Math.PI / 2)) % SPINNER_PETALS.length];
      this.pulses.push({ x: burn.x, y: burn.y, radius, color: glow, life: dt * 1.01, maxLife: dt * 1.01 });
    }
  }

  /** One spark off a spinning spout: flung out along the ground and swept round, so the spouts draw petals. */
  private spinnerSpark(burn: Burning, fade: number): void {
    const spout = Math.floor(Math.random() * SPINNER_SPOUTS);
    const heading = burn.spin + (spout * Math.PI * 2) / SPINNER_SPOUTS + spread(0.25);
    const pace = (burn.radius / SPINNER_SPARK_LIFE) * (0.6 + Math.random() * 0.5) * (0.6 + fade * 0.4);
    // The spout points along the turn, so the spark leaves sideways as well as out.
    const sideways = heading + Math.PI / 2;
    this.particles.addDot({
      x: burn.x,
      y: burn.y,
      z: 2,
      vx: Math.cos(heading) * pace + Math.cos(sideways) * pace * 0.5,
      vy: (Math.sin(heading) * pace + Math.sin(sideways) * pace * 0.5) * 0.7,
      vz: 5 + Math.random() * 12,
      life: SPINNER_SPARK_LIFE * (0.6 + Math.random() * 0.6),
      color: SPINNER_PETALS[spout % SPINNER_PETALS.length],
      size: Math.random() < 0.5 ? 2 : 1,
      emissive: true,
    });
  }

  /** One spark of a fountain's spray: thrown up from the cone's mouth, drifting out as it falls back. */
  private fountainSpark(burn: Burning, fade: number): void {
    const heading = Math.random() * Math.PI * 2;
    const drift = 6 + Math.random() * 22;
    this.particles.addDot({
      x: burn.x + spread(1.5),
      y: burn.y + spread(1),
      z: 6,
      vx: Math.cos(heading) * drift,
      vy: Math.sin(heading) * drift * 0.7,
      vz: FOUNTAIN_LIFT * (0.55 + Math.random() * 0.45) * (0.5 + fade * 0.5),
      life: 0.5 + Math.random() * 0.5,
      color: pick(FOUNTAIN_SPARKS),
      size: Math.random() < 0.35 ? 2 : 1,
      emissive: true,
    });
  }

  private flareSpark(burn: Burning): void {
    this.particles.addDot({
      x: burn.x + spread(1),
      y: burn.y + spread(0.7),
      z: 1,
      vx: spread(30),
      vy: spread(30),
      vz: 40 + Math.random() * 60,
      life: 0.25 + Math.random() * 0.35,
      color: pick(FLARE_SPARKS),
      size: Math.random() < 0.3 ? 2 : 1,
      emissive: true,
    });
  }
}
