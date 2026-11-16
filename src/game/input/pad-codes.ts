// The Standard Gamepad button indexes and the pseudo-keys only a pad sends, kept apart so the pad reader stays small.

/** Standard Gamepad button indexes (w3c.github.io/gamepad, "Remapping"). The bottom face button is 0 on every pad. */
export const PAD = {
  a: 0,
  b: 1,
  x: 2,
  y: 3,
  lb: 4,
  rb: 5,
  lt: 6,
  rt: 7,
  view: 8,
  start: 9,
  l3: 10,
  r3: 11,
  up: 12,
  down: 13,
  left: 14,
  right: 15,
  home: 16,
} as const;

/** Pseudo-keys for what only a pad does. The keyboard never sends them. */
export const PAD_FIRE = 'PadFire';
export const PAD_PREV_WEAPON = 'PadPrevWeapon';
/** The pad's horn button, held as this pseudo-key so a rebound keyboard horn does not matter. */
export const PAD_HORN = 'PadHorn';
