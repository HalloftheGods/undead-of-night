/**
 * Swipe gesture detection for mobile controls.
 * Tracks touch movement and determines direction when the swipe is fast and long enough.
 */

export type SwipeDirection = 'up' | 'down' | 'left' | 'right';

export interface SwipeResult {
  readonly direction: SwipeDirection;
  readonly distance: number;
  readonly velocity: number;
}

/** A finger mid-gesture, tracking where it started and its speed. */
export interface SwipeTracker {
  readonly id: number;
  readonly startX: number;
  readonly startY: number;
  readonly startTime: number;
  x: number;
  y: number;
}

/** Minimum distance in pixels for a gesture to count as a swipe. */
const MIN_DISTANCE = 40;
/** Maximum time in ms for a swipe to be valid; slower movements are drags. */
const MAX_TIME_MS = 300;
/** Minimum velocity in px/ms for a gesture to count. */
const MIN_VELOCITY = 0.15;
/** Ratio of primary to secondary axis movement; prevents diagonal ambiguity. */
const DIRECTION_THRESHOLD = 1.5;

/** Creates a tracker for a new touch. */
export function startSwipe(id: number, x: number, y: number): SwipeTracker {
  return { id, startX: x, startY: y, startTime: performance.now(), x, y };
}

/** Updates the tracker with a new position. */
export function moveSwipe(tracker: SwipeTracker, x: number, y: number): SwipeTracker {
  return { ...tracker, x, y };
}

/** Determines if a lift completes a valid swipe. Returns the result or null if not a swipe. */
export function endSwipe(tracker: SwipeTracker, sensitivity = 1): SwipeResult | null {
  const dx = tracker.x - tracker.startX;
  const dy = tracker.y - tracker.startY;
  const distance = Math.hypot(dx, dy);
  const elapsed = performance.now() - tracker.startTime;
  const velocity = distance / elapsed;

  // Scale minimum distance by sensitivity (0.5-2.0 range)
  const minDist = MIN_DISTANCE / sensitivity;

  const tooSlow = elapsed > MAX_TIME_MS || velocity < MIN_VELOCITY;
  const tooShort = distance < minDist;
  if (tooSlow || tooShort) return null;

  const absX = Math.abs(dx);
  const absY = Math.abs(dy);

  // Determine direction: one axis must dominate
  const isHorizontal = absX > absY * DIRECTION_THRESHOLD;
  const isVertical = absY > absX * DIRECTION_THRESHOLD;

  if (isHorizontal) {
    return { direction: dx > 0 ? 'right' : 'left', distance, velocity };
  }
  if (isVertical) {
    return { direction: dy > 0 ? 'down' : 'up', distance, velocity };
  }

  // Diagonal: no clear direction
  return null;
}

/** Checks if a point is in the swipe zone (outside the stick zone, not on UI). */
export function isSwipeZone(x: number, y: number, viewW: number, viewH: number): boolean {
  // Use the opposite of stick zone: right side in landscape, top in portrait
  const tall = viewH > viewW;
  if (tall) {
    const TALL_ZONE_WIDTH = 0.5;
    const TALL_ZONE_TOP = 0.45;
    // Swipe zone: right side or upper part
    return x >= viewW * TALL_ZONE_WIDTH || y < viewH * TALL_ZONE_TOP;
  }
  // Landscape: right 60%
  const WIDE_ZONE_WIDTH = 0.4;
  return x >= viewW * WIDE_ZONE_WIDTH;
}
