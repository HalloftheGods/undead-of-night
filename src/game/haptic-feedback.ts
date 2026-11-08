/**
 * Haptic feedback for mobile controls using the Vibration API.
 * Provides tactile feedback for game events like firing, taking damage, etc.
 */

/** Whether the device supports haptic feedback. */
export function supportsHaptics(): boolean {
  return typeof navigator !== 'undefined' && 'vibrate' in navigator;
}

/**
 * Triggers a vibration pattern. No-op if haptics are disabled or unsupported.
 * @param pattern - Vibration duration in ms, or array of [vibrate, pause, vibrate, ...] durations
 */
function vibrate(pattern: number | number[]): void {
  if (!supportsHaptics()) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    // Some browsers throw on vibrate even when 'vibrate' exists
  }
}

/** Cancels any ongoing vibration. */
export function cancelVibration(): void {
  if (!supportsHaptics()) return;
  try {
    navigator.vibrate(0);
  } catch {
    // Ignore errors
  }
}

// --- Vibration patterns ---

/** Quick tap for firing a weapon. */
const FIRE_PATTERN = 15;

/** Double pulse for taking damage. */
const DAMAGE_PATTERN = [50, 30, 50];

/** Triple warning pulse for low ammo. */
const LOW_AMMO_PATTERN = [20, 40, 20, 40, 20];

/** Short pulse for UI interactions (button press, menu selection). */
const UI_TAP_PATTERN = 10;

/** Medium pulse for important events (reload complete, item pickup). */
const EVENT_PATTERN = 25;

// --- Haptic feedback functions ---

/** Called when the player fires a weapon. */
export function hapticFire(): void {
  vibrate(FIRE_PATTERN);
}

/** Called when the player takes damage. */
export function hapticDamage(): void {
  vibrate(DAMAGE_PATTERN);
}

/** Called when ammo is low (e.g., last few rounds). */
export function hapticLowAmmo(): void {
  vibrate(LOW_AMMO_PATTERN);
}

/** Called for UI button presses and selections. */
export function hapticTap(): void {
  vibrate(UI_TAP_PATTERN);
}

/** Called for important events like reload complete. */
export function hapticEvent(): void {
  vibrate(EVENT_PATTERN);
}

/**
 * Haptic feedback controller that respects the user's preference setting.
 * Use this instead of calling the individual functions directly.
 */
export class HapticController {
  private enabled = true;

  constructor(enabled = true) {
    this.enabled = enabled && supportsHaptics();
  }

  /** Updates whether haptic feedback is enabled. */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled && supportsHaptics();
    if (!enabled) cancelVibration();
  }

  /** Returns whether haptic feedback is currently enabled. */
  isEnabled(): boolean {
    return this.enabled;
  }

  /** Weapon fire haptic. */
  fire(): void {
    if (this.enabled) hapticFire();
  }

  /** Damage taken haptic. */
  damage(): void {
    if (this.enabled) hapticDamage();
  }

  /** Low ammo warning haptic. */
  lowAmmo(): void {
    if (this.enabled) hapticLowAmmo();
  }

  /** UI interaction haptic. */
  tap(): void {
    if (this.enabled) hapticTap();
  }

  /** Important event haptic. */
  event(): void {
    if (this.enabled) hapticEvent();
  }
}
