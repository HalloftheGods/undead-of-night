import { computed, getCurrentInstance, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';
import type { ComputedRef, Ref, ShallowRef } from 'vue';
import {
  BOOK_MOBILE_QUERY,
  planBookTurn,
} from '../../game/book-turn.ts';
import type { BookMode, BookTurn, OpenLeaves } from '../../game/book-turn.ts';
import { swipeStep, turnKeyStep, TURN_MS } from '../../game/magazine-controller.ts';
import { motion } from '../../game/motion.ts';
import type { CandyMagazineLeaf } from '../../game/candy-magazine-data.ts';

export interface CandyMagazineView {
  readonly mode: Ref<BookMode>;
  readonly open: ComputedRef<OpenLeaves<CandyMagazineLeaf>>;
  readonly turn: ShallowRef<BookTurn<CandyMagazineLeaf> | null>;
  readonly label: ComputedRef<string>;
  readonly atStart: ComputedRef<boolean>;
  readonly atEnd: ComputedRef<boolean>;
  readonly isCover: ComputedRef<boolean>;
  readonly isSolo: ComputedRef<boolean>;
  readonly at: Ref<number>;
}

export interface CandyMagazinePages {
  readonly view: CandyMagazineView;
  flipPages(by: number): void;
  goTo(index: number): void;
  beginSwipe(event: PointerEvent): void;
  finishSwipe(event: PointerEvent): void;
}

export function useCandyMagazinePages(
  leaves: readonly CandyMagazineLeaf[],
  onTurn: () => void,
  onClose: () => void,
): CandyMagazinePages {
  const hasWindow = typeof window !== 'undefined';
  const mobileMedia = hasWindow
    ? window.matchMedia(BOOK_MOBILE_QUERY)
    : { matches: false, addEventListener: () => {}, removeEventListener: () => {} };
  const mode = ref<BookMode>(mobileMedia.matches ? 'single' : 'spread');
  const at = ref(0);
  const turn = shallowRef<BookTurn<CandyMagazineLeaf> | null>(null);
  let settle: number | undefined;

  const isCover = computed(() => at.value === 0);
  const isSolo = computed(() => mode.value === 'single' || at.value <= 1);

  const open = computed<OpenLeaves<CandyMagazineLeaf>>(() => {
    const current = at.value;
    const isSingle = mode.value === 'single';
    const isSoloPage = isSingle || current <= 1;

    if (isSoloPage) {
      return { left: null, right: null, solo: leaves[current] ?? null };
    }

    const spreadIndex = current - (current % 2);
    return {
      left: leaves[spreadIndex] ?? null,
      right: leaves[spreadIndex + 1] ?? null,
      solo: null,
    };
  });

  const label = computed(() => {
    const current = at.value;
    const total = leaves.length;
    const isAtCover = current === 0;
    if (isAtCover) return 'Cover';

    const isAtContents = current === 1;
    if (isAtContents) return 'Contents';

    const isSingle = mode.value === 'single';
    if (isSingle) {
      return `Page ${current + 1} of ${total}`;
    }

    const first = current - (current % 2) + 1;
    const last = Math.min(total, first + 1);
    return `Pages ${first}-${last} of ${total}`;
  });

  const atStart = computed(() => at.value === 0);

  const atEnd = computed(() => {
    const current = at.value;
    const total = leaves.length;
    const isSingle = mode.value === 'single';
    return isSingle ? current >= total - 1 : current >= total - 2;
  });

  function targetAfter(by: number): number {
    const current = at.value;
    const isSingle = mode.value === 'single';
    const total = leaves.length;

    if (isSingle) {
      return Math.max(0, Math.min(total - 1, current + by));
    }

    const movingForward = by > 0;
    if (movingForward) {
      const isAtCover = current === 0;
      if (isAtCover) return 1;
      const isAtContents = current === 1;
      if (isAtContents) return 2;
      return Math.min(total - 2, current + 2);
    }

    const isAtCover = current <= 0;
    if (isAtCover) return 0;
    const isAtContents = current === 1;
    if (isAtContents) return 0;
    const isAtFirstSpread = current === 2;
    if (isAtFirstSpread) return 1;
    return Math.max(2, current - 2);
  }

  function flipPages(by: number): void {
    const next = targetAfter(by);
    const stays = next === at.value;
    if (stays) return;

    const before = open.value;
    const forward = by > 0;
    at.value = next;
    onTurn();
    if (hasWindow) {
      window.clearTimeout(settle);
      settle = window.setTimeout(() => (turn.value = null), TURN_MS);
    }
    const stillPage = motion.reduced.value;
    turn.value = stillPage ? null : planBookTurn(before, open.value, forward);
  }

  function goTo(index: number): void {
    const total = leaves.length;
    const bounded = Math.max(0, Math.min(total - 1, index));
    const isSingle = mode.value === 'single';
    const isSpreadCandy = !isSingle && bounded >= 2;
    const next = isSpreadCandy ? bounded - (bounded % 2) : bounded;

    const stays = next === at.value;
    if (stays) return;

    const before = open.value;
    const forward = next > at.value;
    at.value = next;
    onTurn();
    if (hasWindow) {
      window.clearTimeout(settle);
      settle = window.setTimeout(() => (turn.value = null), TURN_MS);
    }
    const stillPage = motion.reduced.value;
    turn.value = stillPage ? null : planBookTurn(before, open.value, forward);
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

  if (getCurrentInstance()) {
    onMounted(() => {
      if (hasWindow) {
        window.addEventListener('keydown', onKey);
        mobileMedia.addEventListener('change', matchWindow);
      }
    });
    onBeforeUnmount(() => {
      if (hasWindow) {
        window.removeEventListener('keydown', onKey);
        mobileMedia.removeEventListener('change', matchWindow);
        window.clearTimeout(settle);
      }
    });
  }

  const view: CandyMagazineView = {
    mode,
    open,
    turn,
    label,
    atStart,
    atEnd,
    isCover,
    isSolo,
    at,
  };

  return { view, flipPages, goTo, beginSwipe, finishSwipe };
}
