/**
 * Tap-to-aim assist for mobile controls.
 * When a player taps on or near a zombie, snap aim to the zombie's head.
 */

import { headSpot } from '@shared/headshots.ts';
import type { ZombieEntity } from '@shared/protocol.ts';

/** Maximum distance in pixels from tap to head center for aim assist to activate. */
const AIM_ASSIST_RADIUS = 40;

export interface AimTarget {
  /** World X coordinate of the head. */
  readonly x: number;
  /** World Y coordinate of the head. */
  readonly y: number;
  /** The zombie being targeted. */
  readonly zombie: ZombieEntity;
}

type ZombieCandidate = Pick<ZombieEntity, 'type' | 'x' | 'y' | 'angle' | 'health'>;

/**
 * Finds the nearest zombie head to a world position.
 * Returns the head position to aim at, or null if no valid target.
 *
 * @param worldX - World X coordinate of the tap
 * @param worldY - World Y coordinate of the tap
 * @param zombies - Active zombies to check
 * @param maxRadius - Maximum distance for aim assist (default 40px)
 */
export function findAimTarget<T extends ZombieCandidate>(
  worldX: number,
  worldY: number,
  zombies: readonly T[],
  maxRadius = AIM_ASSIST_RADIUS,
): { x: number; y: number; zombie: T } | null {
  let nearest: { x: number; y: number; zombie: T; distance: number } | null = null;

  for (const zombie of zombies) {
    // Skip dead zombies
    if (zombie.health <= 0) continue;

    const head = headSpot(zombie);
    const dx = head.x - worldX;
    const dy = head.y - worldY;
    const distance = Math.hypot(dx, dy);

    if (distance > maxRadius) continue;

    const isNearer = nearest === null || distance < nearest.distance;
    if (isNearer) {
      nearest = { x: head.x, y: head.y, zombie, distance };
    }
  }

  if (!nearest) return null;
  return { x: nearest.x, y: nearest.y, zombie: nearest.zombie };
}

/**
 * Converts client (screen) coordinates to world coordinates.
 * Requires the camera transform from the game's render state.
 */
export function clientToWorld(
  clientX: number,
  clientY: number,
  cameraX: number,
  cameraY: number,
  scale: number,
  viewWidth: number,
  viewHeight: number,
): { x: number; y: number } {
  // The camera is centered on screen, so offset from center
  const offsetX = clientX - viewWidth / 2;
  const offsetY = clientY - viewHeight / 2;

  // Convert from screen pixels to world units (accounting for scale)
  return {
    x: cameraX + offsetX / scale,
    y: cameraY + offsetY / scale,
  };
}
