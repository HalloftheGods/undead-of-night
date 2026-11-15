import { nextTick, onScopeDispose, reactive, ref, watch, type Ref } from 'vue';
import type { InventoryGrid } from '../../shared/grid-inventory.ts';
import { activePuffs, arrivalCamera, FLY_MS, motionOf, motionTick, POP_MS, PUFF_MS, SHAKE_MS, shakeOf, type Motion } from '../game/inventory/move-motion.ts';

/** How high the hop rises at its top, in page pixels. */
const HOP_PX = 70;
/** How much bigger than its cell the item starts its flight. */
const START_SCALE = 1.7;

/** The dust a puff throws: three frames, spreading and fading. */
const PUFF_FRAMES = [
  { transform: 'scale(0.4)', opacity: 0.9 },
  { transform: 'scale(0.9)', opacity: 0.6, offset: 0.5 },
  { transform: 'scale(1.3)', opacity: 0 },
];

/**
 * The page loot window's renderer for item motion (game/inventory/move-motion.ts); it computes none of its own. The
 * grids are refilled in place by the move ledger, which Vue cannot see, so each tick first re-sets each grid's list
 * through the reactive state. Then a flying item's cell hides while a copy of it hops in from where it lay in the
 * world or the cell it left, and pops in (`is-arrived`) once it lands; a puff throws dust over the emptied cell.
 * `root` is the window's backdrop, which the copies are drawn in so they keep the art sizes.
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
  function startOf(motion: Motion): { x: number; y: number; w: number } | null {
    const from = motion.from;
    const left = from && 'cell' in from ? from.cell.client : undefined;
    if (left) return { x: left.x + left.w / 2, y: left.y + left.h / 2, w: left.w };
    const camera = arrivalCamera();
    const world = from && 'world' in from ? from.world : null;
    if (!camera || !world) return null;
    return { ...camera.toClient(world), w: 0 };
  }

  /** A copy of the cell's element, sent from where it set off to the cell. False when it cannot fly (no camera, no cell). */
  function fly(motion: Motion, flyMs: number): boolean {
    const host = root.value;
    if (!host || typeof host.animate !== 'function') return false;
    const cell = host.querySelector<HTMLElement>(`[data-item-id="${CSS.escape(motion.itemId)}"]`);
    const origin = startOf(motion);
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

  /** Dust over each cell a teammate emptied, drawn once per puff. */
  const puffed = new Set<string>();
  function puff(): void {
    const host = root.value;
    if (!host || typeof host.animate !== 'function') return;
    const frame = host.getBoundingClientRect();
    for (const { origin, t } of activePuffs()) {
      const cell = origin.client;
      const key = cell ? `${cell.x},${cell.y}` : '';
      if (!cell || puffed.has(key)) continue;
      puffed.add(key);
      const dust = document.createElement('div');
      dust.className = 'loot-puff';
      Object.assign(dust.style, {
        position: 'absolute',
        left: `${cell.x - frame.left}px`,
        top: `${cell.y - frame.top}px`,
        width: `${cell.w}px`,
        height: `${cell.h}px`,
        pointerEvents: 'none',
        zIndex: '50',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(185,173,143,0.85) 0%, rgba(185,173,143,0) 70%)',
      });
      host.appendChild(dust);
      copies.add(dust);
      const left = PUFF_MS * (1 - t);
      const burst = dust.animate(PUFF_FRAMES, { duration: left, easing: 'steps(3, end)' });
      const done = () => {
        dust.remove();
        copies.delete(dust);
        puffed.delete(key);
      };
      burst.onfinish = done;
      burst.oncancel = done;
    }
  }

  function start(): void {
    puff();
    for (const grid of grids()) {
      for (const item of grid.items) {
        const phase = motionOf(item.id);
        if (!phase || phase.phase === 'puff' || incoming.has(item.id) || arrived.has(item.id)) continue;
        if (phase.phase === 'pop') {
          pop(item.id, POP_MS * (1 - phase.t));
          continue;
        }
        const left = FLY_MS * (1 - phase.t);
        if (!fly(phase.motion, left)) {
          pop(item.id, POP_MS);
          continue;
        }
        incoming.add(item.id);
        later(left, () => pop(item.id, POP_MS));
      }
    }
  }

  /** Ticks once a shake has had its time, so a refused cell's red goes again. */
  const shakeClock = ref(0);

  watch(motionTick, () => {
    later(SHAKE_MS + 16, () => {
      shakeClock.value += 1;
    });
    // Re-set through the reactive grids so the window draws what the ledger put in them.
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
    /** The cell (by `cellKey`) a refused move was aimed at is in its shake. */
    isShaking: (key: string): boolean => shakeClock.value + motionTick.value >= 0 && shakeOf(key) !== null,
  };
}
