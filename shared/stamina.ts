import { hasKeepsake, SNEAKER_STAMINA } from './keepsakes.ts';
import { staminaRecoveryMultiplier } from './survival-needs.ts';
// Sprinting costs breath. The bar drains while a survivor sprints on the move and refills when
// they do not; run it dry and they walk until it is back past the re-arm mark. A faster survivor
// (characters.ts moveSpeed) lasts longer, so the Speed stat on the select screen is the stamina stat too.

import { characterOf } from './characters.ts';
import {
  SPRINT_DRAIN_SEC,
  SPRINT_REARM_SHARE,
  STAMINA_REGEN_DELAY_SEC,
  STAMINA_REGEN_SEC,
  TICK_DT,
} from './constants.ts';
import type { Stance } from './protocol.ts';
import type { PlayerState } from './sim-state.ts';

/** The asked-for stance, with a winded survivor's sprint taken back to a walk. */
export function effectiveStance(wanted: Stance, winded: boolean): Stance {
  return wanted === 'sprint' && winded ? 'walk' : wanted;
}

/** Spends or refills the bar for this tick, from the stance the survivor actually moved in. */
export function updateStamina(p: PlayerState): void {
  const running = p.stance === 'sprint' && p.moving;
  if (running) {
    spend(p);
    return;
  }
  p.staminaRest = Math.max(0, p.staminaRest - TICK_DT);
  const resting = p.staminaRest > 0;
  if (!resting) refill(p);
}

function spend(p: PlayerState): void {
  const sneakers = hasKeepsake(p, 'sneakers') ? SNEAKER_STAMINA : 1;
  p.stamina = Math.max(0, p.stamina - TICK_DT / (SPRINT_DRAIN_SEC * characterOf(p.skin).moveSpeed * sneakers));
  p.staminaRest = STAMINA_REGEN_DELAY_SEC;
  p.winded ||= p.stamina === 0;
}

function refill(p: PlayerState): void {
  const recoveryScale = p.needs ? staminaRecoveryMultiplier(p.needs) : 1;
  p.stamina = Math.min(1, p.stamina + (TICK_DT * recoveryScale) / STAMINA_REGEN_SEC);
  const rearmed = p.stamina >= SPRINT_REARM_SHARE;
  p.winded &&= !rearmed;
}
