import { getCurrentInstance, onBeforeUnmount, onMounted, onUpdated } from 'vue';
import type { Ref } from 'vue';

/**
 * A printed page cannot scroll, so a page that will not fit first sets its type a little smaller, then drops its
 * sticky notes and stamps, then shrinks again. Any section's words fit any window this way, however long they get.
 */
export interface PageFit {
  readonly scale: number;
  readonly tight: boolean;
}

export const FIT_STEPS: readonly PageFit[] = [
  { scale: 1, tight: false },
  { scale: 0.95, tight: false },
  { scale: 0.9, tight: false },
  { scale: 1, tight: true },
  { scale: 0.95, tight: true },
  { scale: 0.9, tight: true },
  { scale: 0.85, tight: true },
  { scale: 0.8, tight: true },
  { scale: 0.75, tight: true },
  { scale: 0.7, tight: true },
];

/** The first step that fits, or the last one tried when nothing does. */
export function chooseFit(fits: (step: PageFit) => boolean, steps: readonly PageFit[] = FIT_STEPS): PageFit {
  return steps.find(fits) ?? steps[steps.length - 1];
}

/** A tilted card leans a few pixels past its box without anything being cut off. */
const TILT_SLACK_PX = 10;

/** Rotated snapshots lean past their boxes, so this reads layout boxes, which ignore a tilt. */
function overflows(flow: HTMLElement): boolean {
  const room = flow.clientHeight;
  const wideRoom = flow.clientWidth;
  return [...flow.children].some((child) => {
    const box = child as HTMLElement;
    const tooLow = box.offsetTop + box.offsetHeight > room + 1;
    const tooWide = box.offsetLeft + box.offsetWidth > wideRoom + 1;
    const words = box.matches('.mag-head, .mag-article');
    const spills = words && box.scrollWidth > box.clientWidth + 1;
    const crammed = box.matches('.mag-gallery') && box.scrollHeight > box.clientHeight + TILT_SLACK_PX;
    return tooLow || tooWide || spills || crammed;
  });
}

function pageOverflows(page: HTMLElement): boolean {
  const flows = [...page.querySelectorAll<HTMLElement>('.mag-flow')];
  return flows.some(overflows);
}

function apply(page: HTMLElement, step: PageFit): void {
  page.style.setProperty('--fit', String(step.scale));
  page.classList.toggle('is-tight', step.tight);
}

export function fitSinglePage(page: HTMLElement): void {
  const chosen = chooseFit((step) => {
    apply(page, step);
    return !pageOverflows(page);
  });
  apply(page, chosen);
}

/** Fits an open two-page spread or solo page, ensuring facing pages share the exact same scale. */
export function fitSpread(container: HTMLElement): void {
  const pages = [...container.querySelectorAll<HTMLElement>('.mag-page')];
  const pageCount = pages.length;
  if (pageCount === 0) return;
  if (pageCount === 1) {
    fitSinglePage(pages[0]);
    return;
  }

  const chosen = chooseFit((step) => {
    for (const page of pages) {
      apply(page, step);
    }
    return !pages.some(pageOverflows);
  });

  for (const page of pages) {
    apply(page, chosen);
  }
}

export function fitPage(page: HTMLElement): void {
  const openContainer = page.closest<HTMLElement>('.mag-open');
  if (openContainer) {
    fitSpread(openContainer);
    return;
  }
  fitSinglePage(page);
}

/** Keeps a page fitted as the window changes or content updates on page turns. */
export function usePageFit(page: Readonly<Ref<HTMLElement | null>>): void {
  let observer: ResizeObserver | null = null;
  const refit = () => {
    if (page.value) fitPage(page.value);
  };

  if (getCurrentInstance()) {
    onMounted(() => {
      refit();
      void document.fonts?.ready.then(refit);
      observer = new ResizeObserver(refit);
      if (page.value) observer.observe(page.value);
    });
    onUpdated(() => {
      refit();
    });
    onBeforeUnmount(() => observer?.disconnect());
  }
}
