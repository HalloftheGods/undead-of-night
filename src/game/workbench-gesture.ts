import type { GunUpgrade } from '../../shared/gun-upgrade-data.ts';

export type TactileKind = 'suppressor' | 'magazine' | 'grip';

export interface GestureStatus {
  readonly progress: number;
  readonly locked: boolean;
  readonly ratcheted: boolean;
}

const TWIST_TARGET_RAD = Math.PI * 4;
const TWIST_RATCHET_INTERVAL = Math.PI / 4;
const DRAG_TARGET_PX = 80;
const DRAG_LOCK_THRESHOLD = 0.85;
const SLIDE_TARGET_PX = 90;
const SLIDE_RATCHET_INTERVAL = 18;
const SLIDE_LOCK_THRESHOLD = 0.85;

export const TACTILE_UPGRADES: Readonly<Record<TactileKind, GunUpgrade>> = {
  suppressor: 'suppressor',
  magazine: 'magazine',
  grip: 'fireRate',
};

export function toTactileKind(upgrade: GunUpgrade): TactileKind | null {
  if (upgrade === 'suppressor') return 'suppressor';
  if (upgrade === 'magazine') return 'magazine';
  if (upgrade === 'fireRate') return 'grip';
  return null;
}

export function isTactileUpgrade(upgrade: GunUpgrade): boolean {
  return toTactileKind(upgrade) !== null;
}

export class TwistGestureState {
  private accumulatedRad = 0;
  private lastAngleRad: number | null = null;
  private lastRatchetStep = 0;

  get progress(): number {
    return Math.min(1, this.accumulatedRad / TWIST_TARGET_RAD);
  }

  get isLocked(): boolean {
    return this.progress >= 1;
  }

  reset(): void {
    this.accumulatedRad = 0;
    this.lastAngleRad = null;
    this.lastRatchetStep = 0;
  }

  start(x: number, y: number, cx: number, cy: number): void {
    this.lastAngleRad = Math.atan2(y - cy, x - cx);
  }

  update(x: number, y: number, cx: number, cy: number): GestureStatus {
    if (this.isLocked) {
      return { progress: 1, locked: true, ratcheted: false };
    }

    const currentAngle = Math.atan2(y - cy, x - cx);
    if (this.lastAngleRad === null) {
      this.lastAngleRad = currentAngle;
      return { progress: this.progress, locked: false, ratcheted: false };
    }

    let deltaAngle = currentAngle - this.lastAngleRad;
    if (deltaAngle > Math.PI) deltaAngle -= Math.PI * 2;
    else if (deltaAngle < -Math.PI) deltaAngle += Math.PI * 2;

    this.lastAngleRad = currentAngle;

    const isClockwise = deltaAngle > 0;
    let ratcheted = false;

    if (isClockwise) {
      this.accumulatedRad = Math.min(TWIST_TARGET_RAD, this.accumulatedRad + deltaAngle);
      const currentStep = Math.floor(this.accumulatedRad / TWIST_RATCHET_INTERVAL);
      const isNewStep = currentStep > this.lastRatchetStep;
      if (isNewStep) {
        this.lastRatchetStep = currentStep;
        ratcheted = true;
      }
    }

    const locked = this.isLocked;
    return { progress: this.progress, locked, ratcheted };
  }
}

export class DragSlotGestureState {
  private startY: number | null = null;
  private currentDistancePx = 0;

  get progress(): number {
    return Math.min(1, Math.max(0, this.currentDistancePx / DRAG_TARGET_PX));
  }

  get isLocked(): boolean {
    return this.progress >= 1;
  }

  reset(): void {
    this.startY = null;
    this.currentDistancePx = 0;
  }

  start(y: number): void {
    this.startY = y;
  }

  update(y: number): GestureStatus {
    if (this.isLocked) {
      return { progress: 1, locked: true, ratcheted: false };
    }

    if (this.startY === null) {
      this.startY = y;
      return { progress: this.progress, locked: false, ratcheted: false };
    }

    // Dragging up towards well (y decreases as pointer moves up)
    const upwardDelta = this.startY - y;
    this.currentDistancePx = Math.max(0, upwardDelta);

    const rawProgress = this.progress;
    const pastThreshold = rawProgress >= DRAG_LOCK_THRESHOLD;

    if (pastThreshold) {
      this.currentDistancePx = DRAG_TARGET_PX;
      return { progress: 1, locked: true, ratcheted: true };
    }

    return { progress: rawProgress, locked: false, ratcheted: false };
  }
}

export class SlideRailGestureState {
  private startX: number | null = null;
  private currentDistancePx = 0;
  private lastRatchetStep = 0;

  get progress(): number {
    return Math.min(1, Math.max(0, this.currentDistancePx / SLIDE_TARGET_PX));
  }

  get isLocked(): boolean {
    return this.progress >= 1;
  }

  reset(): void {
    this.startX = null;
    this.currentDistancePx = 0;
    this.lastRatchetStep = 0;
  }

  start(x: number): void {
    this.startX = x;
  }

  update(x: number): GestureStatus {
    if (this.isLocked) {
      return { progress: 1, locked: true, ratcheted: false };
    }

    if (this.startX === null) {
      this.startX = x;
      return { progress: this.progress, locked: false, ratcheted: false };
    }

    // Sliding right along the accessory rail (x increases)
    const slideDelta = x - this.startX;
    this.currentDistancePx = Math.max(0, slideDelta);

    const rawProgress = this.progress;
    const pastThreshold = rawProgress >= SLIDE_LOCK_THRESHOLD;

    if (pastThreshold) {
      this.currentDistancePx = SLIDE_TARGET_PX;
      return { progress: 1, locked: true, ratcheted: true };
    }

    let ratcheted = false;
    const currentStep = Math.floor(this.currentDistancePx / SLIDE_RATCHET_INTERVAL);
    const isNewStep = currentStep > this.lastRatchetStep;
    if (isNewStep) {
      this.lastRatchetStep = currentStep;
      ratcheted = true;
    }

    return { progress: rawProgress, locked: false, ratcheted };
  }
}
