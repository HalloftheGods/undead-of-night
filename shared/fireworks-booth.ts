// The S.O.S. Fireworks bus: an old city bus turned fireworks stand, parked in the downtown car park.
// It holds fireworks and nothing else, and hands them out an armful at a time until it is sold out.

import type { Container } from './containers.ts';
import type { PlayerState, SimState } from './sim-state.ts';
import { emit } from './sim-state.ts';
import { FIREWORK_CARRY } from './throwables.ts';

/** Fireworks the bus starts the night with: enough for a whole team to fill up more than once. */
export const BOOTH_FIREWORKS = 10;

export const isBooth = (container: Pick<Container, 'kind'>): boolean => container.kind === 'booth';

/**
 * Tops the searcher up to what they can carry. Their hands already full, they are told so and the bus
 * stays open for whoever comes next. It only reads as searched once it is sold out.
 */
export function sellFireworks(sim: SimState, p: PlayerState, id: number): void {
  const state = sim.containers[id];
  const left = state.fireworks ?? 0;
  const taken = Math.min(left, Math.max(0, FIREWORK_CARRY - p.fireworks));
  const base = { type: 'container_opened', playerId: p.id, container: id, x: p.x, y: p.y, noisy: false, stash: 'firework' } as const;
  const handsFull = taken === 0;
  if (handsFull) {
    emit(sim, { ...base, found: false, full: true });
    return;
  }
  p.fireworks += taken;
  state.fireworks = left - taken;
  state.opened = state.fireworks === 0;
  emit(sim, { ...base, found: true, fireworks: taken });
}
