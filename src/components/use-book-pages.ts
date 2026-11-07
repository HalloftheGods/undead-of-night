// Reading a printed book on a title page: which leaves are open, turning with Prev/Next, the arrow keys or a swipe,
// Esc to leave, and two leaves at a time on a wide window or one on a tall one. The Record Book and the changelog share it.
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import type { ComputedRef, Ref } from 'vue';
import { firstShown, openOf, pagesLabel, turnWithin } from '../game/book-turn.ts';
import type { BookMode } from '../game/book-turn.ts';
import { swipeStep, turnKeyStep } from '../game/magazine-controller.ts';

/** What the open book shows right now. */
export interface BookView<T> {
  readonly mode: Ref<BookMode>;
  readonly shown: ComputedRef<readonly T[]>;
  /** Changes on every turn, to replay the settle animation. */
  readonly shownKey: ComputedRef<string>;
  readonly label: ComputedRef<string>;
  readonly atStart: ComputedRef<boolean>;
  readonly atEnd: ComputedRef<boolean>;
  /** The number of the first leaf open, from 1. */
  readonly firstFolio: ComputedRef<number>;
}

export interface BookPages<T> {
  readonly view: BookView<T>;
  flipPages(by: number): void;
  goTo(index: number): void;
  beginSwipe(event: PointerEvent): void;
  finishSwipe(event: PointerEvent): void;
}

export function useBookPages<T extends { readonly id: string }>(leaves: readonly T[], onTurn: () => void, onClose: () => void): BookPages<T> {
  /** The same test as How to Play: a window taller than it is wide reads one page at a time. */
  const tall = window.matchMedia('(max-aspect-ratio: 1/1)');
  const mode = ref<BookMode>(tall.matches ? 'single' : 'spread');
  const at = ref(0);
  const shown = computed(() => openOf(leaves, at.value, mode.value));
  const shownKey = computed(() => shown.value.map((leaf) => leaf.id).join('-'));
  const label = computed(() => pagesLabel(leaves.length, at.value, mode.value));
  const atStart = computed(() => turnWithin(leaves.length, at.value, -1, mode.value) === at.value);
  const atEnd = computed(() => turnWithin(leaves.length, at.value, 1, mode.value) === at.value);
  const firstFolio = computed(() => firstShown(at.value, mode.value) + 1);

  function flipPages(by: number): void {
    const next = turnWithin(leaves.length, at.value, by, mode.value);
    const stays = next === at.value;
    if (stays) return;
    at.value = next;
    onTurn();
  }

  function goTo(index: number): void {
    const target = Math.max(0, Math.min(leaves.length - 1, index));
    const stays = firstShown(target, mode.value) === firstShown(at.value, mode.value);
    if (stays) return;
    at.value = firstShown(target, mode.value);
    onTurn();
  }

  function onKey(event: KeyboardEvent): void {
    const leaving = event.code === 'Escape' && !event.repeat;
    const by = turnKeyStep(event.code);
    const turning = by !== 0;
    if (leaving) onClose();
    if (turning) flipPages(by);
  }

  let swipeFrom: { readonly x: number; readonly y: number } | null = null;
  function beginSwipe(event: PointerEvent): void {
    const touching = event.pointerType !== 'mouse';
    swipeFrom = touching ? { x: event.clientX, y: event.clientY } : null;
  }
  function finishSwipe(event: PointerEvent): void {
    const from = swipeFrom;
    swipeFrom = null;
    const by = from ? swipeStep(event.clientX - from.x, event.clientY - from.y) : 0;
    const turning = by !== 0;
    if (turning) flipPages(by);
  }

  function matchWindow(): void {
    mode.value = tall.matches ? 'single' : 'spread';
  }

  onMounted(() => {
    window.addEventListener('keydown', onKey);
    tall.addEventListener('change', matchWindow);
  });
  onBeforeUnmount(() => {
    window.removeEventListener('keydown', onKey);
    tall.removeEventListener('change', matchWindow);
  });

  const view: BookView<T> = { mode, shown, shownKey, label, atStart, atEnd, firstFolio };
  return { view, flipPages, goTo, beginSwipe, finishSwipe };
}
