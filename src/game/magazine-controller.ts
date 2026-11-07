import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';
import type { InjectionKey } from 'vue';
import { motion } from './motion.ts';
import { isConfirmKey } from './title-menu.ts';
import { openBook, pageLabel, planTurn, steppedPage } from './magazine-pages.ts';
import type { PageTurn, ReadingMode } from './magazine-pages.ts';
import type { Magazine } from './magazine-types.ts';

/** How long a page takes to go over. magazine.css runs its animation for the same time. */
export const TURN_MS = 560;

const SWIPE_MIN_PX = 40;
const TALL_WINDOW = '(max-aspect-ratio: 1/1)';

const TURN_KEYS: Readonly<Record<string, number>> = {
  ArrowRight: 1,
  PageDown: 1,
  ArrowLeft: -1,
  PageUp: -1,
};

/** Which way a key turns the page, or 0 if it does not. */
export function turnKeyStep(code: string): number {
  return TURN_KEYS[code] ?? 0;
}

/** Which way a finished swipe turns the page. Pulling the page to the left goes forward; 0 for a tap or a scroll. */
export function swipeStep(dx: number, dy: number): number {
  const sideways = Math.abs(dx) >= SWIPE_MIN_PX && Math.abs(dx) > Math.abs(dy) * 1.5;
  const forward = dx < 0;
  const step = forward ? 1 : -1;
  return sideways ? step : 0;
}

export interface MagazineLinks {
  goToPage(pageIndex: number): void;
}

/** Lets a chapter link, however deep in a page, turn the book. */
export const MAGAZINE_LINKS: InjectionKey<MagazineLinks> = Symbol('magazine-links');

/** Reads the magazine: where it is open, the turn in progress, and every way of turning. */
export function useMagazineReader(magazine: Magazine, onTurn: () => void, onClose: () => void) {
  const pageIndex = ref(0);
  const mode = ref<ReadingMode>('spread');
  const turn = shallowRef<PageTurn | null>(null);
  const tall = window.matchMedia(TALL_WINDOW);
  const book = computed(() => openBook(magazine, pageIndex.value, mode.value));
  const view = computed(() => ({
    book: book.value,
    mode: mode.value,
    turn: turn.value,
    label: pageLabel(book.value, magazine),
    atStart: steppedPage(magazine, pageIndex.value, -1, mode.value) === pageIndex.value,
    atEnd: steppedPage(magazine, pageIndex.value, 1, mode.value) === pageIndex.value,
  }));

  let settle: number | undefined;
  let swipeFrom: { readonly x: number; readonly y: number } | null = null;

  function goToPage(target: number): void {
    const staying = target === pageIndex.value;
    if (staying) return;
    const before = book.value;
    const forward = target > pageIndex.value;
    pageIndex.value = target;
    onTurn();
    window.clearTimeout(settle);
    const stillPage = motion.reduced.value;
    turn.value = stillPage ? null : planTurn(before, book.value, forward);
    settle = window.setTimeout(() => (turn.value = null), TURN_MS);
  }

  const movePages = (by: number) => goToPage(steppedPage(magazine, pageIndex.value, by, mode.value));

  function onKey(event: KeyboardEvent): void {
    // An Enter held down must not ride focus into whatever opens next.
    const heldEnter = isConfirmKey(event.code) && event.repeat;
    const leaving = event.code === 'Escape' && !event.repeat;
    const by = turnKeyStep(event.code);
    const turning = by !== 0;
    if (heldEnter) event.preventDefault();
    if (leaving) onClose();
    if (turning) movePages(by);
  }

  function beginSwipe(event: PointerEvent): void {
    const touching = event.pointerType !== 'mouse';
    swipeFrom = touching ? { x: event.clientX, y: event.clientY } : null;
  }

  function finishSwipe(event: PointerEvent): void {
    const from = swipeFrom;
    swipeFrom = null;
    const by = from ? swipeStep(event.clientX - from.x, event.clientY - from.y) : 0;
    const turning = by !== 0;
    if (turning) movePages(by);
  }

  function matchWindow(): void {
    mode.value = tall.matches ? 'single' : 'spread';
    turn.value = null;
  }

  matchWindow();
  onMounted(() => {
    window.addEventListener('keydown', onKey);
    tall.addEventListener('change', matchWindow);
  });
  onBeforeUnmount(() => {
    window.removeEventListener('keydown', onKey);
    tall.removeEventListener('change', matchWindow);
    window.clearTimeout(settle);
  });

  return { view, movePages, goToPage, beginSwipe, finishSwipe };
}
