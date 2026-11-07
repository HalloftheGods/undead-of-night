/** The floating stick, in client pixels: where the thumb came down and where it has got to. */
export interface Stick {
  readonly id: number;
  readonly baseX: number;
  readonly baseY: number;
  readonly x: number;
  readonly y: number;
}

/** How far the knob travels before the base starts to follow the thumb. */
export const STICK_TRAVEL = 44;
const DEAD_ZONE = 9;
/** Half of an eighth of a turn: the movement packet has eight directions, so the stick has eight sectors. */
const SECTOR_EDGE = Math.sin(Math.PI / 8);
const WIDE_ZONE_WIDTH = 0.4;
const TALL_ZONE_WIDTH = 0.5;
const TALL_ZONE_TOP = 0.45;

/** The left thumb's share of the play area. Held upright, it cannot reach the top of a tall screen. */
export function inStickZone(x: number, y: number, viewW: number, viewH: number): boolean {
  const tall = viewH > viewW;
  if (tall) return x < viewW * TALL_ZONE_WIDTH && y > viewH * TALL_ZONE_TOP;
  return x < viewW * WIDE_ZONE_WIDTH;
}

export function startStick(id: number, x: number, y: number): Stick {
  return { id, baseX: x, baseY: y, x, y };
}

/** Moves the thumb. Past the knob's reach the base trails along, so turning back answers at once. */
export function dragStick(stick: Stick, x: number, y: number): Stick {
  const dx = x - stick.baseX;
  const dy = y - stick.baseY;
  const reach = Math.hypot(dx, dy);
  const isWithinTravel = reach <= STICK_TRAVEL;
  if (isWithinTravel) return { ...stick, x, y };
  const trail = (reach - STICK_TRAVEL) / reach;
  return { ...stick, baseX: stick.baseX + dx * trail, baseY: stick.baseY + dy * trail, x, y };
}

function stickReach(stick: Stick): number {
  return Math.hypot(stick.x - stick.baseX, stick.y - stick.baseY);
}

/** The direction to walk: each axis -1, 0 or 1, and nothing inside the dead zone. */
export function stickDirection(stick: Stick): { x: number; y: number } {
  const reach = stickReach(stick);
  const isInDeadZone = reach < DEAD_ZONE;
  if (isInDeadZone) return { x: 0, y: 0 };
  const across = (stick.x - stick.baseX) / reach;
  const down = (stick.y - stick.baseY) / reach;
  return { x: Math.abs(across) > SECTOR_EDGE ? Math.sign(across) : 0, y: Math.abs(down) > SECTOR_EDGE ? Math.sign(down) : 0 };
}

/** The way the thumb is pushing, or null while it is resting. */
export function stickAngle(stick: Stick): number | null {
  return stickReach(stick) < DEAD_ZONE ? null : Math.atan2(stick.y - stick.baseY, stick.x - stick.baseX);
}
