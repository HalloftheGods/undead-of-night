import { nextTick, onScopeDispose, reactive, watch, type Ref } from 'vue';
import type { InventoryGrid } from '../../shared/grid-inventory.ts';
import { arrivalCamera, arrivalPhase, arrivalTick, FLY_MS, POP_MS, type Arrival } from '../game/inventory/pickup-arrivals.ts';

/** How high the hop rises at its top, in page pixels. */
const HOP_PX = 70;
/** How much bigger than its cell the item starts its flight. */
const START_SCALE = 1.7;

/**
 * The page loot window's side of an item arriving while it is open (game/inventory/pickup-arrivals.ts). The grids are
 * filled in place by the bag, which Vue cannot see, so each arrival first re-sets each grid's list through the
 * reactive state. Then the item's cell hides while a copy of it hops in from where it lay in the world, and pops in
 * (`is-arrived`) once it lands. `root` is the window's backdrop, which the copy is drawn in so it keeps the art sizes.
 */
export function useItemArrivals(root: Ref<HTMLElement | null>, grids: () => readonly InventoryGrid[]) {
  const incoming = reactive(new Set<string>());
  const arrived = reactive(new Set<string>());
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const copies = new Set<HTMLElement>();

  function later(ms: number, run: () => void): void {
    const timer = setTimeout(() => {
      timers.delete(timer);
      run();
    }, ms);
    timers.add(timer);
  }

  function pop(id: string, ms: number): void {
    incoming.delete(id);
    arrived.add(id);
    later(ms, () => arrived.delete(id));
  }

  /** Where the flight sets off, in client pixels: the cell it left (with its width), or its world spot (width 0). */
  function startOf(arrival: Arrival): { x: number; y: number; w: number } | null {
    const left = arrival.origin?.client;
    if (left) return { x: left.x + left.w / 2, y: left.y + left.h / 2, w: left.w };
    const camera = arrivalCamera();
    if (!camera || !arrival.from) return null;
    return { ...camera.toClient(arrival.from), w: 0 };
  }

  /** A copy of the cell's element, sent from the world spot to the cell. False when it cannot fly (no camera, no cell). */
  function fly(arrival: Arrival, flyMs: number): boolean {
    const host = root.value;
    if (!host || typeof host.animate !== 'function') return false;
    const cell = host.querySelector<HTMLElement>(`[data-item-id="${CSS.escape(arrival.id)}"]`);
    const origin = startOf(arrival);
    if (!cell || !origin) return false;
    const to = cell.getBoundingClientRect();
    const frame = host.getBoundingClientRect();
    const from = { x: origin.x, y: origin.y };
    const startScale = origin.w > 0 ? origin.w / Math.max(1, to.width) : START_SCALE;
    const hopPx = origin.w > 0 ? HOP_PX / 2 : HOP_PX;
    const dx = from.x - (to.left + to.width / 2);
    const dy = from.y - (to.top + to.height / 2);
    const copy = cell.cloneNode(true) as HTMLElement;
    copy.classList.remove('is-incoming', 'is-selected', 'is-pad');
    copy.classList.add('is-flying');
    copy.removeAttribute('data-item-id');
    Object.assign(copy.style, {
      position: 'absolute',
      left: `${to.left - frame.left}px`,
      top: `${to.top - frame.top}px`,
      width: `${to.width}px`,
      height: `${to.height}px`,
      margin: '0',
      pointerEvents: 'none',
      zIndex: '50',
    });
    host.appendChild(copy);
    copies.add(copy);
    const mid = `translate(${dx / 2}px, ${dy / 2 - hopPx}px) scale(${(startScale + 1) / 2})`;
    const flight = copy.animate(
      [
        { transform: `translate(${dx}px, ${dy}px) scale(${startScale})`, opacity: origin.w > 0 ? 1 : 0.5 },
        { transform: mid, opacity: 1, offset: 0.5 },
        { transform: 'translate(0, 0) scale(1)', opacity: 1 },
      ],
      { duration: flyMs, easing: 'cubic-bezier(0.25, 0.7, 0.35, 1)' },
    );
    const done = () => {
      copy.remove();
      copies.delete(copy);
    };
    flight.onfinish = done;
    flight.oncancel = done;
    return true;
  }

  function start(): void {
    for (const grid of grids()) {
      for (const item of grid.items) {
        const phase = arrivalPhase(item.id);
        if (!phase || incoming.has(item.id) || arrived.has(item.id)) continue;
        if (phase.phase === 'pop') {
          pop(item.id, POP_MS * (1 - phase.t));
          continue;
        }
        const left = FLY_MS * (1 - phase.t);
        if (!fly(phase.arrival, left)) {
          pop(item.id, POP_MS);
          continue;
        }
        incoming.add(item.id);
        later(left, () => pop(item.id, POP_MS));
      }
    }
  }

  watch(arrivalTick, () => {
    // Re-set through the reactive grids so the window draws what the bag put in them.
    for (const grid of grids()) grid.items = [...grid.items];
    void nextTick(start);
  });

  onScopeDispose(() => {
    for (const timer of timers) clearTimeout(timer);
    for (const copy of copies) copy.remove();
  });

  return {
    /** Classes for a grid item: hidden while its copy is in the air, popping once it lands. */
    arrivalClass: (id: string) => ({ 'is-incoming': incoming.has(id), 'is-arrived': arrived.has(id) }),
  };
}
