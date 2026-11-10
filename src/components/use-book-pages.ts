// Reading a printed book on a title page: which leaves are open, turning with Prev/Next, the arrow keys or a swipe,
// Esc to leave, and two leaves at a time on a wide window or one on a tall one. The Record Book and the changelog share it.
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';
import type { ComputedRef, Ref, ShallowRef } from 'vue';
import { BOOK_MOBILE_QUERY, firstShown, openLeavesOf, openOf, pagesLabel, planBookTurn, turnWithin } from '../game/book-turn.ts';
import type { BookMode, BookTurn, OpenLeaves } from '../game/book-turn.ts';
import { swipeStep, turnKeyStep, TURN_MS } from '../game/magazine-controller.ts';
import { motion } from '../game/motion.ts';

/** What the open book shows right now. */
export interface BookView<T> {
  readonly mode: Ref<BookMode>;
  readonly open: ComputedRef<OpenLeaves<T>>;
  readonly turn: ShallowRef<BookTurn<T> | null>;
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
  /** A window taller than it is wide or a mobile screen reads one page at a time. */
  const mobileMedia = window.matchMedia(BOOK_MOBILE_QUERY);
  const mode = ref<BookMode>(mobileMedia.matches ? 'single' : 'spread');
  const at = ref(0);
  const turn = shallowRef<BookTurn<T> | null>(null);
  let settle: number | undefined;

  const open = computed(() => openLeavesOf(leaves, at.value, mode.value));
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
    const before = open.value;
    const forward = by > 0;
    at.value = next;
    onTurn();
    window.clearTimeout(settle);
    const stillPage = motion.reduced.value;
    turn.value = stillPage ? null : planBookTurn(before, open.value, forward);
    settle = window.setTimeout(() => (turn.value = null), TURN_MS);
  }

  function goTo(index: number): void {
    const target = Math.max(0, Math.min(leaves.length - 1, index));
    const next = firstShown(target, mode.value);
    const stays = next === firstShown(at.value, mode.value);
    if (stays) return;
    const before = open.value;
    const forward = next > at.value;
    at.value = next;
    onTurn();
    window.clearTimeout(settle);
    const stillPage = motion.reduced.value;
    turn.value = stillPage ? null : planBookTurn(before, open.value, forward);
    settle = window.setTimeout(() => (turn.value = null), TURN_MS);
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
    mode.value = mobileMedia.matches ? 'single' : 'spread';
    turn.value = null;
  }

  onMounted(() => {
    window.addEventListener('keydown', onKey);
    mobileMedia.addEventListener('change', matchWindow);
  });
  onBeforeUnmount(() => {
    window.removeEventListener('keydown', onKey);
    mobileMedia.removeEventListener('change', matchWindow);
    window.clearTimeout(settle);
  });

  const view: BookView<T> = { mode, open, turn, shown, shownKey, label, atStart, atEnd, firstFolio };
  return { view, flipPages, goTo, beginSwipe, finishSwipe };
}
