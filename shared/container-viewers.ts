import { containerGap, SEARCH_WALK_AWAY } from './containers.ts';
import type { GridItem } from './grid-inventory.ts';
import type { EntityId } from './protocol.ts';
import type { PlayerState, SimState } from './sim-state.ts';

/** True while the survivor stands close enough to a container to keep its window open. */
function inReach(sim: SimState, p: PlayerState, id: number): boolean {
  const gap = containerGap(sim.map, id, p.x, p.y);
  return gap !== null && gap <= SEARCH_WALK_AWAY;
}

/**
 * The survivor opened a container's window. Only a container that has been searched, and is in reach of a living
 * survivor, can be viewed. True when they are now a viewer.
 */
export function viewContainer(sim: SimState, p: PlayerState, id: number): boolean {
  const state = sim.containers[id];
  const canView = p.status === 'alive' && state !== undefined && state.opened && inReach(sim, p, id);
  if (!canView) return false;
  const viewers = sim.containerViewers.get(id) ?? new Set<EntityId>();
  viewers.add(p.id);
  sim.containerViewers.set(id, viewers);
  return true;
}

/** The survivor closed a container's window. */
export function leaveContainer(sim: SimState, p: Pick<PlayerState, 'id'>, id: number): void {
  const viewers = sim.containerViewers.get(id);
  if (!viewers) return;
  viewers.delete(p.id);
  if (viewers.size === 0) sim.containerViewers.delete(id);
}

/** True when the survivor has this container's window open. */
export function isViewing(sim: SimState, p: Pick<PlayerState, 'id'>, id: number): boolean {
  return sim.containerViewers.get(id)?.has(p.id) ?? false;
}

/** Once a tick: a viewer who walked away, died or left the room stops viewing, as does every viewer of a container that is gone. */
export function dropStaleViewers(sim: SimState): void {
  for (const [id, viewers] of sim.containerViewers) {
    const isGone = sim.containers[id]?.opened !== true;
    for (const viewerId of viewers) {
      const p = sim.players.find((player) => player.id === viewerId);
      const isStale = isGone || !p || p.status !== 'alive' || !inReach(sim, p, id);
      if (isStale) viewers.delete(viewerId);
    }
    if (viewers.size === 0) sim.containerViewers.delete(id);
  }
}

/** The contents of every container someone has open, for the snapshot. A viewed container is listed even when empty. */
export function viewedContainers(sim: SimState): { id: number; items: GridItem[] }[] {
  const viewed: { id: number; items: GridItem[] }[] = [];
  for (const id of sim.containerViewers.keys()) {
    const items = sim.containers[id]?.items ?? [];
    viewed.push({ id, items: items.map((item) => ({ ...item })) });
  }
  return viewed.sort((a, b) => a.id - b.id);
}
