import type { Point } from '../../shared/flow-field.ts';
import { dragStick, inStickZone, startStick, stickAngle, stickDirection } from './touch-stick.ts';
import type { Stick } from './touch-stick.ts';

/** Marks the on-screen buttons, gaps included, so a thumb that misses one is still not a shot. */
const PAD_SELECTOR = '[data-touch-pad]';
/** A tap's made-up mouse events land inside this. Anything later is a real mouse. */
const COMPAT_MOUSE_MS = 1000;
/** A tap is over before the finger is off the crosshair, so the mark stays to be seen. */
const MARK_LINGER_MS = 400;

export interface TouchHost {
  /** Play is on: nothing is up over the game. */
  live(): boolean;
  aimAt(x: number, y: number): void;
  onGesture(): void;
  /** The first touch of the page, for a device that never said it was a touch screen. */
  onSeen(): void;
}

interface Finger {
  readonly id: number;
  x: number;
  y: number;
}

/** Touch screen first: a laptop with one shows no buttons until it is touched. */
export function isTouchDevice(): boolean {
  return window.matchMedia?.('(pointer: coarse)').matches ?? false;
}

function onPad(target: EventTarget | null): boolean {
  const element = target as Partial<Element> | null;
  return element?.closest?.(PAD_SELECTOR) != null;
}

/**
 * Fingers on the play area. The first on the left is the stick; every other one aims and fires
 * through the same pointer the mouse uses, the newest in charge. Menus keep their touches:
 * nothing here cancels one unless play is on.
 */
export class TouchInput {
  dirX = 0;
  dirY = 0;
  /** The last hand on the game was a finger, so the mouse's habits are off. */
  used = isTouchDevice();
  stick: Stick | null = null;

  private readonly host: TouchHost;
  private fingers: Finger[] = [];
  private fireLatch = false;
  private lastAim: Point | null = null;
  private liftedAt = -Infinity;
  private lastTouchAt = -Infinity;
  private seen = false;

  constructor(host: TouchHost) {
    this.host = host;
    const active = { passive: false };
    window.addEventListener('touchstart', this.onStart, active);
    window.addEventListener('touchmove', this.onMove, active);
    window.addEventListener('touchend', this.onEnd);
    window.addEventListener('touchcancel', this.onEnd);
    window.addEventListener('gesturestart', this.onPinch, active);
  }

  dispose(): void {
    window.removeEventListener('touchstart', this.onStart);
    window.removeEventListener('touchmove', this.onMove);
    window.removeEventListener('touchend', this.onEnd);
    window.removeEventListener('touchcancel', this.onEnd);
    window.removeEventListener('gesturestart', this.onPinch);
  }

  /** Forgets every finger. One still down stays forgotten until it lifts and comes back. */
  letGo(): void {
    this.stick = null;
    this.fingers = [];
    this.dirX = 0;
    this.dirY = 0;
  }

  clearLatch(): void {
    this.fireLatch = false;
  }

  get shooting(): boolean {
    return this.fireLatch || this.fingers.length > 0;
  }

  /** A real mouse has taken over from the fingers. */
  mouseMoved(): void {
    const realMouse = performance.now() - this.lastTouchAt > COMPAT_MOUSE_MS;
    if (realMouse) this.used = false;
  }

  /**
   * The angle to face, or null to take it from the pointer. With no finger aiming, the
   * flashlight goes where the player walks, and stays put when they stop.
   */
  look(current: number): number | null {
    const pointerSteers = !this.used || this.shooting;
    if (pointerSteers) return null;
    return (this.stick && stickAngle(this.stick)) ?? current;
  }

  /** Where the crosshair is, in client pixels, or null with no finger on it or just off it. */
  aimSpot(ms: number): Point | null {
    const finger = this.fingers.at(-1);
    if (finger) return { x: finger.x, y: finger.y };
    return ms - this.liftedAt < MARK_LINGER_MS ? this.lastAim : null;
  }

  private place(touch: Touch): void {
    const { identifier: id, clientX: x, clientY: y } = touch;
    const walking = this.stick === null && inStickZone(x, y, window.innerWidth, window.innerHeight);
    if (walking) {
      this.stick = startStick(id, x, y);
      return;
    }
    this.fingers.push({ id, x, y });
    this.fireLatch = true;
    this.host.aimAt(x, y);
  }

  private track(touch: Touch): void {
    const { identifier: id, clientX: x, clientY: y } = touch;
    const stick = this.stick;
    const isStickFinger = stick?.id === id;
    if (isStickFinger) {
      this.stick = dragStick(stick, x, y);
      const dir = stickDirection(this.stick);
      this.dirX = dir.x;
      this.dirY = dir.y;
      return;
    }
    const finger = this.fingers.find((each) => each.id === id);
    if (!finger) return;
    finger.x = x;
    finger.y = y;
    const isAimFinger = finger === this.fingers.at(-1);
    if (isAimFinger) this.host.aimAt(x, y);
  }

  private lift(id: number): void {
    const isStickFinger = this.stick?.id === id;
    if (isStickFinger) {
      this.stick = null;
      this.dirX = 0;
      this.dirY = 0;
      return;
    }
    const lifted = this.fingers.find((each) => each.id === id);
    if (!lifted) return;
    const wasAiming = lifted === this.fingers.at(-1);
    this.fingers = this.fingers.filter((each) => each !== lifted);
    this.lastAim = { x: lifted.x, y: lifted.y };
    this.liftedAt = performance.now();
    const next = this.fingers.at(-1);
    const shouldReaim = wasAiming && next;
    if (shouldReaim) this.host.aimAt(next.x, next.y);
  }

  /** An edge swipe can take a finger with no touchend, and it must not walk on forever. */
  private dropLost(touches: TouchList): void {
    const down = new Set(Array.from(touches, (touch) => touch.identifier));
    const lost = [...this.fingers.map((finger) => finger.id), ...(this.stick ? [this.stick.id] : [])];
    for (const id of lost) if (!down.has(id)) this.lift(id);
  }

  private noteTouch(): void {
    this.lastTouchAt = performance.now();
    this.host.onGesture();
    if (this.seen) return;
    this.seen = true;
    this.host.onSeen();
  }

  private readonly onStart = (event: TouchEvent): void => {
    this.noteTouch();
    const isIdle = !this.host.live();
    if (isIdle) return;
    this.used = true;
    if (event.cancelable) event.preventDefault();
    this.dropLost(event.touches);
    for (const touch of Array.from(event.changedTouches)) {
      const isOffPad = !onPad(touch.target);
      if (isOffPad) this.place(touch);
    }
  };

  private readonly onMove = (event: TouchEvent): void => {
    const isIdle = !this.host.live();
    if (isIdle) return;
    if (event.cancelable) event.preventDefault();
    for (const touch of Array.from(event.changedTouches)) this.track(touch);
  };

  /** Some browsers only let sound start on a finger coming up, so this counts as a gesture too. */
  private readonly onEnd = (event: TouchEvent): void => {
    this.noteTouch();
    for (const touch of Array.from(event.changedTouches)) this.lift(touch.identifier);
  };

  private readonly onPinch = (event: Event): void => {
    const isLive = this.host.live();
    if (isLive) event.preventDefault();
  };
}
