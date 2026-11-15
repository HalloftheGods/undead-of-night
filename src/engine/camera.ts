const LEAD_FACTOR = 0.16;
export const LEAD_MAX = 40;
const LEAD_RATE = 5;

/** Top-left of the view along one axis, in a world that starts at `worldStart`. A world smaller than the view stays centred. */
export function clampCameraAxis(position: number, viewSize: number, worldSize: number, worldStart = 0): number {
  const isWorldSmaller = worldSize <= viewSize;
  if (isWorldSmaller) return worldStart + Math.round((worldSize - viewSize) / 2);
  return Math.min(Math.max(position, worldStart), worldStart + worldSize - viewSize);
}

/** Angle from the player's on-screen position to the pointer, both in buffer pixels. */
export function aimAngle(pointerX: number, pointerY: number, playerScreenX: number, playerScreenY: number): number {
  return Math.atan2(pointerY - playerScreenY, pointerX - playerScreenX);
}

function clampLead(value: number): number {
  return Math.min(Math.max(value, -LEAD_MAX), LEAD_MAX);
}

/**
 * Follows a focus with a slight lead toward the pointer. The focus term is
 * rounded on its own so a walking player holds still on screen rather than
 * jittering between two rounding errors.
 */
export class Camera {
  left = 0;
  top = 0;
  viewW = 0;
  viewH = 0;
  worldW = 0;
  worldH = 0;
  /** Where the world the camera keeps to starts, down the map: the top of the layer being looked at. */
  worldTop = 0;
  private leadX = 0;
  private leadY = 0;

  setView(viewW: number, viewH: number): void {
    this.viewW = viewW;
    this.viewH = viewH;
  }

  /** The world the view keeps to: the whole town, or one layer of a map, `worldH` tall from `worldTop`. */
  setWorld(worldW: number, worldH: number, worldTop = 0): void {
    this.worldW = worldW;
    this.worldH = worldH;
    this.worldTop = worldTop;
  }

  /** Pointer in buffer pixels, or null to drift the lead back to nothing. */
  follow(focusX: number, focusY: number, pointerX: number | null, pointerY: number | null, dt: number): void {
    const targetX = pointerX === null ? 0 : clampLead((pointerX - this.viewW / 2) * LEAD_FACTOR);
    const targetY = pointerY === null ? 0 : clampLead((pointerY - this.viewH / 2) * LEAD_FACTOR);
    const blend = 1 - Math.exp(-LEAD_RATE * dt);
    this.leadX += (targetX - this.leadX) * blend;
    this.leadY += (targetY - this.leadY) * blend;
    const left = Math.round(focusX) + Math.round(this.leadX - this.viewW / 2);
    const top = Math.round(focusY) + Math.round(this.leadY - this.viewH / 2);
    this.left = clampCameraAxis(left, this.viewW, this.worldW);
    this.top = clampCameraAxis(top, this.viewH, this.worldH, this.worldTop);
  }

  screenX(worldX: number): number {
    return Math.round(worldX) - this.left;
  }

  screenY(worldY: number): number {
    return Math.round(worldY) - this.top;
  }
}
