/** Seconds before a horde that its warning sounds: the drums, and anything else listening (a screen-edge pulse). */
export const HORDE_WARNING_LEAD = 10;

/**
 * Watches the horde clock and says, once per lull, when the next horde is HORDE_WARNING_LEAD seconds out.
 * A lull that starts already inside the lead is warned at once; a clock pushed back past the lead warns again.
 */
export class HordeWarning {
  private warned = false;

  /** One reading of the clock: seconds to the next horde in a lull, or null outside one. True when the warning is due. */
  read(clock: number | null): boolean {
    const counting = clock !== null && clock > 0;
    const farOff = !counting || clock > HORDE_WARNING_LEAD;
    if (farOff) {
      this.warned = false;
      return false;
    }
    if (this.warned) return false;
    this.warned = true;
    return true;
  }

  reset(): void {
    this.warned = false;
  }
}
