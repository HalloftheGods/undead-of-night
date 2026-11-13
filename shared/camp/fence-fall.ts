// The fence as it stands: which sections are down. The sim and every client lift a fallen section out of collision the same way,
// so walking, shooting and the horde's paths agree. The map itself is not rebuilt, so its print is the same mid-breach.

import type { WorldMap } from '../map-protocol.ts';
import { isLifted, liftProp, restoreSolids } from '../world-query.ts';

/** Brings exactly these sections down and stands the rest up. Section `i` is `map.props[i]`. True if anything changed. */
export function settleFence(map: WorldMap, fallen: readonly number[]): boolean {
  const sections = map.camp?.sections ?? [];
  const down = new Set(fallen.filter((i) => i >= 0 && i < sections.length));
  const already = sections.filter((s) => isLifted(map, s.index)).map((s) => s.index);
  const same = already.length === down.size && already.every((i) => down.has(i));
  if (same) return false;
  restoreSolids(map);
  for (const i of down) liftProp(map, i);
  return true;
}

/** The sections down in an overrun as the room sees it: the picked ones, from the breach to the next arrival. */
export function fallenOf(view: { readonly phase: string; readonly gaps?: readonly number[] } | null | undefined): readonly number[] {
  const isDown = view?.phase === 'breached' || view?.phase === 'held' || view?.phase === 'lost';
  return isDown ? (view?.gaps ?? []) : [];
}
