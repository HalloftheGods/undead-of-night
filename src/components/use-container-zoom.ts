import { computed, onBeforeUnmount, onMounted, ref, type Ref } from 'vue';
import { arrivalCamera, type ScreenRect } from '../game/inventory/move-motion.ts';
import { BACK_MS, backFlight, lerpRect, noteStageRect, toSpace, zoomFrame } from '../game/inventory/container-zoom.ts';

/** The page canvas is dimmed under the window (App.vue `.is-looting`), so the copy starts as dim as the world it leaves. */
const WORLD_BRIGHTNESS = 0.7;
const ART_OPACITY = 0.9;

/** Copies flying back to the world after a close; a new window clears them so two never overlap. */
const flyingBack = new Set<Element>();

function cancelBackClones(): void {
  for (const copy of flyingBack) copy.remove();
  flyingBack.clear();
}

function rectOf(element: Element): ScreenRect {
  const box = element.getBoundingClientRect();
  return { x: box.left, y: box.top, w: box.width, h: box.height };
}

function place(copy: SVGElement, rect: ScreenRect, origin: { x: number; y: number }): void {
  Object.assign(copy.style, { left: `${rect.x - origin.x}px`, top: `${rect.y - origin.y}px`, width: `${rect.w}px`, height: `${rect.h}px` });
}

function copyOf(art: SVGSVGElement): SVGSVGElement {
  const copy = art.cloneNode(true) as SVGSVGElement;
  copy.classList.remove('container-stage-bg-art');
  copy.classList.add('container-zoom-clone');
  Object.assign(copy.style, { position: 'absolute', margin: '0', pointerEvents: 'none', zIndex: '60', imageRendering: 'pixelated' });
  return copy;
}

/** After a close: the open drawing flies from the window back to where the prop stands, unless the window came straight back. */
function flyBack(copy: SVGSVGElement): void {
  const back = backFlight();
  const camera = arrivalCamera();
  const canFly = back !== null && back.space === 'client' && camera !== null && typeof copy.animate === 'function';
  if (!canFly || !back || !camera) return;
  const to = toSpace(back.from, camera, 'client');
  copy.style.position = 'fixed';
  place(copy, back.to, { x: 0, y: 0 });
  copy.style.transformOrigin = '0 0';
  document.body.appendChild(copy);
  flyingBack.add(copy);
  const dx = to.x - back.to.x;
  const dy = to.y - back.to.y;
  const sx = to.w / Math.max(1, back.to.w);
  const sy = to.h / Math.max(1, back.to.h);
  const flight = copy.animate(
    [
      { transform: 'none', opacity: ART_OPACITY },
      { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`, opacity: 0.6 },
    ],
    { duration: BACK_MS * (1 - back.t), easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)' },
  );
  const done = () => {
    copy.remove();
    flyingBack.delete(copy);
  };
  flight.onfinish = done;
  flight.oncancel = done;
}

/**
 * The page loot window's side of a container zooming out of the world (game/inventory/container-zoom.ts). The real
 * art, grid and label stay hidden while a copy of the art flies from the prop's spot in the world to where the real
 * art sits; the grid shows when it lands. The clock is shared, so a remount mid-zoom carries on and one after landing
 * shows nothing. `root` is the window's backdrop, which the copy is drawn in.
 */
export function useContainerZoom(root: Ref<HTMLElement | null>, art: Ref<SVGSVGElement | null>) {
  const landed = ref(zoomFrame().landed);
  const fading = ref(false);
  const fade = ref(1);
  const landedHere = ref(false);
  let clone: SVGSVGElement | null = null;
  let frame = 0;

  function dropClone(): void {
    clone?.remove();
    clone = null;
  }

  function noteStage(): void {
    if (landed.value && art.value) noteStageRect('client', rectOf(art.value));
  }

  function step(): void {
    frame = 0;
    const zoom = zoomFrame();
    if (zoom.landed) {
      dropClone();
      landedHere.value = !landed.value;
      landed.value = true;
      fading.value = false;
      noteStage();
      return;
    }
    const host = root.value;
    const camera = arrivalCamera();
    const flies = zoom.kind === 'zoom' && zoom.from !== null && camera !== null && host !== null && art.value !== null;
    if (flies && zoom.from && camera && host && art.value) {
      clone ??= host.appendChild(copyOf(art.value));
      const frameBox = host.getBoundingClientRect();
      const origin = { x: frameBox.left - host.scrollLeft, y: frameBox.top - host.scrollTop };
      place(clone, lerpRect(toSpace(zoom.from, camera, 'client'), rectOf(art.value), zoom.eased), origin);
      clone.style.opacity = `${1 + (ART_OPACITY - 1) * zoom.eased}`;
      clone.style.filter = `brightness(${WORLD_BRIGHTNESS + (1 - WORLD_BRIGHTNESS) * zoom.eased})`;
    } else {
      // Nowhere to fly from (off screen, under a roof, or no camera yet): the art fades in where it sits.
      dropClone();
      fading.value = zoom.kind !== 'wait';
      fade.value = zoom.eased;
    }
    frame = requestAnimationFrame(step);
  }

  onMounted(() => {
    cancelBackClones();
    if (landed.value) noteStage();
    else frame = requestAnimationFrame(step);
    // The window can scroll or resize after landing: where the art sits is kept current for the fly back.
    window.addEventListener('resize', noteStage);
    window.addEventListener('scroll', noteStage, { capture: true, passive: true });
  });

  onBeforeUnmount(() => {
    window.removeEventListener('resize', noteStage);
    window.removeEventListener('scroll', noteStage, { capture: true });
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    dropClone();
    const snapshot = landed.value && art.value ? copyOf(art.value) : null;
    // A frame later, so a rebuild of the same window (which rejoins the zoom and cancels the fly back) never flies.
    if (snapshot) requestAnimationFrame(() => flyBack(snapshot));
  });

  return {
    zoomClass: computed(() => ({
      'is-zoom-pending': !landed.value,
      'is-zoom-flying': !landed.value && !fading.value,
      'is-zoom-fade': fading.value,
      'is-zoom-landed': landedHere.value,
    })),
    zoomStyle: computed(() => ({ '--zoom-fade': fade.value })),
  };
}
